// Ouvre index.html et en sort ce qu'il faut aux contrôles : le script applicatif, les
// feuilles de style, et les données de contenu.
//
// L'application est un fichier unique, sans étape de compilation. Il n'y a donc pas de module
// à importer : on découpe le HTML, et pour atteindre les données on exécute le script dans un
// environnement où React et le document sont remplacés par des leurres. C'est le seul moyen
// d'inspecter les 955 exercices sans les recopier ailleurs — une copie finirait par diverger,
// ce qui est précisément le défaut que ces contrôles cherchent.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ICI = dirname(fileURLToPath(import.meta.url));
export const RACINE = join(ICI, "..");

export function lireFichier(nom = "index.html") {
    return readFileSync(join(RACINE, nom), "utf8");
}

/** Les contenus de chaque <script> du document, dans l'ordre. */
export function blocsScript(html) {
    const re = /<script([^>]*)>/g;
    const out = [];
    let m;
    while ((m = re.exec(html))) {
        const debut = re.lastIndex;
        const fin = html.indexOf("</script>", debut);
        out.push({ attributs: m[1], code: html.slice(debut, fin), debut });
    }
    return out;
}

/** Les contenus de chaque <style> du document, dans l'ordre. */
export function blocsStyle(html) {
    const re = /<style([^>]*)>/g;
    const out = [];
    let m;
    while ((m = re.exec(html))) {
        const debut = re.lastIndex;
        out.push(html.slice(debut, html.indexOf("</style>", debut)));
    }
    return out;
}

/**
 * Le script de l'application : le plus gros des blocs, celui qui contient les données et les
 * écrans. Le repérer par sa taille plutôt que par son rang évite de casser si un petit script
 * est ajouté avant lui.
 */
export function scriptApplicatif(html) {
    return blocsScript(html).reduce((a, b) => (b.code.length > a.code.length ? b : a)).code;
}

/**
 * Exécute le script applicatif avec des leurres à la place de React et du document, et rend
 * les valeurs demandées. Les composants ne sont jamais rendus : seules les données comptent.
 */
export async function donnees(html, noms) {
    const code = scriptApplicatif(html);
    // On remplace le montage — les deux lignes qui accrochent l'application au document — par
    // l'export des valeurs voulues. Les commenter ne suffirait pas : « root.render » resterait
    // sur la ligne suivante et l'application signalerait une erreur de chargement.
    const montage = /const root = ReactDOM\.createRoot\([\s\S]*?\);\s*root\.render\([\s\S]*?\);/;
    if (!montage.test(code))
        throw new Error("point de montage introuvable dans le script applicatif");
    const prepare = code.replace(montage, `globalThis.__DONNEES = { ${noms.join(", ")} };`);

    const leurreElement = (type, props, ...enfants) => ({ type, props, enfants });
    globalThis.React = {
        createElement: leurreElement,
        Fragment: "Fragment",
        useState: (v) => [typeof v === "function" ? v() : v, () => {}],
        useEffect: () => {},
        useRef: () => ({ current: null }),
        useMemo: (f) => f(),
    };
    globalThis.ReactDOM = { createRoot: () => ({ render() {} }) };
    globalThis.document = {
        getElementById: () => ({ set textContent(v) {}, set innerHTML(v) {}, style: {} }),
        createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 0 }) }), style: {} }),
        documentElement: { style: {} },
        addEventListener() {},
    };
    globalThis.window = undefined;
    // « navigator » est en lecture seule sous Node : on le neutralise par redéfinition.
    Object.defineProperty(globalThis, "navigator", { value: undefined, configurable: true });

    // eslint-disable-next-line no-new-func
    new Function(prepare)();
    return globalThis.__DONNEES;
}

/** Tous les exercices de tous les parcours, avec le chemin où ils se trouvent. */
export function tousLesExercices(racines) {
    const out = [];
    const descendre = (noeud, chemin) => {
        if (Array.isArray(noeud)) {
            noeud.forEach((x, i) => descendre(x, chemin));
            return;
        }
        if (!noeud || typeof noeud !== "object")
            return;
        for (const [cle, valeur] of Object.entries(noeud)) {
            if (cle === "exercises" && Array.isArray(valeur)) {
                const ou = noeud.label || noeud.name || noeud.id || chemin;
                valeur.forEach((ex) => out.push({ ex, ou }));
                continue;
            }
            descendre(valeur, noeud.label || noeud.name || noeud.id || chemin);
        }
    };
    for (const [nom, r] of Object.entries(racines))
        descendre(r, nom);
    return out;
}
