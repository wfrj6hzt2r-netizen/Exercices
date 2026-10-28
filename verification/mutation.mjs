// Banc de mutation : chaque contrôle est mis en défaut, pour vérifier qu'il rougit encore.
//
// Deux contrôles de cette suite avaient cessé de vérifier quoi que ce soit sans que rien ne
// le signale. Celui des élastiques appelait sa fonction avec le mauvais argument et ne
// voyait plus aucun des soixante exercices concernés ; celui des pictogrammes lisait le
// dessin après le repli, qui résout déjà toute contradiction, et ne pouvait donc plus en
// trouver. Les deux passaient au vert. Un contrôle vert qui ne peut pas rougir est pire
// que pas de contrôle : il rassure.
//
// Ce banc empêche cette panne-là de revenir. Pour chaque contrôle, il injecte dans une copie
// d'index.html le défaut que le contrôle prétend attraper, relance la suite statique, et
// vérifie que c'est bien ce contrôle-là qui échoue. Un contrôle qui reste muet est rapporté.
//
// Le vrai fichier n'est jamais modifié : la copie trafiquée est écrite ailleurs et passée
// par « EXERCICES_SOURCE ». Une sauvegarde suivie d'une restauration laisserait le dépôt
// abîmé au moindre plantage en cours de route.
//
//   node verification/mutation.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lireFichier, RACINE } from "./lire.mjs";

const source = lireFichier();

// Remplace une fois, et refuse de continuer si le motif a disparu du fichier : une mutation
// qui ne s'applique pas produirait un contrôle faussement déclaré vivant.
function rem(s, a, b) {
    if (!s.includes(a))
        throw new Error("motif absent du fichier : " + a.slice(0, 60));
    return s.replace(a, b);
}

// Une mutation par contrôle. Le libellé doit être exactement celui du contrôle visé.
//
// Le texte visé doit être unique dans le fichier — sans quoi la mutation frappe un homonyme
// et le contrôle est déclaré muet à tort — et aussi stable que possible. Deux mutations
// étaient ancrées sur la scoliose : en la déplaçant vers la partie enfant, elles se sont
// retrouvées sans cible. Le banc l'a dit, ce qui est son travail ; il vaut mieux néanmoins
// viser un contenu ancien qu'un contenu qu'on vient d'écrire.
const MUTATIONS = [
    ["le script applicatif se compile",
        (s) => rem(s, "const POSES = [", "const casse = (;\nconst POSES = [")],

    ["tout symbole majuscule employé est déclaré",
        (s) => rem(s, "const POSES = [", "const essai = SYMBOLE_ABSENT;\nconst POSES = [")],

    ["toute classe employée est définie",
        (s) => rem(s, 'className: "w-full max-w-[342px] mx-auto"',
                      'className: "w-full max-w-[342px] mx-auto pb-42"')],

    // La carte du mannequin portait son blanc en clair dans le style : elle le tient
    // maintenant d'un jeton, et la mutation vise donc un autre point d'entrée. On remplace
    // ici une référence de palette par une couleur écrite en dur, ce que le contrôle refuse
    // où qu'elle se trouve.
    ["aucune couleur hors de la palette",
        (s) => rem(s, 'React.createElement("div", { className: "rounded-2xl overflow-hidden", style: { backgroundColor: SURFACE',
                      'React.createElement("div", { className: "rounded-2xl overflow-hidden", style: { backgroundColor: "#AB12CD"')],

    ["aucun emoji couleur dans l'interface",
        (s) => rem(s, '"Une derni\\u00E8re question"', '"Une derni\\u00E8re question \u{1F9B4}"')],

    ["chaque exercice a un nom, une dose et une consigne",
        (s) => rem(s, '{ name: "Gainage ventral", dose: "3 × 30 sec"', '{ name: "Gainage ventral", dose: ""')],

    ["chaque consigne se termine par un point",
        (s) => rem(s, "bloquer le souffle est une erreur fréquente.\" }",
                      "bloquer le souffle est une erreur fréquente\" }")],

    // Le gainage latéral décrit debout : la pose « side-plank » annonce le côté, et aucun
    // dessin de remplacement ne couvre cette bascule — l'exercice perdrait son pictogramme.
    // Sa consigne est unique dans le fichier, ce qui évite de muter un homonyme ailleurs.
    ["le pictogramme ne contredit pas la consigne",
        (s) => rem(s, 'tip: "Allongé sur le côté, en appui sur l\'avant-bras, coude sous l\'épaule.',
                      'tip: "Debout contre un mur, coude sous l\'épaule.')],

    ["tout exercice à élastique offre une version sans",
        (s) => rem(s, '{ name: "Gainage ventral"',
                      '{ name: "Tirage au Theraband", dose: "3 × 12", tip: "Tirez les coudes vers l\'arrière contre la bande de résistance." },\n                            { name: "Gainage ventral"')],

    ["chaque blessure a des conseils pour les premiers jours",
        (s) => rem(s, 'premiersJours: ["Une dorsalgie mécanique est bénigne',
                      'premiersJours: [], ignore: ["Une dorsalgie mécanique est bénigne')],

    // « Fentes lentes » ne nomme aucune posture dans sa consigne : son étiquette s'affiche
    // donc telle quelle, et peut contredire le dessin sans que rien ne la filtre.
    ["l'étiquette de position ne contredit pas le dessin",
        (s) => rem(s, "const POSITION_LIBRARY = [\n",
                      "const POSITION_LIBRARY = [\n    { test: (n) => n.includes(\"fentes lentes\"), label: \"Allongé\" },\n")],

    // La liste des dispenses n'est plus écrite qu'une fois : on ne peut plus la faire
    // diverger. Reste ce que le contrôle garde désormais — une sortie à vide ajoutée à
    // « familleEffort » en dehors de cette liste, qui priverait l'exercice de son repère.
    ["le repère d'effort ne contredit pas la consigne",
        (s) => rem(s, "function familleEffort(ex, croissance) {\n",
                      "function familleEffort(ex, croissance) {\n    if (/gainage/.test((ex.name || \"\").toLowerCase())) return null;\n")],

    ["les repères tutoyés couvrent les mêmes familles, sans charge inventée",
        (s) => {
            const i = s.indexOf("const REPERE_EFFORT_TU");
            const j = s.indexOf("\n};", i);
            const ligne = '    technique: "La qualité du geste avant la vitesse.",\n';
            const bloc = s.slice(i, j);
            if (!bloc.includes(ligne))
                throw new Error("la famille « technique » a disparu de la table tutoyée");
            return s.slice(0, i) + bloc.replace(ligne, "") + s.slice(j);
        }],

    ["chaque rythme propre couvre toutes ses étapes",
        (s) => rem(s, '{ freq: "Une à deux fois par jour", duration: "Une à deux semaines suffisent souvent',
                      '{ freq: "", duration: "Une à deux semaines suffisent souvent')],

    ["chaque « pourquoi » désigne une étape qui existe",
        (s) => rem(s, "const POURQUOI_ETAPE = {\n",
                      "const POURQUOI_ETAPE = {\n    \"Étape absente\": \"Texte orphelin.\",\n")],

    ["chaque mot du lexique est écrit quelque part dans l'application",
        (s) => rem(s, "const GLOSSARY = {\n",
                      "const GLOSSARY = {\n    \"sous-acromial\": \"Sous l'arche osseuse de l'épaule.\",\n")],

    // « névrome » repasse devant « névrome de Morton », qu'il contient : le mot long ne sort
    // plus jamais, et le pied du patient reçoit la définition générale à la place de la sienne.
    ["aucun mot du lexique n'est masqué par un autre",
        (s) => {
            const court = "    \"névrome\": \"Épaississement douloureux d'un nerf, souvent entre les orteils.\",\n";
            const long = "    \"névrome de Morton\": ";
            return rem(rem(s, court, ""), long, court + long);
        }],

    // Le pendule perd sa posture déclarée. Il ne sert aucune consigne qui nomme la sienne,
    // donc le contrôle de cohérence ne bronche pas : c'est tout le problème, et c'est ce
    // nouveau contrôle-là qui doit le voir.
    ["tout dessin de silhouette entière déclare sa posture",
        (s) => rem(s, '    pendulum: "debout",\n', "")],

    // « échauffement » n'est plus réservé : la pastille le repose sur deux cartes
    // d'exercice, pour y définir un mot que la consigne n'emploie qu'en passant.
    ["les mots réservés au lexique n'en sortent jamais",
        (s) => rem(s, 'const LEXIQUE_SEUL = new Set(["prévention", "échauffement"]);',
                      'const LEXIQUE_SEUL = new Set(["prévention"]);')],

    // Le classement par lettre perd son premier mot en chemin : l'écran en montre
    // quatre-vingt-douze pour quatre-vingt-treize définitions, sans rien signaler.
    ["l'écran du lexique montre tout le tableau",
        (s) => rem(s, "Object.keys(GLOSSARY).slice().sort(", "Object.keys(GLOSSARY).slice(1).sort(")],

    // La cheville revient à son ancien rayon : sa pastille retombe à 27 px et son libellé,
    // ramené à la hauteur d'avant, recouvre celui du pied.
    ["chaque repère du corps atteint la cible tactile minimale",
        (s) => rem(s, 'id: "cheville", label: "Cheville", cx: 116.4, cy: 506.7, labelX: 62, labelY: 490, anchor: "end", hit: 16',
                      'id: "cheville", label: "Cheville", cx: 116.4, cy: 506.7, labelX: 62, labelY: 536, anchor: "end", hit: 15')],

    // Le parcours prévention perd son second champ : la fabrique ne sait plus désigner
    // l'activité, et ses trois catégories deviennent des programmes sans lien.
    ["la fabrique de liens atteint chaque programme",
        (s) => rem(s, 'secondIntitule: "Activit\\u00E9",', 'secondIntitule: "Activit\\u00E9", second: null,')],

    // La carte d'exercice retrouve son ancien retrait : seize là où toutes les autres
    // cartes bordées en portent vingt.
    ["les cartes bordées portent le même retrait",
        (s) => rem(s, 'React.createElement("article", { className: "rounded-2xl p-5 bg-white"',
                      'React.createElement("article", { className: "rounded-2xl p-4 bg-white"')],

    // Une taille inventée au milieu d'un style, comme il y en avait onze.
    ["aucune taille de texte hors de l'échelle",
        (s) => rem(s, 'style: { fontSize: TAILLE_ACCOMPAGNE, fontWeight: 600 } }',
                      'style: { fontSize: 12.5, fontWeight: 600 } }')],

    // La règle des massages perd son exception : la voûte plantaire retombe sur le
    // bloc-notes, alors que le praticien a validé son dessin devant ses exercices.
    // Une migration qui laisse tomber les charges notées : c'est la perte la plus discrète,
    // le patient ne s'en aperçoit qu'au moment de montrer sa progression.
    ["une sauvegarde ancienne garde toute sa progression",
        (s) => rem(s, "    data.charges = propres;", "    data.charges = {};")],

    // Le repos par défaut glisse d'une demi-minute à une minute, sans que personne l'ait décidé.
    ["le repos affiché suit la règle du praticien",
        (s) => rem(s, 'const REPOS_PAR_DEFAUT = "30\u00A0s";', 'const REPOS_PAR_DEFAUT = "60\u00A0s";')],

    ["les affectations relues restent celles qui ont été validées",
        (s) => rem(s, '!/plantaire|voûte|trapèze/.test(n)', '!/trapèze/.test(n)')],

    // Le bras de la silhouette en appui retrouve sa longueur d'avant : vingt-six unités
    // de membre supérieur sur un tronc de dix-huit.
    ["les quatre silhouettes redessinées gardent leurs proportions",
        (s) => rem(s, 'x1: "32", y1: "18", x2: "25", y2: "25" }),\n    React.createElement("line", { x1: "25", y1: "25", x2: "16", y2: "27" })',
                      'x1: "32", y1: "18", x2: "24", y2: "29" }),\n    React.createElement("line", { x1: "24", y1: "29", x2: "12", y2: "24" })')],

    ["la vignette de l'accueil est bien l'icône installée",
        (s) => {
            const marque = 'const LOGO = "data:image/png;base64,';
            const i = s.indexOf(marque) + marque.length;
            const j = s.indexOf('"', i);
            return s.slice(0, i) + s.slice(i, j).replace("A", "B") + s.slice(j);
        }],
];

// Renvoie les libellés des contrôles en échec pour une source donnée.
function echecs(chemin) {
    let sortie;
    try {
        sortie = execFileSync("node", [join(RACINE, "verification/statique.mjs")],
            { cwd: RACINE, encoding: "utf8", env: { ...process.env, EXERCICES_SOURCE: chemin } });
    } catch (e) {
        sortie = (e.stdout || "") + (e.stderr || "");
    }
    const noms = new Set();
    for (const l of sortie.split("\n")) {
        if (!l.startsWith("ÉCHEC") && !l.startsWith("ERREUR"))
            continue;
        noms.add(l.slice(6).trim().replace(/\s{2,}.*$/, "").trim());
    }
    return noms;
}

const dossier = mkdtempSync(join(tmpdir(), "mutation-"));
const propre = join(dossier, "propre.html");
writeFileSync(propre, source);
const muets = [];
const rates = [];
try {
    const base = echecs(propre);
    if (base.size) {
        console.log("La suite n'est pas verte avant mutation, le banc ne veut rien dire :");
        for (const n of base)
            console.log("   " + n);
        process.exit(1);
    }
    const large = Math.max(...MUTATIONS.map(([n]) => n.length));
    for (const [nom, muter] of MUTATIONS) {
        let chemin = join(dossier, "mute.html");
        try {
            writeFileSync(chemin, muter(source));
        } catch (e) {
            rates.push(`${nom} — la mutation ne s'applique plus : ${e.message}`);
            console.log(`RATÉE ${nom}`);
            continue;
        }
        const noms = echecs(chemin);
        const vise = noms.has(nom);
        if (!vise)
            muets.push(nom);
        const autres = [...noms].filter((n) => n !== nom);
        console.log(`${vise ? "mord " : "MUET "} ${nom.padEnd(large)}`
            + (autres.length ? "  (aussi : " + autres.join(", ") + ")" : ""));
    }
} finally {
    rmSync(dossier, { recursive: true, force: true });
}

// Le banc ne couvrait pas forcément tous les contrôles : un dix-septième pouvait naître
// sans mutation, et n'être jamais éprouvé — exactement le genre d'angle mort que ce banc
// existe pour supprimer. On lit les libellés déclarés dans la suite statique et on exige
// qu'aucun ne manque ici.
const declares = [...readFileSync(join(RACINE, "verification/statique.mjs"), "utf8")
    .matchAll(/^controle\("((?:[^"\\]|\\.)*)"/gm)].map((m) => m[1]);
const couverts = new Set(MUTATIONS.map(([n]) => n));
const oublies = declares.filter((n) => !couverts.has(n));

console.log(`\n${MUTATIONS.length} contrôles mis en défaut.`);
if (oublies.length) {
    console.log("\nContrôles sans mutation — rien ne dit qu'ils mordent encore :");
    oublies.forEach((n) => console.log("   " + n));
}
if (rates.length) {
    console.log("\nMutations qui ne s'appliquent plus — le fichier a changé sous elles :");
    rates.forEach((l) => console.log("   " + l));
}
if (muets.length) {
    console.log("\nContrôles muets : ils n'ont pas vu le défaut qu'ils prétendent attraper.");
    muets.forEach((n) => console.log("   " + n));
}
if (muets.length || rates.length || oublies.length)
    process.exit(1);
console.log("Chacun a vu son défaut.");
