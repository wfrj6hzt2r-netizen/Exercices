// Service worker de « Mes exercices ». Il n'a qu'un rôle : permettre au patient d'ouvrir
// son programme sans réseau. Une rééducation se fait en salle, en vacances, dans un
// sous-sol ; l'application est installée sur l'écran d'accueil et doit s'ouvrir comme une
// application, pas comme une page web qui échoue.
//
// Stratégie : on répond depuis le cache immédiatement, et on va chercher la version du
// serveur en arrière-plan pour la prochaine ouverture. L'affichage est donc instantané et
// jamais dépendant du réseau, au prix d'une mise à jour décalée d'une ouverture — ce que la
// bannière côté page signale au patient plutôt que de le laisser sur une version périmée.

const CACHE = "mes-exercices-v1";

// Tout ce qu'il faut pour démarrer sans réseau. « ./ » et « ./index.html » désignent la même
// page mais sont deux requêtes distinctes selon que le patient ouvre le dossier ou le fichier.
const COQUILLE = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./icon-192.png",
    "./icon-512.png",
    "./apple-touch-icon.png",
    "./favicon-32.png",
];

self.addEventListener("install", (e) => {
    // Une icône manquante ne doit pas faire échouer toute l'installation : on met en cache
    // fichier par fichier, et ce qui manque sera simplement récupéré au premier besoin.
    e.waitUntil(caches.open(CACHE)
        .then((cache) => Promise.all(COQUILLE.map((url) => cache.add(url).catch(() => null))))
        .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
    e.waitUntil(caches.keys()
        .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
        .then(() => self.clients.claim()));
});

// Deux réponses du même fichier sont-elles différentes ? GitHub Pages envoie un ETag, qui
// change dès que le contenu change ; à défaut on se rabat sur la date de dernière modification.
function aChange(ancienne, nouvelle) {
    if (!ancienne || !nouvelle)
        return false;
    const e1 = ancienne.headers.get("etag"), e2 = nouvelle.headers.get("etag");
    if (e1 && e2)
        return e1 !== e2;
    const d1 = ancienne.headers.get("last-modified"), d2 = nouvelle.headers.get("last-modified");
    return !!(d1 && d2 && d1 !== d2);
}

async function prevenirLesOnglets() {
    const onglets = await self.clients.matchAll({ type: "window" });
    onglets.forEach((c) => c.postMessage({ type: "maj-disponible" }));
}

self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET")
        return;
    // On ne s'occupe que de nos propres fichiers : tout le reste passe sans interception.
    if (new URL(req.url).origin !== self.location.origin)
        return;
    e.respondWith((async () => {
        const cache = await caches.open(CACHE);
        // ignoreSearch : un lien partagé peut porter des paramètres de suivi qui ne changent
        // pas la page demandée.
        const enCache = await cache.match(req, { ignoreSearch: true });
        const versReseau = fetch(req).then(async (rep) => {
            if (rep && rep.ok && rep.type === "basic") {
                const neuf = aChange(enCache, rep);
                await cache.put(req, rep.clone());
                // Une nouvelle version du programme est arrivée : on le dit, mais on ne
                // recharge pas sous les doigts du patient au milieu d'une série.
                if (neuf && req.mode === "navigate")
                    prevenirLesOnglets();
            }
            return rep;
        }).catch(() => null);
        if (enCache) {
            // La requête réseau continue en arrière-plan même si l'on répond depuis le cache.
            e.waitUntil(versReseau);
            return enCache;
        }
        const rep = await versReseau;
        if (rep)
            return rep;
        // Premier passage sans réseau, ou fichier jamais mis en cache.
        return new Response("Cette page n'est pas disponible hors ligne.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    })());
});
