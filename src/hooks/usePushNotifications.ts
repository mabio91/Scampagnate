import { useState, useEffect, useCallback } from 'react';
import OneSignal from 'react-onesignal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TablesInsert } from '@/integrations/supabase/types';

const ONESIGNAL_APP_ID = '5b9c05fd-e0f1-427e-8301-0a47caba3274';
const ONESIGNAL_SERVICE_WORKER_SCOPE = '/push/onesignal/';
const ONESIGNAL_SERVICE_WORKER_PATH = 'OneSignalSDKWorker.js';

let onesignalInitialized = false;
let onesignalInitPromise: Promise<{ ready: boolean; reason?: string }> | null = null;

type PushSubscriptionChange = {
  current?: {
    optedIn?: boolean | null;
  } | null;
};

type PushActionResult = {
  success: boolean;
  errorMessage?: string;
};

const NOTIFICATIONS_BLOCKED_MESSAGE =
  'Le notifiche sono bloccate per questo sito. Apri le impostazioni di Chrome, consenti le notifiche per scampagnate.com e riprova.';

const NOTIFICATIONS_UNSUPPORTED_MESSAGE = 'Questo browser non supporta le notifiche push.';
const ONESIGNAL_INIT_ERROR_MESSAGE = 'Non riesco a inizializzare le notifiche push su questo dispositivo.';
const ONESIGNAL_SUBSCRIPTION_ERROR_MESSAGE = 'Non riesco a completare la registrazione push su questo dispositivo.';

function resultError(message: string): PushActionResult {
  return { success: false, errorMessage: message };
}

function messageFromError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

function getPushBlockReason() {
  if (typeof window === 'undefined') return 'Push notifications are only available in the browser.';

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const hostname = window.location.hostname;
  const isPreview = hostname.includes('id-preview--') || hostname.includes('lovableproject.com');

  if (isInIframe || isPreview) {
    return 'Push notifications can only be enabled on the published app, not inside the preview.';
  }

  return null;
}

async function initOneSignal() {
  if (onesignalInitialized) return { ready: true };

  const blockReason = getPushBlockReason();
  if (blockReason) return { ready: false, reason: blockReason };

  if (onesignalInitPromise) return onesignalInitPromise;

  onesignalInitPromise = (async () => {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        path: ONESIGNAL_SERVICE_WORKER_SCOPE,
        serviceWorkerPath: ONESIGNAL_SERVICE_WORKER_PATH,
        serviceWorkerParam: { scope: ONESIGNAL_SERVICE_WORKER_SCOPE },
      });

      onesignalInitialized = true;
      return { ready: true };
    } catch (err) {
      console.error('OneSignal init error:', err);
      return { ready: false, reason: messageFromError(err, ONESIGNAL_INIT_ERROR_MESSAGE) };
    } finally {
      onesignalInitPromise = null;
    }
  })();

  return onesignalInitPromise;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [canManagePush, setCanManagePush] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const browserSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window;
    const blockReason = browserSupported ? getPushBlockReason() : 'This browser does not support push notifications.';

    setIsSupported(browserSupported);
    setCanManagePush(browserSupported && !blockReason);
    setErrorMessage(blockReason);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }

    if (!browserSupported || blockReason) {
      setIsReady(false);
      setIsSubscribed(false);
      return;
    }

    if (onesignalInitialized) {
      setIsReady(true);
      try {
        setIsSubscribed(OneSignal.User.PushSubscription.optedIn ?? false);
      } catch {
        setIsSubscribed(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const syncSubscription = () => {
      try {
        setIsSubscribed(OneSignal.User.PushSubscription.optedIn ?? false);
      } catch {
        setIsSubscribed(false);
      }
    };

    syncSubscription();

    const handler = (change: PushSubscriptionChange) => {
      setIsSubscribed(change?.current?.optedIn ?? false);
    };

    OneSignal.User.PushSubscription.addEventListener('change', handler);
    return () => {
      OneSignal.User.PushSubscription.removeEventListener('change', handler);
    };
  }, [isReady]);

  useEffect(() => {
    if (!user || !isReady) return;

    const syncOneSignalUser = async () => {
      try {
        await OneSignal.login(user.id);
      } catch (err) {
        console.error('Failed to sync OneSignal user:', err);
      }
    };

    void syncOneSignalUser();
  }, [user, isReady]);

  useEffect(() => {
    if (!user || !isSubscribed || !isReady) return;

    const storePlayerId = async () => {
      try {
        const playerId = OneSignal.User.PushSubscription.id;
        if (!playerId) return;

        const payload: TablesInsert<'onesignal_players'> = {
          user_id: user.id,
          player_id: playerId,
          device_type: 'web',
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from('onesignal_players')
          .upsert(payload, { onConflict: 'user_id,player_id' });
      } catch (err) {
        console.error('Failed to store OneSignal player ID:', err);
      }
    };

    void storePlayerId();
  }, [user, isSubscribed, isReady]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setErrorMessage(NOTIFICATIONS_UNSUPPORTED_MESSAGE);
      return resultError(NOTIFICATIONS_UNSUPPORTED_MESSAGE);
    }

    setIsLoading(true);

    try {
      const initResult = await initOneSignal();
      setIsReady(initResult.ready);
      setCanManagePush(initResult.ready);
      setErrorMessage(initResult.reason ?? null);

      if (!initResult.ready) {
        return resultError(initResult.reason ?? ONESIGNAL_INIT_ERROR_MESSAGE);
      }

      if (user) {
        try {
          await OneSignal.login(user.id);
        } catch (err) {
          console.error('Failed to log in OneSignal user during subscribe:', err);
        }
      }

      await OneSignal.Notifications.requestPermission();

      const nextPermission = Notification.permission;
      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        const message = nextPermission === 'denied'
          ? NOTIFICATIONS_BLOCKED_MESSAGE
          : 'Permesso notifiche non concesso.';
        setErrorMessage(message);
        return resultError(message);
      }

      await OneSignal.User.PushSubscription.optIn();

      const optedIn = OneSignal.User.PushSubscription.optedIn ?? false;
      setIsSubscribed(optedIn);

      if (!optedIn) {
        setErrorMessage(ONESIGNAL_SUBSCRIPTION_ERROR_MESSAGE);
        return resultError(ONESIGNAL_SUBSCRIPTION_ERROR_MESSAGE);
      }

      return { success: true };
    } catch (err) {
      console.error('OneSignal subscription failed:', err);
      const message = messageFromError(err, ONESIGNAL_SUBSCRIPTION_ERROR_MESSAGE);
      setErrorMessage(message);
      return resultError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    setIsLoading(true);

    try {
      const initResult = await initOneSignal();
      setIsReady(initResult.ready);
      setCanManagePush(initResult.ready);
      setErrorMessage(initResult.reason ?? null);

      if (!initResult.ready) {
        return;
      }

      await OneSignal.User.PushSubscription.optOut();

      if (user) {
        const playerId = OneSignal.User.PushSubscription.id;
        if (playerId) {
          await supabase
            .from('onesignal_players')
            .delete()
            .eq('user_id', user.id)
            .eq('player_id', playerId);
        }
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error('OneSignal unsubscribe failed:', err);
      setErrorMessage('OneSignal unsubscribe failed.');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);

  return {
    isSupported,
    canManagePush,
    isSubscribed,
    permission,
    errorMessage,
    subscribe,
    unsubscribe,
    isLoading,
  };
};
