// Kill-switch Service Worker.
// A versão atual do DIROPS-SGA NÃO usa Service Worker. Versões PWA anteriores
// registaram um SW que ficava a servir cache antigo — obrigando a Ctrl+Shift+R
// após cada deploy. Este SW substitui o antigo, remove-se a si próprio, limpa
// todos os caches e recarrega as abas. Depois disto o browser vai sempre direto
// à rede (nginx serve index.html com no-cache), sem precisar de refresh forçado.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* ignore */ }
    try { await self.registration.unregister(); } catch (e) { /* ignore */ }
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    } catch (e) { /* ignore */ }
  })());
});

// Nunca intercepta pedidos — tudo vai direto à rede.
