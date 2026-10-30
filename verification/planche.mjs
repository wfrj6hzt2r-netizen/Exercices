// La planche de relecture des pictogrammes : chaque exercice de l'application, sa consigne,
// et le dessin qu'elle lui sert vraiment, à juger « juste » ou « faux » par le praticien.
//
// La relecture des 84 pictogrammes (#75) jugeait les dessins un par un ; or un dessin juste
// pour un exercice peut être faux pour un autre, et c'est l'exercice que le patient lit. Le
// praticien a demandé à tout revoir « tranquillement, sans avoir à parcourir l'application ».
//
//   node verification/planche.mjs            écrit verification/captures/planche-pictogrammes.html
//
// La page est publiée comme artifact, toujours à la même adresse — https://claude.ai/artifact/PyPnZ8mpnj8M5kWFd4UjAa —
// et ses verdicts vivent dans la base de l'artifact (collection « verdicts »), pas dans la
// page : republier la planche régénérée ne perd rien. Pour la mettre à jour, republier ce
// fichier à cette adresse ; pour lire les verdicts, lister la collection « verdicts ».
//
// La clé d'une fiche réunit le nom, le dessin, une empreinte du tracé et une empreinte de la
// consigne. Un dessin redessiné, une affectation changée ou une consigne réécrite donnent
// une clé nouvelle : la fiche repasse d'elle-même en « à juger », et l'ancien verdict ne
// couvre jamais ce qu'il n'a pas vu.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { lireFichier, donnees, RACINE } from "./lire.mjs";

const D = await donnees(lireFichier(), ["PATHOLOGIES", "RUNNER_DATA", "CROISSANCE_DATA",
    "PREVENTION_CATEGORIES", "POSES", "getExerciseIcon"]);

// Les composants ne sont jamais rendus par React ici : lire.mjs les remplace par des leurres
// { type, props, enfants }, qu'on écrit en SVG à la main.
const ATTRIBUTS = { strokeWidth: "stroke-width", strokeLinecap: "stroke-linecap", strokeLinejoin: "stroke-linejoin",
    strokeDasharray: "stroke-dasharray", fillOpacity: "fill-opacity", strokeOpacity: "stroke-opacity",
    textAnchor: "text-anchor", fontSize: "font-size", fontWeight: "font-weight",
    markerEnd: "marker-end", markerStart: "marker-start" };
function enSvg(el) {
    if (el == null || el === false) return "";
    if (Array.isArray(el)) return el.map(enSvg).join("");
    if (typeof el !== "object") return String(el);
    const enfants = (el.enfants || []).map(enSvg).join("");
    if (el.type === "Fragment") return enfants;
    if (typeof el.type === "function") return enSvg(el.type(el.props || {}));
    const attrs = Object.entries(el.props || {})
        .filter(([k, v]) => v != null && k !== "key" && k !== "style" && k !== "children")
        .map(([k, v]) => `${ATTRIBUTS[k] || k}="${String(v).replace(/"/g, "&quot;")}"`).join(" ");
    return `<${el.type}${attrs ? " " + attrs : ""}>${enfants}</${el.type}>`;
}
const empreinte = (s, n) => createHash("sha1").update(s).digest("hex").slice(0, n);

// Plusieurs règles de POSES partagent parfois un même composant : la première nomme le dessin.
const cleDuDessin = new Map();
for (const p of D.POSES)
    if (!cleDuDessin.has(p.icon)) cleDuDessin.set(p.icon, p.key);

const dessins = {};
const fiches = new Map();
function ajouter(ex, chemin) {
    if (!ex || !ex.name || !ex.tip) return;
    const icone = D.getExerciseIcon(ex.name, ex.tip);
    const pose = cleDuDessin.get(icone) || "advice";
    if (!dessins[pose])
        dessins[pose] = enSvg(icone({ size: 48 })).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    const slug = ex.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    const k = `${slug}--${pose}-${empreinte(dessins[pose], 6)}-${empreinte(ex.tip, 4)}`;
    if (!fiches.has(k))
        fiches.set(k, { k, nom: ex.name, dose: ex.dose || "", consigne: ex.tip, pose, ou: [] });
    const f = fiches.get(k);
    if (!f.ou.includes(chemin)) f.ou.push(chemin);
}
// Le chemin affiché (« Genou › Entorse › Mobilité & œdème ») suit les intitulés rencontrés en
// descendant ; un exercice porte un nom mais pas d'intitulé, il ne s'y ajoute donc pas.
function descendre(noeud, chemin) {
    if (Array.isArray(noeud)) { noeud.forEach((x) => descendre(x, chemin)); return; }
    if (!noeud || typeof noeud !== "object") return;
    const intitule = noeud.label || noeud.title || noeud.name;
    const ici = intitule && !noeud.tip ? [...chemin, intitule] : chemin;
    for (const [cle, valeur] of Object.entries(noeud)) {
        if (cle === "exercises" && Array.isArray(valeur)) { valeur.forEach((ex) => ajouter(ex, ici.join(" › "))); continue; }
        if (valeur && typeof valeur === "object") descendre(valeur, ici);
    }
}
descendre(D.PATHOLOGIES, []);
descendre(D.RUNNER_DATA, ["Coureur"]);
descendre(D.CROISSANCE_DATA, ["Croissance"]);
descendre(D.PREVENTION_CATEGORIES, ["Prévention"]);

// « </ » fermerait la balise <script> qui porte les données.
const json = JSON.stringify({ dessins, exercices: [...fiches.values()] }).replace(/<\//g, "<\\/");
const page = readFileSync(join(RACINE, "verification", "planche-modele.html"), "utf8").replace("__DONNEES__", () => json);
const dossier = join(RACINE, "verification", "captures");
mkdirSync(dossier, { recursive: true });
const sortie = join(dossier, "planche-pictogrammes.html");
writeFileSync(sortie, page);
console.log(`${fiches.size} fiches, ${Object.keys(dessins).length} dessins → ${sortie}`);
