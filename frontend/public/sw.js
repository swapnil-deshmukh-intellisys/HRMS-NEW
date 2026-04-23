self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const { title, body, icon, badge, data: customData } = data.notification || {};

  const options = {
    body: body || "You have a new notification",
    icon: icon || "/favicon.svg",
    badge: badge || "/favicon.svg",
    data: customData || { url: "/" },
    vibrate: [100, 50, 100],
    actions: [
      { action: "open", title: "Open HRMS" },
      { action: "close", title: "Dismiss" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title || "HRMS Alert", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") return;

  const urlToOpen = event.notification.data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Find any open tab of the app
      for (const client of windowClients) {
        if ("focus" in client) {
          // If we find an open tab, navigate it to include the trigger and focus it
          const url = new URL(urlToOpen, self.location.origin);
          return client.navigate(url.href).then(c => c?.focus());
        }
      }
      // If no tab open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
