import { useCallback, useState } from "react";
import { apiRequest } from "../services/api";

export function usePushNotifications(token: string | null) {
  const [isSubscribing, setIsSubscribing] = useState(false);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeUser = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Push notifications are not supported in this browser.");
    }

    try {
      setIsSubscribing(true);

      // 1. Register Service Worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      
      // 2. Request Permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Permission for notifications was denied.");
      }

      // 3. Get Public Key from Backend
      const resKey = await apiRequest<{ publicKey: string }>("/notifications/vapid-public-key", { token });
      const publicKey = resKey.data.publicKey;

      // 4. Subscribe with Push Server
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 5. Send Subscription to Backend
      await apiRequest("/notifications/subscribe", {
        method: "POST",
        token,
        body: { subscription }
      });

      return true;
    } catch (error: any) {
      console.error("Failed to subscribe to push notifications:", error);
      throw error;
    } finally {
      setIsSubscribing(false);
    }
  }, [token]);

  return { subscribeUser, isSubscribing };
}
