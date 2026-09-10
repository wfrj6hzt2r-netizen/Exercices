// Contrôles qui se passent d'un navigateur : ils lisent le fichier et le contenu.
//
// Chacun correspond à un défaut réellement survenu, pas à une règle imaginée. Un contrôle qui
// n'a jamais rien attrapé finit par être ignoré ; ceux-ci ont tous une histoire.
//
//   node verification/statique.mjs

import { lireFichier, blocsStyle, scriptApplicatif, donnees, tousLesExercices } from "./lire.mjs";

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

const D = await donnees(html, ["PATHOLOGIES", "RUNNER_DATA", "CROISSANCE_DATA",
    "PREVENTION_CATEGORIES", "POSTURE_DESSIN", "DESSIN_AUTRE_POSTURE", "postureDecrite",
    "getExerciseIcon", "POSES", "demandeUnElastique", "POURQUOI_ETAPE",
    "positionAffichable"]);
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
controle("le pictogramme ne contredit pas la consigne", () => {
    if (!D.getExerciseIcon || !D.postureDecrite || !D.POSTURE_DESSIN)
        throw new Error("les fonctions de pictogramme ne sont pas exposées");
    const clePose = new Map((D.POSES || []).map((p) => [p.icon, p.key]));
    const out = [];
    for (const { ex, ou } of exercices) {
        const icone = D.getExerciseIcon(ex.name, ex.tip);
        const cle = clePose.get(icone);
        if (!cle)
            continue; // pictogramme neutre : il ne prétend rien
        const montree = D.POSTURE_DESSIN[cle];
        const decrite = D.postureDecrite(ex.tip);
        if (montree && decrite && montree !== decrite)
            out.push(`${ou} — « ${ex.name} » : dessin « ${montree} », consigne « ${decrite} »`);
    }
    return out;
});

// --- 8. L'élastique a toujours un repli -----------------------------------------------
// Demandé lors de la relecture : un patient sans élastique ne doit pas rester bloqué.
controle("tout exercice à élastique offre une version sans", () => {
    if (!D.demandeUnElastique)
        throw new Error("le repérage des élastiques n'est pas exposé");
    return exercices
        .filter(({ ex }) => D.demandeUnElastique(ex.tip) && !ex.sansElastique)
        .map(({ ex, ou }) => `${ou} — « ${ex.name} »`);
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
    for (const { ex, ou } of exercices) {
        const etiquette = D.positionAffichable(ex.name, ex.tip);
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

// La table des « pourquoi » est indexée par libellé d'étape. Un libellé mal orthographié
// n'afficherait rien du tout, sans la moindre erreur — le même genre de panne silencieuse
// que les cinq classes d'espacement qui ne faisaient rien. On vérifie donc les deux sens :
// chaque clé de la table désigne bien une étape existante, et on rapporte la couverture.
controle("chaque « pourquoi » désigne une étape qui existe", () => {
    const libelles = new Set();
    D.PATHOLOGIES.forEach((z) => z.injuries.forEach((i) => i.stages.forEach((s) => libelles.add(s.label))));
    return Object.keys(D.POURQUOI_ETAPE).filter((k) => !libelles.has(k))
        .map((k) => `« ${k} » ne correspond à aucune étape`);
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
    let total = 0, couverts = 0;
    D.PATHOLOGIES.forEach((z) => z.injuries.forEach((i) => i.stages.forEach((s) => {
        total++;
        if (s.pourquoi || D.POURQUOI_ETAPE[s.label]) couverts++;
    })));
    console.log(`\n${rapport.length} contrôles passés sur ${exercices.length} exercices.`);
    console.log(`${couverts} étapes sur ${total} portent un « pourquoi » (${Math.round(couverts / total * 100)} %).`);
}
