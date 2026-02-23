/**
 * Push notification utilities for SolTrivia.
 * Handles subscription, permission, and registration with Supabase.
 */
import { SUPABASE_FUNCTIONS_URL } from './constants';
import { getAuthHeaders } from './api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/** Convert URL-safe base64 to Uint8Array (needed by pushManager.subscribe) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

/** Check if push notifications are supported in this browser/TWA */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

/** Get current notification permission state */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/** Check if user already has an active push subscription */
export async function hasActiveSubscription(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Subscribe to push notifications.
 * 1. Request permission
 * 2. Subscribe via PushManager
 * 3. Register subscription with Supabase
 */
export async function subscribeToPush(walletAddress: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Subscribe with VAPID public key
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Register with Supabase
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/register-push`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        wallet_address: walletAddress,
        subscription: subscription.toJSON(),
      }),
    });

    if (!response.ok) {
      console.error('Failed to register push subscription');
      return false;
    }

    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

/** Unsubscribe from push notifications */
export async function unsubscribeFromPush(walletAddress: string): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Remove from Supabase
    await fetch(`${SUPABASE_FUNCTIONS_URL}/register-push`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        wallet_address: walletAddress,
        subscription: null, // null = unsubscribe
      }),
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}
