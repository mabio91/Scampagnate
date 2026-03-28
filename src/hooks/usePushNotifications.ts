import { useState, useEffect, useCallback } from 'react';
import OneSignal from 'react-onesignal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ONESIGNAL_APP_ID = '5b9c05fd-e0f1-427e-8301-0a47caba3274';

let onesignalInitialized = false;

async function initOneSignal() {
  if (onesignalInitialized) return;

  // Don't init in iframe or preview
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const isPreview = window.location.hostname.includes('id-preview--') || window.location.hostname.includes('lovableproject.com');
  if (isInIframe || isPreview) return;

  try {
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerParam: { scope: '/' },
      serviceWorkerPath: '/OneSignalSDKWorker.js',
    });
    onesignalInitialized = true;
  } catch (err) {
    console.error('OneSignal init error:', err);
  }
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'Notification' in window;
    setIsSupported(supported);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    if (supported) {
      initOneSignal();
    }
  }, []);

  // Sync subscription state
  useEffect(() => {
    if (!isSupported || !onesignalInitialized) return;

    const checkSubscription = async () => {
      try {
        const subscribed = OneSignal.User.PushSubscription.optedIn ?? false;
        setIsSubscribed(subscribed);
      } catch {
        setIsSubscribed(false);
      }
    };

    checkSubscription();

    const handler = (change: any) => {
      setIsSubscribed(change?.current?.optedIn ?? false);
    };
    OneSignal.User.PushSubscription.addEventListener('change', handler);
    return () => {
      OneSignal.User.PushSubscription.removeEventListener('change', handler);
    };
  }, [isSupported]);

  // Store player ID in Supabase when subscribed
  useEffect(() => {
    if (!user || !isSubscribed || !onesignalInitialized) return;

    const storePlayerId = async () => {
      try {
        const playerId = OneSignal.User.PushSubscription.id;
        if (!playerId) return;

        // Set external user ID for targeting
        OneSignal.login(user.id);

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

    storePlayerId();
  }, [user, isSubscribed]);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    setIsLoading(true);

    try {
      await initOneSignal();
      await OneSignal.Notifications.requestPermission();

      const perm = Notification.permission;
      setPermission(perm);
      if (perm !== 'granted') {
        setIsLoading(false);
        return false;
      }

      await OneSignal.User.PushSubscription.optIn();
      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('OneSignal subscription failed:', err);
      setIsLoading(false);
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !onesignalInitialized) return;
    setIsLoading(true);

    try {
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
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);

  return { isSupported, isSubscribed, permission, subscribe, unsubscribe, isLoading };
};
