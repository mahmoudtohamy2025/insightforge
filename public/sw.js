// Self-unregistering service worker.
//
// The previous version of this file (a PWA cache-first/network-first router)
// caused Supabase Auth signup/login fetches to fail with "Failed to fetch" in
// production. The bug was not worth debugging — the PWA caching wasn't
// providing meaningful value yet, and the fetch interception was breaking
// the primary user flow on every pitch URL.
//
// This replacement takes over from the broken SW, drops every cache it left
// behind, unregisters itself, and forces every open tab to reload — so users
// who already have the broken SW installed get freed automatically without
// having to clear site data manually.
//
// Paired with a change in index.html that removes the SW registration entirely,
// so new visitors never install a service worker.
//
// To bring back PWA caching later, do it via vite-plugin-pwa or workbox with
// careful cross-origin handling — don't hand-roll the fetch handler.

self.addEventListener("install", () => {
  // Take over immediately instead of waiting for old SW to finish.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1. Drop every cache the old SW may have populated.
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      // 2. Unregister this service worker. After this completes, the page
      //    has no SW intercepting fetches.
      await self.registration.unregister();

      // 3. Force every open tab pointing at this origin to reload so they
      //    pick up the no-SW state immediately. Without this, the user
      //    would need to refresh manually before signup works.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        // navigate() reloads the tab to the same URL.
        if (typeof client.navigate === "function") {
          try {
            await client.navigate(client.url);
          } catch {
            // Some browsers reject navigate() on cross-origin clients;
            // safe to ignore — the user will see the fix on next manual reload.
          }
        }
      }
    })()
  );
});

// Intentionally NO `fetch` listener. Every request goes straight to the
// network with no SW interception.
