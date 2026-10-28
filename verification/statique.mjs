// Contrôles qui se passent d'un navigateur : ils lisent le fichier et le contenu.
//
// Chacun correspond à un défaut réellement survenu, pas à une règle imaginée. Un contrôle qui
// n'a jamais rien attrapé finit par être ignoré ; ceux-ci ont tous une histoire.
//
//   node verification/statique.mjs

import { lireFichier, blocsStyle, scriptApplicatif, donnees, tousLesExercices } from "./lire.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RACINE } from "./lire.mjs";

const html = lireFichier();
const app = scriptApplicatif(html);
const echecs = [];
const rapport = [];

function controle(nom, fn) {
    let detail;
    try {
        detail = fn();
    } catch (e) {
        echecs.push({ nom, lignes: ["le contrôle lui-même a échoué : " + e.message] });
        rapport.push({ nom, etat: "ERREUR", note: e.message });
        return;
    }
    const lignes = detail || [];
    if (lignes.length) {
        echecs.push({ nom, lignes });
        rapport.push({ nom, etat: "ÉCHEC", note: lignes.length + " cas" });
    } else {
        rapport.push({ nom, etat: "ok", note: "" });
    }
}

// --- 1. Le script se compile ---------------------------------------------------------
// Trois fois cette semaine, une parenthèse en trop ou en moins a produit un écran blanc.
controle("le script applicatif se compile", () => {
    try {
        // eslint-disable-next-line no-new-func
        new Function(app);
        return [];
    } catch (e) {
        return [e.message];
    }
});

// --- 1 bis. Tout symbole majuscule employé est déclaré ---------------------------------
// En retirant un bloc de code, une constante voisine est partie avec — « DOSE_NON_REP ».
// Le script compilait toujours, les onze contrôles de contenu passaient, et pourtant cinq
// écrans d'exercices ne s'affichaient plus : un identifiant absent n'est une erreur qu'à
// l'exécution, et seulement sur le chemin qui l'emprunte.
//
// On ne regarde que les identifiants commençant par une majuscule : dans ce fichier, ce
// sont les constantes et les composants, c'est-à-dire ce qui se déclare au premier niveau.
// Les variables locales, en minuscules, demanderaient un vrai analyseur syntaxique, alors
// que l'accident porte toujours sur une déclaration de tête.
const GLOBALES_CONNUES = new Set([
    "React", "ReactDOM", "Math", "JSON", "Object", "Array", "String", "Number", "Boolean",
    "Date", "Set", "Map", "WeakMap", "WeakSet", "Promise", "RegExp", "Error", "TypeError",
    "Symbol", "Intl", "URL", "URLSearchParams", "Blob", "FileReader", "Image", "Infinity",
    "NaN", "Function", "Proxy", "Reflect", "BigInt", "AbortController", "TextEncoder",
    "TextDecoder", "Uint8Array", "ArrayBuffer", "DOMParser", "XMLSerializer", "Notification",
    "ResizeObserver", "IntersectionObserver", "MutationObserver", "CustomEvent", "Event",
]);
/**
 * Rend le script débarrassé de ce qui n'est pas du code : commentaires, chaînes, texte des
 * gabarits, corps des expressions régulières. Les interpolations « ${…} » sont conservées,
 * elles contiennent de vraies références.
 *
 * Écrit à la main, caractère par caractère. Une expression régulière ne suffit pas : celle
 * qui tentait d'apparier les gabarits avalait deux cent quarante mille caractères de code
 * d'un seul tenant, et le contrôle accusait alors des constantes parfaitement déclarées.
 */
function codeSeul(src) {
    const out = [];
    const pile = [];          // imbrication des gabarits et de leurs accolades
    let i = 0;
    let dernierUtile = "";    // dernier caractère de code, pour distinguer « / » d'une regex
    const pousser = (c) => { out.push(c); if (!/\s/.test(c)) dernierUtile = c; };
    // Une chaîne, un gabarit ou une expression régulière se réduit à un jeton neutre, isolé
    // par des espaces : sans eux, « ${BORDURE} » se relisait « BORDURE00 » et le contrôle
    // signalait un symbole qui n'a jamais existé.
    const jeton = () => { out.push(" "); pousser("0"); out.push(" "); };
    const MOTS_CLES = /^(?:return|typeof|instanceof|case|in|of|new|delete|void|do|else|yield|await|throw)$/;
    // Le dernier caractère ne suffit pas à trancher : après « return », « typeof » ou
    // « case », une barre oblique ouvre bien une expression régulière et non une division.
    // C'est ce cas qui a d'abord fait lire « /\\d+…/ » comme un quotient, puis prendre sa
    // barre de fermeture pour une ouverture — et avaler la suite du fichier.
    const valeurAvant = () => {
        if (!/[\w$)\]]/.test(dernierUtile))
            return false;
        if (!/[\w$]/.test(dernierUtile))
            return true;
        let k = out.length - 1;
        while (k >= 0 && /\s/.test(out[k])) k--;
        let mot = "";
        while (k >= 0 && /[\w$]/.test(out[k])) { mot = out[k] + mot; k--; }
        return !MOTS_CLES.test(mot);
    };
    while (i < src.length) {
        const c = src[i], d = src[i + 1];
        // Le texte d'un gabarit passe avant tout le reste. Sinon une apostrophe française
        // y ouvrirait une chaîne, et « // » un commentaire : le lecteur perdait alors des
        // milliers de caractères de code, et le contrôle accusait des constantes
        // parfaitement déclarées d'être absentes.
        if (pile[pile.length - 1] === "gabarit") {
            if (c === "\\") { i += 2; continue; }
            if (c === "`") { pile.pop(); i++; jeton(); continue; }
            if (c === "$" && d === "{") { pile.push("expr"); i += 2; out.push(" "); continue; }
            i++; continue;
        }
        if (c === "/" && d === "*") { const j = src.indexOf("*/", i + 2); out.push(" "); i = j < 0 ? src.length : j + 2; continue; }
        if (c === "/" && d === "/") { const j = src.indexOf("\n", i); out.push(" "); i = j < 0 ? src.length : j; continue; }
        if (c === '"' || c === "'") {
            i++;
            while (i < src.length && src[i] !== c) i += src[i] === "\\" ? 2 : 1;
            i++; jeton(); continue;
        }
        if (c === "`") { pile.push("gabarit"); i++; continue; }
        if (c === "{" && pile.length) { pile.push("accolade"); pousser(c); i++; continue; }
        if (c === "}" && pile.length && pile[pile.length - 1] !== "gabarit") {
            const quoi = pile.pop();
            // Refermer une interpolation rend au gabarit son texte ; refermer une accolade
            // ordinaire laisse l'expression en cours.
            if (quoi === "expr") jeton();
            else pousser(c);
            i++; continue;
        }
        if (c === "/" && !valeurAvant()) {
            i++;
            let classe = false;
            while (i < src.length) {
                if (src[i] === "\\") { i += 2; continue; }
                if (src[i] === "[") classe = true;
                else if (src[i] === "]") classe = false;
                else if (src[i] === "/" && !classe) break;
                i++;
            }
            i++;
            while (i < src.length && /[a-z]/.test(src[i])) i++;
            jeton(); continue;
        }
        pousser(c); i++;
    }
    return out.join("");
}
controle("tout symbole majuscule employé est déclaré", () => {
    const code = codeSeul(app)
        .replace(/\.\s*[A-Za-z_$][\w$]*/g, ".x")            // accès à une propriété
        .replace(/([{,]\s*)[A-Za-z_$][\w$]*(\s*:)/g, "$1k$2"); // clé d'objet littéral

    const declares = new Set();
    for (const re of [/\b(?:const|let|var)\s+([A-Z][\w$]*)/g, /\bfunction\s+([A-Z][\w$]*)/g,
        /\bclass\s+([A-Z][\w$]*)/g]) {
        let m;
        while ((m = re.exec(code)))
            declares.add(m[1]);
    }
    let g;
    const groupe = /\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g;
    while ((g = groupe.exec(code)))
        g[1].split(",").forEach((x) => {
            const nom = x.split(":").pop().trim();
            if (/^[A-Z][\w$]*$/.test(nom))
                declares.add(nom);
        });

    const manquants = new Map();
    const ref = /\b([A-Z][A-Za-z0-9_$]*)\b/g;
    let m;
    while ((m = ref.exec(code))) {
        const nom = m[1];
        if (declares.has(nom) || GLOBALES_CONNUES.has(nom) || manquants.has(nom))
            continue;
        const autour = code.slice(Math.max(0, m.index - 55), m.index + nom.length + 15)
            .replace(/\s+/g, " ").trim();
        manquants.set(nom, `« ${nom} » n'est déclaré nulle part — …${autour}…`);
    }
    return [...manquants.values()];
});

// --- 2. Toute classe employée est définie ---------------------------------------------
// « pb-4 », « pb-8 », « gap-5 », « mt-2.5 » et « mt-3.5 » n'existaient pas dans le Tailwind
// figé de cette page : elles ne faisaient rien, sans le moindre signe.
controle("toute classe employée est définie", () => {
    const definies = new Set();
    for (const css of blocsStyle(html)) {
        const re = /\.((?:[A-Za-z0-9_-]|\\.)+)/g;
        let m;
        while ((m = re.exec(css)))
            definies.add(m[1].replace(/\\/g, ""));
    }
    const employees = new Map();
    const noter = (chaine) => {
        for (const nom of chaine.split(/\s+/).filter(Boolean))
            employees.set(nom, (employees.get(nom) || 0) + 1);
    };
    const re = /className: "([^"]*)"/g;
    let m;
    while ((m = re.exec(app)))
        noter(m[1]);
    return [...employees.keys()].filter((n) => !definies.has(n))
        .map((n) => `« ${n} » employée ${employees.get(n)} fois, jamais définie`);
});

// --- 3. Les couleurs restent dans la palette ------------------------------------------
// Trente valeurs écrites en dur au point d'usage avaient fini par diverger : deux gris de
// prose presque identiques, sept verts pour trois rôles.
controle("aucune couleur hors de la palette", () => {
    const lignes = app.split("\n");
    const dansPalette = (i) => {
        const l = lignes[i];
        return /^\s*const\s+[A-Z_]+\s*=\s*"[^"]*"\s*;/.test(l);
    };
    const permis = /MANNEQUIN_|#FFFFFF|#fff\b/;
    const out = [];
    lignes.forEach((l, i) => {
        if (dansPalette(i) || permis.test(l))
            return;
        for (const c of l.match(/"#[0-9A-Fa-f]{6}"/g) || [])
            out.push(`${c} écrit en dur — ${l.trim().slice(0, 90)}`);
    });
    return out;
});

// --- 4. Pas d'emoji couleur dans l'interface ------------------------------------------
// Quatre emoji système servaient d'icônes au milieu de pictogrammes dessinés ; le dernier a
// survécu à une passe de remplacement parce qu'il était écrit en clair et non échappé.
controle("aucun emoji couleur dans l'interface", () => {
    const out = [];
    app.split("\n").forEach((l, i) => {
        const trouves = l.match(/[\u{1F300}-\u{1FAFF}]|⚠️/gu);
        if (trouves)
            out.push(`${[...new Set(trouves)].join(" ")} — ${l.trim().slice(0, 90)}`);
    });
    return out;
});

// Exécuter le script pour en extraire les données, c'est le compiler une seconde fois. Une
// parenthèse manquante ou un symbole non déclaré jetait ici, avant que le rapport ne soit
// imprimé : les deux premiers contrôles avaient beau voir le défaut, leur message n'arrivait
// jamais à l'écran, remplacé par une trace de pile. On rattrape donc, on dit lequel des deux
// l'a vu, et on s'arrête proprement.
let D;
let panne = null;
try {
    D = await donnees(html, ["PATHOLOGIES", "RUNNER_DATA", "CROISSANCE_DATA",
        "PREVENTION_CATEGORIES", "POSTURE_DESSIN", "DESSIN_AUTRE_POSTURE", "postureDecrite",
        "posturesFines",
        "GLOSSARY", "findGlossaryTerm", "lexiqueParLettre", "initialeLexique",
        "LEXIQUE_SEUL",
        "getExerciseIcon", "POSES", "demandeUnElastique", "POURQUOI_ETAPE",
        "positionAffichable", "familleEffort", "repereEffort", "REPERE_EFFORT",
        "SANS_REPERE_EFFORT",
        "REPERE_EFFORT_TU",
        "REALISTIC_MARKERS", "LIBELLE_CIBLE_H", "LIBELLE_CIBLE_MARGE",
        "PARCOURS_DU_LIEN", "RUNNER_DATA", "CROISSANCE_DATA", "injuriesOrdonnees",
        "construireRoute", "phasesDe",
        "LIBELLE_LARGEUR_CAR", "VUE_X1", "VUE_X2"]);
} catch (e) {
    panne = e.message;
}
// Une erreur pendant le rendu ne remonte pas jusqu'ici : React l'attrape, l'écrit sur la
// sortie d'erreur et laisse « donnees » rendre undefined. Le symptôme n'est alors pas une
// exception mais une absence, qu'il faut traiter pareil.
if (!panne && (!D || !D.PATHOLOGIES))
    panne = "le script s'est interrompu sans livrer ses données — voir l'erreur au-dessus";
if (panne) {
    for (const r of rapport)
        console.log(`${r.etat === "ok" ? "  ok  " : "ÉCHEC "} ${r.nom}  ${r.note}`);
    console.log(`\nÉCHEC  le script ne s'exécute pas : ${panne}`);
    console.log("Les contrôles qui lisent le contenu n'ont pas pu être menés.");
    process.exit(1);
}
const exercices = tousLesExercices({
    blessure: D.PATHOLOGIES, coureur: D.RUNNER_DATA,
    croissance: D.CROISSANCE_DATA, prevention: D.PREVENTION_CATEGORIES,
});

// --- 5. Chaque exercice est complet ---------------------------------------------------
controle("chaque exercice a un nom, une dose et une consigne", () => exercices
    .filter(({ ex }) => !ex.name || !ex.dose || !ex.tip)
    .map(({ ex, ou }) => `${ou} — « ${ex.name || "sans nom"} » : ` +
        [!ex.name && "nom", !ex.dose && "dose", !ex.tip && "consigne"].filter(Boolean).join(", ") + " manquant"));

// --- 6. Les consignes sont ponctuées --------------------------------------------------
// Demandé explicitement lors de la relecture de mise en page : une consigne qui s'arrête sans
// point se lit comme tronquée.
controle("chaque consigne se termine par un point", () => exercices
    .filter(({ ex }) => ex.tip && !/[.!?…]\s*$/.test(ex.tip))
    .map(({ ex, ou }) => `${ou} — « ${ex.name} » : « …${ex.tip.slice(-40)} »`));

// --- 7. Le pictogramme ne contredit pas la consigne -----------------------------------
// Quarante-neuf pictogrammes montraient une posture que leur consigne contredisait — un
// bonhomme allongé pour un exercice décrit assis.
//
// Ce contrôle a lui aussi cessé de pouvoir échouer. Il lisait « getExerciseIcon », qui
// résout déjà les contradictions : quand la règle choisit une pose que la consigne dément,
// la fonction bascule sur « DESSIN_AUTRE_POSTURE », et à défaut sur le pictogramme neutre.
// Le dessin rendu était donc toujours d'accord avec la consigne, ou muet. Quarante exercices
// passent aujourd'hui par cette bascule, et elle fait bien son travail.
//
// On vérifie donc ce que la bascule ne garantit pas : qu'elle aboutisse. Deux issues restent
// des défauts — un remplaçant qui contredit à son tour la consigne, et l'absence de tout
// remplaçant, qui laisse l'exercice sans dessin propre.
controle("le pictogramme ne contredit pas la consigne", () => {
    if (!D.getExerciseIcon || !D.postureDecrite || !D.POSTURE_DESSIN)
        throw new Error("les fonctions de pictogramme ne sont pas exposées");
    const clePose = new Map((D.POSES || []).map((p) => [p.icon, p.key]));
    const NEUTRES = new Set((D.POSES || []).filter((p) => p.key.startsWith("advice")).map((p) => p.icon));
    const out = [];
    const vus = new Set();
    for (const { ex, ou } of exercices) {
        if (vus.has(ex.name))
            continue;
        vus.add(ex.name);
        // La consigne nomme une posture, parfois deux quand elle laisse le choix — « Assis
        // ou allongé ». Aucune : rien à contredire.
        const decrites = [].concat(D.postureDecrite(ex.tip) || []);
        const decrite = decrites.join(" ou ");
        if (!decrites.length)
            continue; // la consigne ne dit pas la posture : rien à contredire
        const rendue = D.getExerciseIcon(ex.name, ex.tip);
        const cle = clePose.get(rendue);
        // Le pictogramme neutre porte une clé comme les autres — « advice » —, si bien que
        // le reconnaître à l'absence de clé ne marchait pas. On le reconnaît à son icône.
        if (!cle || NEUTRES.has(rendue)) {
            const choisie = (D.POSES || []).find((p) => p.test(ex.name.toLowerCase(), (ex.tip || "").toLowerCase()));
            if (choisie && !NEUTRES.has(choisie.icon) && D.POSTURE_DESSIN[choisie.key])
                out.push(`${ou} — « ${ex.name} » : la pose « ${choisie.key} » contredit « ${decrite} » sans remplaçant, le dessin retombe sur le pictogramme neutre`);
            continue;
        }
        const montree = D.POSTURE_DESSIN[cle];
        if (montree && !decrites.includes(montree))
            out.push(`${ou} — « ${ex.name} » : dessin « ${montree} », consigne « ${decrite} »`);
    }
    return out;
});

// --- 8. L'élastique a toujours un repli -----------------------------------------------
// Demandé lors de la relecture : un patient sans élastique ne doit pas rester bloqué.
//
// Ce contrôle a passé des mois à ne rien vérifier. Il appelait « demandeUnElastique(ex.tip) »
// en lui passant une chaîne là où la fonction attend l'exercice : « ex.name » et « ex.tip »
// y valaient undefined, la recherche portait donc sur une chaîne vide et ne trouvait jamais
// rien. Il exigeait par ailleurs un champ « sansElastique » qui n'existe dans aucun exercice
// — l'application a cessé de porter le repli à la main et le déduit désormais du texte. Un
// contrôle vert qui ne peut pas rougir est pire que pas de contrôle : il rassure.
//
// Trois choses sont donc vérifiées, dont la première garde contre cette panne-là.
const ACCESSOIRE_ELASTIQUE = /th[ée]ra-?band|[ée]lastiband|bande de r[ée]sistance|tube de r[ée]sistance|bande de tirage/i;
const REPLI_DEJA_DIT = /sans\s+[ée]lastique|[ée]lastique\s+n'est pas|si vous n'avez pas d'[ée]lastique|à défaut d'[ée]lastique/i;
controle("tout exercice à élastique offre une version sans", () => {
    if (!D.demandeUnElastique)
        throw new Error("le repérage des élastiques n'est pas exposé");
    const out = [];
    const vus = new Set();
    let reperes = 0;
    for (const { ex, ou } of exercices) {
        if (D.demandeUnElastique(ex))
            reperes++;
        if (vus.has(ex.name))
            continue;
        vus.add(ex.name);
        const texte = ex.name + " " + (ex.tip || "");
        // Le repli ne s'affiche que si le mot « élastique » paraît. Nommer l'accessoire
        // autrement le ferait disparaître sans bruit, et le patient resterait bloqué.
        if (!D.demandeUnElastique(ex) && ACCESSOIRE_ELASTIQUE.test(texte))
            out.push(`${ou} — « ${ex.name} » nomme un élastique sans employer le mot : aucun repli ne sera proposé`);
        // L'inverse : une consigne qui dit déjà quoi faire sans élastique se verrait doubler
        // par le paragraphe ajouté.
        if (D.demandeUnElastique(ex) && REPLI_DEJA_DIT.test(ex.tip || ""))
            out.push(`${ou} — « ${ex.name} » : la consigne dit déjà le repli, qui sera répété dessous`);
    }
    // La panne d'origine, rendue impossible : si plus aucun exercice n'est repéré, c'est le
    // repérage lui-même qui est cassé, non le contenu qui s'est assagi.
    if (!reperes)
        out.push("aucun exercice à élastique repéré sur " + exercices.length + " : le repérage ne fonctionne plus");
    return out;
});

// Les conseils des premiers jours sont du contenu clinique au même titre qu'une consigne :
// ils se lisent tronqués sans leur point final, et une blessure qui n'en a aucun laisse
// l'étape la plus décisive du parcours sans autre chose que des exercices.
controle("chaque blessure a des conseils pour les premiers jours", () => {
    const out = [];
    D.PATHOLOGIES.forEach((z) => z.injuries.forEach((i) => {
        const l = i.premiersJours;
        if (!Array.isArray(l) || !l.length) {
            out.push(`${z.label} — « ${i.label} » : aucun conseil`);
            return;
        }
        l.forEach((t) => {
            if (typeof t !== "string" || t.trim().length < 20)
                out.push(`${z.label} — « ${i.label} » : conseil vide ou trop court`);
            else if (!/[.!?]$/.test(t.trim()))
                out.push(`${z.label} — « ${i.label} » : « ${t.slice(-40)} » ne finit pas par un point`);
        });
    }));
    return out;
});

// « Mobilité complète en charge fonctionnelle » affichait l'étiquette « Debout » juste à
// côté d'un dessin de silhouette allongée. Le contrôle précédent ne l'a pas vu : il compare
// le dessin à la posture décrite dans la consigne, or celle-ci n'en nommait aucune. C'est
// l'étiquette — ce que le patient lit, à deux centimètres du dessin — qu'il fallait aussi
// comparer. Les deux contrôles sont gardés : ils lisent des sources différentes.
controle("l'étiquette de position ne contredit pas le dessin", () => {
    const MOT = { "Debout": "debout", "Assis": "assis", "Allongé": "allonge",
        "À quatre pattes": "quatre", "Sur le ventre": "ventre" };
    const cle = (icone) => (D.POSES.find((p) => p.icon === icone) || {}).key;
    const vus = new Set();
    const out = [];
    // Une consigne qui ouvre sur un choix — « En planche ou à quatre pattes » — ne peut pas
    // être résumée par une étiquette qui n'en nomme qu'une : elle contredit l'autre moitié des
    // lecteurs. Le gainage dynamique annonçait « À plat ventre ».
    const choix = /\bou\b/;
    for (const { ex, ou } of exercices) {
        const etiquette = D.positionAffichable(ex.name, ex.tip);
        const ouverture = (ex.tip || "").slice(0, 90);
        const offertes = D.posturesFines(ouverture);
        const nommees = D.posturesFines(etiquette || "");
        if (etiquette && choix.test(ouverture) && offertes.length > 1
            && offertes.some((x) => nommees.indexOf(x) === -1)) {
            if (!vus.has(ex.name)) {
                vus.add(ex.name);
                out.push(`${ou} — « ${ex.name} » : étiquette « ${etiquette} », mais la consigne laisse le choix`);
            }
            continue;
        }
        if (!etiquette || vus.has(ex.name))
            continue;
        const dessin = D.POSTURE_DESSIN[cle(D.getExerciseIcon(ex.name, ex.tip))];
        const attendu = MOT[etiquette];
        if (dessin && attendu && dessin !== attendu) {
            vus.add(ex.name);
            out.push(`${ou} — « ${ex.name} » : étiquette « ${etiquette} », dessin « ${dessin} »`);
        }
    }
    return out;
});

// Le repère d'effort se déduit du nom et de la consigne. Cinq pièges rencontrés en
// l'écrivant : « Montée de marche » pris pour de la marche, « Balancers » pour un lancer,
// « Squat mural maintenu » pour de la charge lourde, « Extension sur rouleau » pour du
// renforcement, et la glace après le sport — dix minutes — pour des répétitions. Le contrôle
// vérifie donc les deux sens : tout exercice compté en répétitions reçoit un repère sauf
// s'il est de mobilité, et aucun repère ne contredit sa consigne.
controle("le repère d'effort ne contredit pas la consigne", () => {
    // La liste des exercices dispensés de repère est lue dans l'application, et non recopiée
    // ici : les deux copies avaient divergé d'un motif — « soulagement », sans effet puisque
    // les deux exercices concernés commencent par « Position ». Le contrôle ne vérifie donc
    // plus l'accord entre deux listes, mais que la seule façon de se passer de repère est
    // d'y figurer : toute autre sortie à vide ajoutée à « familleEffort » sera signalée.
    const mobilite = D.SANS_REPERE_EFFORT;
    if (!(mobilite instanceof RegExp))
        throw new Error("la liste des exercices sans repère n'est pas exposée");
    const repetitions = /^\d+\s*×\s*\d+/;
    // Une série comptée en minutes est une position tenue, pas un effort : cinq fois deux
    // minutes de sphinx ne se dosent pas. L'application les écarte aussi.
    const minutes = /^\d+\s*×\s*\d+(-\d+)?\s*min\b/;
    const mou = /sans forcer|sans à-coup|doucement|sans r[ée]sistance/i;
    const basse = /faible intensit[ée]|doucement|amplitude confortable|tension l[ée]g[èe]re|sans forcer sur la douleur/i;
    const immobile = /gardez? le (?:bas du dos|dos|bassin)[^.]{0,40}immobile|sans que le (?:bassin|bas du dos|dos)[^.]{0,30}bouge|en gardant le dos (?:parfaitement )?stable/i;
    const out = [];
    const vus = new Set();
    for (const { ex, ou } of exercices) {
        if (vus.has(ex.name))
            continue;
        vus.add(ex.name);
        const f = D.familleEffort(ex);
        const doitAvoir = repetitions.test(ex.dose) && !minutes.test(ex.dose)
            && !mobilite.test(ex.name.toLowerCase());
        if (doitAvoir && !f)
            out.push(`${ou} — « ${ex.name} » (${ex.dose}) : aucun repère d'effort`);
        if (!doitAvoir && f && mobilite.test(ex.name.toLowerCase()))
            out.push(`${ou} — « ${ex.name} » : repère « ${f} » sur un exercice de mobilité`);
        // Un tronc qu'on doit garder immobile ne se dose ni par le déséquilibre ni par la
        // durée d'un maintien. « Stabilité lombo-pelvienne » affichait « cherchez le
        // déséquilibre » sous une consigne disant « gardez le bas du dos immobile », et
        // « Gainage dynamique », compté en répétitions, « pendant tout le maintien ».
        if (immobile.test(ex.tip) && (f === "controle" || f === "maintien"))
            out.push(`${ou} — « ${ex.name} » : repère « ${f} », consigne « ${ex.tip.match(immobile)[0]} »`);
        if ((f === "lourd" || f === "explosif") && mou.test(ex.tip))
            out.push(`${ou} — « ${ex.name} » : repère « ${f} », consigne « ${ex.tip.match(mou)[0]} »`);
        // Une consigne qui prescrit volontairement une intensité basse ne peut pas porter de
        // repère : « contractez fort » sous « contractez doucement » se lisait mot pour mot.
        if (D.repereEffort(ex) && basse.test(ex.tip))
            out.push(`${ou} — « ${ex.name} » : repère affiché, consigne « ${ex.tip.match(basse)[0]} »`);
    }
    return out;
});

// Le parcours croissance affiche les mêmes repères, tutoyés. Deux pannes silencieuses sont
// possibles : une table incomplète — le repère disparaîtrait sans erreur — et un « assez
// lourd » adressé à un enfant dont le programme se fait au poids du corps.
controle("les repères tutoyés couvrent les mêmes familles, sans charge inventée", () => {
    const out = [];
    for (const cle of Object.keys(D.REPERE_EFFORT))
        if (!D.REPERE_EFFORT_TU[cle])
            out.push(`la famille « ${cle} » n'a pas de formulation tutoyée`);
    for (const cle of Object.keys(D.REPERE_EFFORT_TU))
        if (!D.REPERE_EFFORT[cle])
            out.push(`la famille tutoyée « ${cle} » n'existe pas dans la table vouvoyée`);
    for (const { ex, ou } of tousLesExercices({ croissance: D.CROISSANCE_DATA })) {
        const texte = D.repereEffort(ex, true);
        if (!texte)
            continue;
        if (/vous|votre|contractez|arrêtez|cherchez|pourriez/i.test(texte))
            out.push(`${ou} — « ${ex.name} » : repère vouvoyé « ${texte} »`);
        if (D.familleEffort(ex, true) === "lourd"
            && !/lest|charg|haltère|poulie|presse|sac à dos/.test(`${ex.name} ${ex.tip}`.toLowerCase()))
            out.push(`${ou} — « ${ex.name} » : « assez lourd » sans charge nommée`);
    }
    return out;
});

// Six parcours remplacent le rythme par défaut par le leur. Une entrée manquante ne se
// verrait pas en lisant le fichier : l'écran lit « guidance[stageIdx].freq » et se rendrait
// vide sur la dernière étape, celle qu'on ouvre le moins souvent en vérifiant.
controle("chaque rythme propre couvre toutes ses étapes", () => {
    const out = [];
    D.PATHOLOGIES.forEach((z) => z.injuries.forEach((i) => {
        if (!i.stageGuidance)
            return;
        if (i.stageGuidance.length !== i.stages.length)
            out.push(`${z.label} — « ${i.label} » : ${i.stageGuidance.length} rythmes pour ${i.stages.length} étapes`);
        i.stageGuidance.forEach((g, k) => {
            if (!g || !g.freq || !g.duration)
                out.push(`${z.label} — « ${i.label} », étape ${k + 1} : rythme incomplet`);
        });
    }));
    return out;
});

// La table des « pourquoi » est indexée par libellé d'étape. Un libellé mal orthographié
// n'afficherait rien du tout, sans la moindre erreur — le même genre de panne silencieuse
// que les cinq classes d'espacement qui ne faisaient rien. On vérifie donc les deux sens :
// chaque clé de la table désigne bien une étape existante, et on rapporte la couverture.
// Tout le texte de l'application sauf le tableau du glossaire lui-même : noms et consignes
// d'exercice, intitulés d'étape, noms de blessure, et jusqu'aux libellés des boutons — un
// mot comme « Noter ma charge » n'apparaît dans aucune donnée, seulement dans le rendu.
// Les accents y sont tantôt écrits tels quels, tantôt échappés : on décode avant de chercher.
function corpusSansGlossaire() {
    const debut = app.indexOf("const GLOSSARY = {");
    if (debut < 0)
        throw new Error("tableau GLOSSARY introuvable");
    const fin = app.indexOf("\n};", debut);
    const sansTable = app.slice(0, debut) + app.slice(fin + 3);
    // Les commentaires sortent aussi, et ce n'est pas un détail : la première version de ce
    // contrôle passait parce que le commentaire de l'écran du lexique citait en exemple les
    // trois mots que l'application n'écrit nulle part. Un contrôle qui se lit lui-même ne
    // vérifie rien. Le « // » précédé de deux points est épargné : c'est une adresse web.
    const sansCommentaires = sansTable
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
    return sansCommentaires.replace(/\\u([0-9a-fA-F]{4})/g,
        (_, h) => String.fromCharCode(parseInt(h, 16))).toLowerCase();
}
controle("chaque mot du lexique est écrit quelque part dans l'application", () => {
    // Une définition qui explique un mot que l'application n'emploie jamais ne sera lue par
    // personne, et ne sera donc jamais corrigée : « scapulo » a vécu ainsi depuis sa
    // création. Le contrôle portait d'abord sur les seules cartes d'exercice, du temps où
    // la pastille « i » était la seule porte ; l'écran du lexique les montre maintenant
    // toutes, et c'est donc l'emploi du mot, non son affichage, qu'il reste à vérifier.
    const texte = corpusSansGlossaire();
    return Object.keys(D.GLOSSARY || {})
        .filter((terme) => !texte.includes(terme.toLowerCase()))
        .map((terme) => `« ${terme} » : l'application n'écrit ce mot nulle part`);
});
controle("aucun mot du lexique n'est masqué par un autre", () => {
    // « findGlossaryTerm » rend le premier terme contenu dans le texte, dans l'ordre du
    // tableau. Un mot placé après un autre qui le contient ne sort donc jamais : « abdomino-
    // adducteurs », derrière « adducteurs », a expliqué l'intérieur de la cuisse pendant
    // des mois là où la carte écrivait le mot composé. On demande à chaque mot de se
    // reconnaître lui-même.
    return Object.keys(D.GLOSSARY || {})
        .filter((terme) => !D.LEXIQUE_SEUL.has(terme))
        .map((terme) => [terme, D.findGlossaryTerm(terme)])
        .filter(([terme, trouve]) => trouve !== terme)
        .map(([terme, trouve]) => `« ${terme} » est masqué par « ${trouve} », placé avant lui`);
});
// La décision est celle du kinésithérapeute : ces deux mots restent définis mais ne se
// posent sur aucune carte. Le contrôle en garde sa propre copie plutôt que de lire
// l'ensemble du fichier — sa première version le lisait, et le banc de mutation l'a prise
// en défaut : retirer « échauffement » de l'ensemble le rendait aveugle à son propre défaut,
// puisqu'il demandait au code s'il était d'accord avec lui-même.
const RESERVES_AU_LEXIQUE = ["prévention", "échauffement"];
controle("les mots réservés au lexique n'en sortent jamais", () => {
    const out = [];
    for (const mot of RESERVES_AU_LEXIQUE) {
        if (!(mot in (D.GLOSSARY || {})))
            out.push(`« ${mot} » est réservé au lexique mais n'y est pas défini`);
        if (!D.LEXIQUE_SEUL.has(mot))
            out.push(`« ${mot} » ne figure plus parmi les mots réservés`);
    }
    for (const { ex, ou } of exercices) {
        const terme = D.findGlossaryTerm(ex.name) || D.findGlossaryTerm(ex.tip || "");
        if (terme && RESERVES_AU_LEXIQUE.includes(terme))
            out.push(`${ou} — « ${ex.name} » porte la pastille « ${terme} »`);
    }
    return out;
});
controle("l'écran du lexique montre tout le tableau", () => {
    // L'écran se déduit de GLOSSARY, et c'est précisément ce qu'on vérifie : une définition
    // ajoutée au tableau doit y paraître sans qu'on y pense, et le classement par lettre
    // ne doit en perdre aucune en route.
    const cles = Object.keys(D.GLOSSARY || {});
    const montres = D.lexiqueParLettre().flatMap((g) => g.termes);
    const out = cles.filter((t) => !montres.includes(t))
        .map((t) => `« ${t} » est défini mais ne paraît pas dans le lexique`);
    if (montres.length !== cles.length)
        out.push(`le lexique montre ${montres.length} mots pour ${cles.length} définitions`);
    for (const { lettre, termes } of D.lexiqueParLettre())
        for (const t of termes)
            if (D.initialeLexique(t) !== lettre)
                out.push(`« ${t} » est rangé sous ${lettre}`);
    return out;
});
// Les dessins qui ne montrent pas une silhouette entière : un bloc-notes, un pied, une
// tête, un élastique. Ils n'ont pas de posture à déclarer. La liste fait foi — c'est elle
// qu'il faut modifier, en connaissance de cause, pour exempter un dessin de plus.
const SANS_POSTURE = new Set([
    "advice", "advice-late",            // le bloc-notes
    "shoe",                             // une chaussure
    "hand", "wrist", "elbow-mobilise",  // main, poignet, bras seul
    "ankle-pump", "foot-arch",          // une jambe, un pied
    "band", "isometrique",              // un élastique, deux flèches
    "head-rotation", "head-iso-multi", "head-extension", "neck", // tête et nuque
    // À genoux, assis sur les talons : une posture que « postureDecrite » ne nomme pas.
    // La déclarer reviendrait à inventer une sixième valeur que rien ne lirait.
    "child-pose", "nordic-kneel",
]);
controle("tout dessin de silhouette entière déclare sa posture", () => {
    // Le contrôle de cohérence compare la posture que la consigne nomme à celle que le
    // dessin déclare. Un dessin qui n'en déclare aucune n'est comparé à rien : il peut
    // montrer un homme debout sous une consigne qui commence par « allongé sur le dos »,
    // et c'est exactement ce que trois bascules du bassin ont fait pendant des mois, sans
    // qu'aucun des vingt-cinq autres contrôles ne puisse le voir.
    const cles = [...new Set(D.POSES.map((p) => p.key))];
    const out = cles
        .filter((k) => !D.POSTURE_DESSIN[k] && !SANS_POSTURE.has(k))
        .map((k) => `« ${k} » montre une silhouette sans déclarer sa posture`);
    for (const k of SANS_POSTURE)
        if (!cles.includes(k))
            out.push(`« ${k} » est exempté de posture mais n'est plus un dessin`);
    return out;
});
controle("chaque « pourquoi » désigne une étape qui existe", () => {
    const libelles = new Set();
    D.PATHOLOGIES.forEach((z) => z.injuries.forEach((i) => i.stages.forEach((s) => libelles.add(s.label))));
    return Object.keys(D.POURQUOI_ETAPE).filter((k) => !libelles.has(k))
        .map((k) => `« ${k} » ne correspond à aucune étape`);
});

// La vignette de 44 px sur l'écran d'accueil est une copie du PNG, collée dans le fichier.
// Elle a divergé sans bruit : l'icône installée sur le téléphone est passée au marine sur
// voile, la vignette est restée verte sur marine, et le commentaire au-dessus continuait
// d'affirmer que c'était le même dessin. Rien ne l'aurait signalé — ni le navigateur, ni un
// contrôle de rendu, qui ne sait pas à quoi l'image devrait ressembler. On compare donc les
// octets : la vignette doit être icon-192.png, pas une image qui lui ressemble.
controle("la vignette de l'accueil est bien l'icône installée", () => {
    const m = html.match(/const LOGO = "data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
    if (!m) return ["la vignette LOGO est introuvable, ou n'est plus un PNG en base64"];
    const embarquee = Buffer.from(m[1], "base64");
    const fichier = readFileSync(join(RACINE, "icon-192.png"));
    if (embarquee.equals(fichier)) return [];
    return [`la vignette (${embarquee.length} octets) diffère de icon-192.png (${fichier.length} octets)`];
});

// Le sélecteur de zone est le premier écran du parcours, et ses dix repères étaient tous
// sous les 44 px de cible tactile minimale — jusqu'à 25,6 px pour la cheville et le pied.
// Une patiente de soixante-douze ans a désigné, sans connaître un seul de ces chiffres, les
// deux paires qui se touchaient presque. Le contrôle mesure ce que le doigt rencontre
// vraiment : le dessin fait 400 unités de viewBox pour 342 px à l'écran d'un iPhone, une
// unité vaut donc 0,855 px. Chaque repère doit atteindre 44 px par sa pastille ou par son
// libellé, et aucune cible ne doit en recouvrir une autre : une cible qui mord sur sa
// voisine ouvre la mauvaise zone, ce qui est pire que d'être trop petite.
controle("chaque repère du corps atteint la cible tactile minimale", () => {
    const LARGEUR_RENDUE = 342, LARGEUR_VUE = 400, MINIMUM = 44;
    const u = LARGEUR_RENDUE / LARGEUR_VUE;
    const M = D.REALISTIC_MARKERS;
    const boite = (m) => {
        const largeur = m.label.length * D.LIBELLE_LARGEUR_CAR + D.LIBELLE_CIBLE_MARGE;
        const x = m.anchor === "start" ? m.labelX - 12 : m.labelX - largeur + 12;
        const x1 = Math.max(D.VUE_X1, x), x2 = Math.min(D.VUE_X2, x + largeur);
        return { x1, x2, y1: m.labelY - D.LIBELLE_CIBLE_H / 2, y2: m.labelY + D.LIBELLE_CIBLE_H / 2 };
    };
    const fautes = [];
    for (const m of M) {
        const b = boite(m);
        const pastille = 2 * m.hit * u;
        const libelle = Math.min((b.x2 - b.x1) * u, D.LIBELLE_CIBLE_H * u);
        if (pastille < MINIMUM && libelle < MINIMUM)
            fautes.push(`${m.id} : pastille ${pastille.toFixed(1)} px, libell\u00e9 ${libelle.toFixed(1)} px, `
                + `aucun n'atteint ${MINIMUM} px`);
    }
    for (let i = 0; i < M.length; i++)
        for (let j = i + 1; j < M.length; j++) {
            const d = Math.hypot(M[i].cx - M[j].cx, M[i].cy - M[j].cy);
            if (d < M[i].hit + M[j].hit)
                fautes.push(`les pastilles de ${M[i].id} et ${M[j].id} se recouvrent`);
            const a = boite(M[i]), b = boite(M[j]);
            if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2)
                fautes.push(`les libell\u00e9s de ${M[i].id} et ${M[j].id} se recouvrent`);
        }
    return fautes;
});

// La fabrique de liens est l'écran par lequel le praticien prescrit : un programme qu'elle
// n'atteint pas ne peut être envoyé à personne. Elle ne lisait que « PATHOLOGIES », et
// dix-huit programmes sur soixante étaient donc hors de portée — un tiers du contenu, sans
// qu'aucun contrôle ne puisse le voir, puisque ce contenu existe et s'affiche par ailleurs.
// On compare ici deux ensembles : ce que le contenu propose, et ce que le formulaire sait
// construire. L'écart est l'erreur.
controle("la fabrique de liens atteint chaque programme", () => {
    const attendus = new Set();
    D.PATHOLOGIES.forEach((z) => z.injuries.forEach((i) => attendus.add(`zone:${z.id}/${i.id}`)));
    D.RUNNER_DATA.forEach((r) => attendus.add(`coureur:${r.id}`));
    D.CROISSANCE_DATA.forEach((c) => attendus.add(`croissance:${c.id}`));
    D.PREVENTION_CATEGORIES.forEach((c) => Object.keys(c.data).forEach((k) => attendus.add(`prevention:${c.id}/${k}`)));

    const joignables = new Set();
    for (const p of D.PARCOURS_DU_LIEN)
        for (const a of p.premier()) {
            const seconds = p.second ? p.second(a.v) : [{ v: null }];
            for (const b of seconds) {
                // Le lien par défaut, celui que le praticien copie sans rien changer.
                if (!p.route(a.v, b.v, "bilan"))
                    return [`${p.id} / ${a.v} : la route par défaut est nulle`];
                joignables.add(p.id === "zone" ? `zone:${a.v}/${b.v}`
                    : p.id === "prevention" ? `prevention:${a.v}/${b.v}`
                    : `${p.id}:${a.v}`);
                // Et chaque étape proposée doit produire une route, pas seulement la première.
                if (p.etapes)
                    for (const e of p.etapes(a.v, b.v)) {
                        if (!p.route(a.v, b.v, e.v))
                            return [`${p.id} / ${a.v} : l'étape « ${e.t} » ne produit aucune route`];
                        // Une route juste derrière un libellé vide reste inutilisable : le
                        // praticien choisit dans une liste, pas dans des adresses. Les étapes
                        // du coureur s'y sont affichées « undefined », et la première version
                        // de ce contrôle ne l'a pas vu parce qu'elle ne regardait que la route.
                        if (/undefined|null|\u2014 *$/.test(e.t) || !e.t.trim())
                            return [`${p.id} / ${a.v} : l'étape ${e.v} s'affiche « ${e.t} »`];
                    }
            }
        }

    const manquants = [...attendus].filter((x) => !joignables.has(x));
    const fantomes = [...joignables].filter((x) => !attendus.has(x));
    return manquants.map((x) => `${x} : aucun lien ne mène à ce programme`)
        .concat(fantomes.map((x) => `${x} : la fabrique propose un programme qui n'existe pas`));
});

// Les retraits de carte dérivaient : treize cartes bordées portaient vingt pixels, trois
// en portaient seize, et rien ne disait laquelle avait raison. La règle est maintenant
// simple — une carte bordée porte « p-5 », un bloc teinté sans bordure porte « p-4 » —
// et c'est le genre de règle qu'on oublie trois mois plus tard, au moment d'ajouter une
// carte. Le contrôle lit les styles, pas les intentions : il cherche les cartes qui
// portent une bordure et une ombre, et vérifie qu'elles s'accordent.
controle("les cartes bordées portent le même retrait", () => {
    const fautes = [];
    // La carte la plus répandue de l'application — celle d'un exercice — porte son ombre
    // sur la ligne suivante : une expression qui s'arrête au saut de ligne ne la voyait
    // pas, et le contrôle passait à côté du cas le plus important. C'est le banc de
    // mutation qui l'a dit. On traverse donc les lignes, en bornant la portée pour ne pas
    // happer la carte suivante.
    const re = /className: "([^"]*rounded-2xl[^"]*)"[\s\S]{0,240}?boxShadow: OMBRE_CARTE/g;
    let m;
    while ((m = re.exec(app)) !== null) {
        const classes = m[1];
        // Deux cartes ne portent aucun retrait, et c'est voulu : ce sont des conteneurs
        // dont chaque rang porte le sien, pour que la zone touchable aille d'un bord à
        // l'autre. Seul un retrait présent et différent est une dérive.
        const retrait = (classes.match(/\bp-(\d)\b/) || [])[1];
        if (retrait && retrait !== "5")
            fautes.push(`une carte bordée porte « p-${retrait} » au lieu de « p-5 » : ${classes}`);
    }
    return fautes;
});

// Onze tailles de texte vivaient dans le fichier, dont sept entre 10 et 14 px. Aucune ne
// disait à quoi elle servait : la même valeur portait tantôt une légende, tantôt une
// consigne, et chaque écran en inventait une. C'est ainsi que le texte légal avait fini
// composé plus gros que la consigne qu'on lit entre deux séries.
//
// Le contrôle refuse la prochaine. Une taille s'écrit désormais par un jeton ou par une
// classe de l'échelle, jamais en chiffres au milieu d'un style.
controle("aucune taille de texte hors de l'échelle", () => {
    const fautes = [];
    // Les tailles écrites en dur dans un style. Le dessin du corps a ses propres unités de
    // viewBox, qui ne sont pas des pixels : son libellé porte son propre jeton.
    for (const m of app.matchAll(/fontSize: (\d[\d.]*)/g))
        fautes.push(`taille écrite en dur : fontSize: ${m[1]}`);
    // Les classes de taille improvisées, du genre « text-[13px] ».
    for (const m of app.matchAll(/text-\\?\[(\d+)px\\?\]/g))
        fautes.push(`classe de taille improvisée : text-[${m[1]}px]`);
    // Et dans la feuille : toute déclaration hors des classes de l'échelle et des titres.
    // « #loader » est le texte affiché avant que l'application existe : il ne peut pas
    // porter de classe posée par elle, et prend donc la valeur du corps en clair.
    const permises = new Set([".t-etiquette", ".t-accompagne", ".t-corps", ".t-carte",
        ".text-xl", ".text-2xl", ".text-3xl", "html", "#loader"]);
    for (const feuille of blocsStyle(html))
        for (const m of feuille.matchAll(/([.#]?[\w\\.\[\]#-]+)\{[^}]*font-size:([^;}]+)/g)) {
            const valeur = m[2].trim();
            // Les réinitialisations du Tailwind posent des valeurs relatives — inherit,
            // 1em, 80 % — qui ne décident d'aucune taille : seules les valeurs absolues
            // engagent l'échelle.
            if (!/^\d*\.?\d+(px|rem)$/.test(valeur))
                continue;
            if (!permises.has(m[1]))
                fautes.push(`la feuille fixe une taille hors échelle : ${m[1]} → ${valeur}`);
        }
    return fautes;
});

// Le praticien a relu les 84 pictogrammes devant les exercices qu'ils servent, et nommé
// ceux qui montraient un geste pour un autre. Ces affectations-là ne se devinent pas : la
// règle qui les porte est nommée étroitement, et une règle plus large ajoutée plus haut la
// supplanterait en silence. Le contrôle fige le résultat jugé, pas la règle qui le produit.
controle("les affectations relues restent celles qui ont été validées", () => {
    const attendu = {
        // Un massage n'est pas un mouvement à reproduire.
        "Massage du mollet": "advice",
        "Massage des jambes le soir": "advice",
        "Massage quand ça revient": "advice",
        "Automassage le long des fibulaires": "advice",
        "Automassage et mobilisation des fibulaires": "advice",
        // Deux exceptions validées : ces dessins-là conviennent à leur massage.
        "Automassage de la voûte plantaire": "foot-arch",
        "Auto-massage doux du trapèze": "neck",
        // Des descentes de marche, pas des épreuves d'équilibre.
        "Excentrique unipodal jusqu'au sol": "step",
        "Excentrique unipodal sur marche": "step",
        // Des rotations du tronc, pas des extensions de genou assises.
        "Mobilité thoracique en rotation": "seated-twist",
        "Mobilité en rotation assise": "seated-twist",
        "Mobilisation en rotation assise, amplitude progressive": "seated-twist",
        // Quinze exercices tombaient sur la hanche en charnière, et cinq seulement en sont
        // une. Les dix autres décrivent un soulevé au sol, une extension de hanche, un
        // nordic ou un balancer — quatre gestes qui n'avaient aucun dessin.
        "Hanche en charnière": "hip-hinge",
        "Hanche en charnière (soulevé sécurisé)": "hip-hinge",
        "Hanche en charnière lestée (deadlift roumain)": "hip-hinge",
        "Renforcement de la chaîne postérieure": "hip-hinge",
        "Renforcement global de la chaîne postérieure": "hip-hinge",
        "Port de charge contrôlé": "floor-lift",
        "Port de charge progressif": "floor-lift",
        "Reprise du port de charge": "floor-lift",
        "Retour progressif au port de charges": "floor-lift",
        "Renforcement fonctionnel progressif": "floor-lift",
        "Extension de hanche debout": "standing-hip-ext",
        "Extension de hanche à angle progressif": "standing-hip-ext",
        "Nordic hamstring (excentrique)": "nordic-kneel",
        "Balancers de jambe contrôlés": "leg-swing",
        // La flexion du genou déplace le travail sur le soléaire : c'est tout l'exercice,
        // et les quatre montraient la jambe tendue, c'est-à-dire l'autre muscle.
        "Isométrique genou fléchi (soléaire)": "calf-bent",
        "Renforcement mollet genou fléchi": "calf-bent",
        "Montée sur pointe genou fléchi": "calf-bent",
        "Montée sur pointe lente genou fléchi": "calf-bent",
        // Une cheville croisée sur le genou opposé, pas une mobilisation allongée.
        "Étirement des fessiers": "glute-stretch",
        // Les huit gestes que la relecture a laissés sans candidat : « aucun des 84 ne
        // convient ». Deux d'entre eux montraient le mouvement inverse de celui demandé.
        "Presse à une jambe": "leg-press",
        "Presse à une jambe (légère)": "leg-press",
        "Presse à une jambe chargée": "leg-press",
        "Presse à une jambe (amplitude progressive)": "leg-press",
        "Presse à deux jambes progressive": "leg-press",
        // Le dessin reçu était celui de la rotation externe, c'est-à-dire l'inverse.
        "Rotation interne à l'élastique": "band-rot-int",
        // Et celui-ci travaillait les abducteurs là où l'exercice vise les adducteurs.
        "Exercice de Copenhague (niveau débutant)": "copenhagen",
        "Exercice de Copenhague progressif": "copenhagen",
        "Renforcement scapulaire en charge": "scap-row",
        "Glissements du nerf sciatique": "nerve-sciatic",
        "Étirements du nerf sciatique (doux)": "supine-slr",
        "Curl ischio-jambiers en charge": "ham-curl",
        "Mobilité douce du coude": "elbow-mobilise",
        // Le dessin du membre supérieur reste celui des glissements du bras.
        "Étirement en rotation interne": "towel-behind",
        // Trois exercices tiraient la flexion assise dans trois directions. Chacun part
        // désormais où sa consigne le dit, et le dessin n'en sert plus qu'un.
        "Étirement prolongé du bas du dos": "child-pose",
        "Position de soulagement": "advice",
        "Position assise penchée en avant": "seated-flexion",
        // Trois bascules du bassin « allongé sur le dos » recevaient une silhouette debout,
        // et le contrôle de cohérence ne pouvait rien y voir : le dessin du tronc ne
        // déclarait pas la posture qu'il montre. Il la déclare, et le repli fait le reste.
        "Bascules du bassin": "supine-core",
        "Bascules du bassin en insistant sur la flexion": "supine-core",
        "Bascule du bassin": "supine-core",
        "Coordination mobilité thoraco-lombaire": "seated-twist",
        // Et les douze qu'a fait lever le contrôle une fois les postures déclarées : sept
        // glissements nerveux « Assis » qui montraient une silhouette debout, trois
        // respirations, deux exercices du haut du dos.
        "Glissement du nerf, version très douce": "nerve-assis",
        "Glissement du nerf du bras": "nerve-assis",
        "Mise en tension du nerf du bras": "nerve-assis",
        "Glissement du nerf médian": "nerve-assis",
        "Mise en tension du nerf médian": "nerve-assis",
        "Glissement du nerf ulnaire": "nerve-assis",
        "Mise en tension du nerf ulnaire": "nerve-assis",
        "Relâchement musculaire": "breathing-assis",
        "Respiration dirigée assise": "breathing-assis",
        // « Allongé, une main sur le ventre » décrit quelqu'un sur le dos : le détecteur y
        // lisait un décubitus ventral, et réclamait donc un dessin à plat ventre.
        "Respiration diaphragmatique": "breathing-dos",
        "Renforcement doux du haut du dos": "prone-ytw",
        "Extension du haut du dos": "thoracic-ext-assis",
    };
    const cles = new Map();
    for (const p of D.POSES) {
        if (!cles.has(p.icon))
            cles.set(p.icon, []);
        if (!cles.get(p.icon).includes(p.key))
            cles.get(p.icon).push(p.key);
    }
    const vus = new Map();
    for (const { ex } of exercices)
        vus.set(ex.name, (cles.get(D.getExerciseIcon(ex.name, ex.tip)) || ["?"])[0]);
    const fautes = [];
    for (const [nom, voulu] of Object.entries(attendu)) {
        if (!vus.has(nom))
            fautes.push(`« ${nom} » a disparu du contenu : le contrôle ne garde plus rien`);
        else if (vus.get(nom) !== voulu)
            fautes.push(`« ${nom} » retombe sur « ${vus.get(nom)} » au lieu de « ${voulu} »`);
    }
    return fautes;
});

// Quatre silhouettes avaient des membres hors de toute proportion humaine : un avant-bras
// de 13 unités sur un tronc de 18, un bras de 15,6 là où l'avant-bras en faisait 7,8. Le
// praticien les a vues à l'œil sur la planche de relecture — « bras beaucoup trop long par
// rapport au corps » — et la mesure lui a donné raison : jusqu'à 63 % d'écart.
//
// Le canon tient en une tête : avec un crâne de huit unités de diamètre, le tronc en vaut
// 2,2, le bras 1,2, l'avant-bras 1,1, la jambe 1,7. Il ne vaut que pour une silhouette
// debout entière, et le fichier ne dit pas lesquelles le sont : un contrôle général
// signalerait le squat, l'assise et les dessins de tête seule, que le praticien a validés.
// Celui-ci ne garde donc que les quatre corrigées, et il les mesure au lieu de figer leurs
// coordonnées : un dessin peut bouger, il ne peut pas s'allonger.
controle("les quatre silhouettes redessinées gardent leurs proportions", () => {
    const fautes = [];
    for (const nom of ["PoseArmSupport", "PoseArm9090", "PoseIsoRotWall", "PoseWallWalk"]) {
        const d = app.match(new RegExp("const " + nom + " = poseWrap\\(([\\s\\S]*?)\\)\\)\\);"));
        if (!d) {
            fautes.push(`${nom} est introuvable : le contrôle ne garde plus rien`);
            continue;
        }
        const tete = [...d[1].matchAll(/cx: "([\d.]+)", cy: "([\d.]+)", r: "([\d.]+)"/g)]
            .map((c) => c.slice(1).map(Number))[0];
        const segments = [...d[1].matchAll(/x1: "([\d.]+)", y1: "([\d.]+)", x2: "([\d.]+)", y2: "([\d.]+)"/g)]
            .map((l) => l.slice(1).map(Number));
        if (!tete || !segments.length) {
            fautes.push(`${nom} n'a plus de tête ou plus de segment mesurable`);
            continue;
        }
        const [cx, cy, r] = tete;
        const longueur = ([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1);
        // Le sol, le mur et le plan d'appui : du décor, long par nature.
        const decor = ([x1, y1, x2, y2]) => (y1 === y2 && y1 >= 42)
            || (x1 === x2 && (x1 <= 8 || x1 >= 38)) || longueur([x1, y1, x2, y2]) >= 20;
        const tronc = segments.find(([x1, y1]) => Math.abs(x1 - cx) <= 1.5 && Math.abs(y1 - (cy + r)) <= 1.5);
        if (!tronc)
            fautes.push(`${nom} : le tronc ne part plus du bas de la tête, rien n'est mesurable`);
        else {
            const voulu = 2.2 * 2 * r;
            const ecart = Math.round(100 * (longueur(tronc) / voulu - 1));
            if (Math.abs(ecart) > 12)
                fautes.push(`${nom} : tronc de ${longueur(tronc).toFixed(1)} au lieu de `
                    + `${voulu.toFixed(1)} (${ecart > 0 ? "+" : ""}${ecart} %)`);
        }
        // Hors tronc et décor, aucun segment ne dépasse une jambe : quatorze unités.
        for (const sg of segments) {
            if (sg === tronc || decor(sg))
                continue;
            if (longueur(sg) > 14)
                fautes.push(`${nom} : un segment de ${longueur(sg).toFixed(1)} unités `
                    + `(${sg[0]},${sg[1]} → ${sg[2]},${sg[3]}), maximum 14`);
        }
        // Et le bras se mesure entier. C'est là qu'était le défaut : un membre de 26 unités
        // fait de deux segments de 13, dont aucun ne dépassait la borne précédente. Un bras
        // part du tronc entre la nuque et la hanche, et se suit de bout en bout ; bras plus
        // avant-bras valent 2,3 têtes, soit 18,4.
        if (tronc) {
            const surLeTronc = ([x1, y1]) => Math.abs(x1 - tronc[0]) <= 1.5
                && y1 > cy + r + 1 && y1 < tronc[3] - 2;
            for (const racine of segments.filter((sg) => sg !== tronc && !decor(sg) && surLeTronc(sg))) {
                let bout = racine, total = longueur(racine), pas = 0;
                while (pas++ < 4) {
                    const suite = segments.find((sg) => sg !== bout && sg !== tronc && !decor(sg)
                        && Math.abs(sg[0] - bout[2]) <= 0.5 && Math.abs(sg[1] - bout[3]) <= 0.5);
                    if (!suite)
                        break;
                    total += longueur(suite);
                    bout = suite;
                }
                if (total > 20)
                    fautes.push(`${nom} : un bras de ${total.toFixed(1)} unités depuis `
                        + `${racine[0]},${racine[1]}, maximum 20 pour bras et avant-bras`);
            }
        }
    }
    return fautes;
});

// --- Restitution ----------------------------------------------------------------------
const large = Math.max(...rapport.map((r) => r.nom.length));
for (const r of rapport)
    console.log(`${r.etat === "ok" ? "  ok  " : "ÉCHEC "} ${r.nom.padEnd(large)}  ${r.note}`);

if (echecs.length) {
    console.log("");
    for (const e of echecs) {
        console.log(`--- ${e.nom} : ${e.lignes.length} cas ---`);
        e.lignes.slice(0, 20).forEach((l) => console.log("    " + l));
        if (e.lignes.length > 20)
            console.log(`    … et ${e.lignes.length - 20} autres`);
    }
    process.exit(1);
}
{
    // La couverture des « pourquoi », parcours par parcours. Elle ne fait échouer personne :
    // c'est un chiffre à regarder, pas une règle. Il ne portait longtemps que sur les
    // pathologies et annonçait 63 % de couverture, alors que deux parcours entiers n'en
    // avaient aucun.
    let total = 0, couverts = 0;
    // Deux niveaux, parce que les parcours ne portent pas le « pourquoi » au même endroit :
    // par étape côté pathologies et coureur, par exercice côté croissance. Ne compter que
    // les étapes ferait passer la croissance pour dépourvue alors qu'elle est la mieux
    // fournie du fichier.
    const parEtape = [], parExercice = [];
    const compter = (nom, racine) => {
        let t = 0, c = 0, te = 0, ce = 0;
        const descendre = (n) => {
            if (Array.isArray(n)) return n.forEach(descendre);
            if (!n || typeof n !== "object") return;
            if (Array.isArray(n.exercises)) {
                t++;
                // La prévention porte le sien sous le nom « intro », et l'affiche en tête
                // d'écran comme les autres. Ne chercher que « pourquoi » la donnait à zéro,
                // et m'a fait proposer d'écrire neuf textes qui existaient déjà.
                if (n.pourquoi || n.intro || D.POURQUOI_ETAPE[n.label]) c++;
                n.exercises.forEach((e) => { te++; if (e.pourquoi) ce++; });
            }
            Object.values(n).forEach((v) => { if (v && typeof v === "object") descendre(v); });
        };
        descendre(racine);
        total += t; couverts += c;
        parEtape.push(`${nom} ${c}/${t}`);
        parExercice.push(`${nom} ${ce}/${te}`);
    };
    compter("pathologies", D.PATHOLOGIES);
    compter("coureur", D.RUNNER_DATA);
    compter("croissance", D.CROISSANCE_DATA);
    compter("prévention", D.PREVENTION_CATEGORIES);
    console.log(`\n${rapport.length} contrôles passés sur ${exercices.length} exercices.`);
    console.log(`${couverts} étapes sur ${total} portent un « pourquoi » (${Math.round(couverts / total * 100)} %).`);
    console.log(`   par étape    ${parEtape.join("   ")}`);
    console.log(`   par exercice ${parExercice.join("   ")}`);
}
