/* Service worker do Painel CD84: só habilita a instalação; sempre busca a versão mais recente (sem cache) */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
