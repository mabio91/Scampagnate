import { useState, useEffect, useCallback } from 'react';
import OneSignal from 'react-onesignal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ONESIGNAL_APP_ID = '5b9c05fd-e0f1-427e-8301-0a47caba3274';

let onesignalInitialized = false;
let onesignalInitPromise: Promise<{ ready: boolean; reason?: string }> | null = null;

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
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: '/OneSignalSDKWorker.js',
      });

      onesignalInitialized = true;
      return { ready: true };
    } catch (err) {
      console.error('OneSignal init error:', err);
      return { ready: false, reason: 'OneSignal failed to initialize.' };
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

    let active = true;

    void initOneSignal().then((result) => {
      if (!active) return;

      setIsReady(result.ready);
      setErrorMessage(result.reason ?? null);

      if (!result.ready) {
        setIsSubscribed(false);
        return;
      }

      try {
        setIsSubscribed(OneSignal.User.PushSubscription.optedIn ?? false);
      } catch {
        setIsSubscribed(false);
      }
    });

    return () => {
      active = false;
    };
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

    const handler = (change: any) => {
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

        await supabase
          .from('onesignal_players' as any)
          .upsert(
            { user_id: user.id, player_id: playerId, device_type: 'web', updated_at: new Date().toISOString() } as any,
            { onConflict: 'user_id,player_id' }
          );
      } catch (err) {
        console.error('Failed to store OneSignal player ID:', err);
      }
    };

    void storePlayerId();
  }, [user, isSubscribed, isReady]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setErrorMessage('This browser does not support push notifications.');
      return false;
    }

    setIsLoading(true);

    try {
      const initResult = await initOneSignal();
      setIsReady(initResult.ready);
      setCanManagePush(initResult.ready);
      setErrorMessage(initResult.reason ?? null);

      if (!initResult.ready) {
        return false;
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
        setErrorMessage('Notification permission was not granted.');
        return false;
      }

      await OneSignal.User.PushSubscription.optIn();

      const optedIn = OneSignal.User.PushSubscription.optedIn ?? false;
      setIsSubscribed(optedIn);

      if (!optedIn) {
        setErrorMessage('Push subscription is not active on this device.');
      }

      return optedIn;
    } catch (err) {
      console.error('OneSignal subscription failed:', err);
      setErrorMessage('OneSignal subscription failed.');
      return false;
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
            .from('onesignal_players' as any)
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
