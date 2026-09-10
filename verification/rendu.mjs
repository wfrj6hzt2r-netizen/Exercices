// Contrôles qui demandent un vrai navigateur : ce qu'on ne peut pas voir en lisant le fichier.
//
// Quatre des défauts de la semaine étaient de ce genre — un libellé sorti de son cadre, une
// légende passée à deux lignes, un surtitre coupé, un texte indicatif rogné. Aucun n'était
// visible dans le code ; tous l'étaient à l'écran.
//
//   npm i --no-save playwright axe-core && npx playwright install --with-deps chromium
//   node verification/rendu.mjs

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import axe from "axe-core"; // module CommonJS : l'export nommé n'existe pas
const axeSource = axe.source;
import { RACINE } from "./lire.mjs";

const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}/`;
const TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".png": "image/png", ".webmanifest": "application/manifest+json",
};

const ROUTES = [
    ["accueil", "#/"], ["blessures", "#/z/genou"], ["check-in", "#/z/genou/entorse"],
    ["exercices", "#/z/genou/entorse/e1"], ["exercices tardifs", "#/z/genou/entorse/e4"],
    ["fin de parcours", "#/z/genou/entorse/fin"], ["lombaires", "#/z/lombaire/hernie-discale"],
    ["cheville", "#/z/cheville/achille-insertion/e4"], ["cervicales", "#/z/cervical/cervicalgie"],
    ["hanche", "#/z/hanche/arthrose-hanche"], ["coureur", "#/coureur"],
    ["coureur exercices", "#/coureur/essuie-glace/e1"], ["croissance", "#/croissance"],
    ["croissance exercices", "#/croissance/osgood/e1"], ["prévention", "#/prevention"],
    ["prévention exercices", "#/prevention/warmup/course"], ["récapitulatif", "#/recap"],
    ["à propos", "#/apropos"], ["fabrique de liens", "#/lien"], ["pied", "#/z/pied/coussinet/e1"],
    ["cervicalgie C5", "#/z/cervical/ncb-c5/e1"], ["coude lanceur", "#/croissance/coude-lanceur/e1"],
];

const echecs = [];
const rapport = [];
function noter(nom, lignes) {
    if (lignes.length) {
        echecs.push({ nom, lignes });
        rapport.push(`ÉCHEC  ${nom}  (${lignes.length} cas)`);
    } else {
        rapport.push(`  ok   ${nom}`);
    }
}

const serveur = createServer((req, res) => {
    let chemin = decodeURIComponent(req.url.split("?")[0]);
    if (chemin.endsWith("/"))
        chemin += "index.html";
    try {
        const corps = readFileSync(join(RACINE, chemin));
        // GitHub Pages pose un ETag : le service worker s'en sert pour repérer une nouvelle
        // version. Sans lui, la bannière de mise à jour ne peut pas être contrôlée.
        res.writeHead(200, {
            "Content-Type": TYPES[extname(chemin)] || "application/octet-stream",
            ETag: '"' + createHash("sha1").update(corps).digest("hex").slice(0, 16) + '"',
            "Cache-Control": "no-cache",
        });
        res.end(corps);
    } catch {
        res.writeHead(404);
        res.end("absent");
    }
});
await new Promise((r) => serveur.listen(PORT, "127.0.0.1", r));

const navigateur = await chromium.launch();

/** Ouvre un écran, passe l'introduction, et rend la page prête. */
async function ouvrir(ctx, hash) {
    const p = await ctx.newPage();
    const erreurs = [];
    p.on("pageerror", (e) => erreurs.push("erreur de page : " + e.message));
    p.on("console", (m) => { if (m.type() === "error") erreurs.push("console : " + m.text()); });
    await p.goto(BASE + hash, { waitUntil: "load" });
    await p.waitForSelector("main");
    const bouton = p.getByRole("button", { name: /J'ai compris/ });
    if (await bouton.count()) {
        await bouton.click();
        await p.waitForTimeout(400);
    }
    return { p, erreurs };
}

// --- 1. Chaque écran s'affiche sans erreur -------------------------------------------
{
    const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
    const out = [];
    for (const [nom, hash] of ROUTES) {
        const { p, erreurs } = await ouvrir(ctx, hash);
        const vide = await p.evaluate(() => document.querySelector("main").innerText.trim().length < 40);
        if (vide)
            erreurs.push("écran vide");
        erreurs.forEach((e) => out.push(`${nom} — ${e}`));
        await p.close();
    }
    await ctx.close();
    noter("chaque écran s'affiche sans erreur", out);
}

// --- 2. Rien n'est coupé ni ne déborde ------------------------------------------------
// « Thoraciques » sortait du cadre du mannequin, le texte indicatif de la recherche était
// rogné en plein mot, et le surtitre du récapitulatif passait à deux lignes.
{
    const out = [];
    for (const taille of ["normal", "grand", "tres-grand"]) {
        const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
        for (const [nom, hash] of ROUTES) {
            const { p } = await ouvrir(ctx, hash);
            await p.evaluate((t) => {
                const s = JSON.parse(localStorage.getItem("kine-exercices-v1") || "{}");
                s.version = 3; s.introVu = true; s.tailleTexte = t;
                localStorage.setItem("kine-exercices-v1", JSON.stringify(s));
            }, taille);
            await p.reload({ waitUntil: "load" });
            await p.waitForSelector("main");
            const r = await p.evaluate((grandMaximum) => {
                const out = [];
                if (document.documentElement.scrollWidth > window.innerWidth + 1)
                    out.push("la page déborde horizontalement");
                // Un surtitre en capitales espacées qui se coupe donne toujours l'impression
                // d'un défaut. Au cran le plus agrandi en revanche, le repli est inévitable et
                // légitime : le patient a demandé un texte trois fois plus grand. Ce qu'on ne
                // tolère à aucune taille, c'est la perte d'information — contrôlée plus bas.
                if (!grandMaximum)
                    for (const el of document.querySelectorAll('main [class*="tracking"]')) {
                        const s = getComputedStyle(el);
                        const h = parseFloat(s.lineHeight) || parseFloat(s.fontSize);
                        if (el.getBoundingClientRect().height / h > 1.5)
                            out.push(`surtitre espacé sur deux lignes : « ${el.textContent.trim()} »`);
                    }
                for (const el of document.querySelectorAll("main *")) {
                    if (el.children.length || !el.textContent.trim())
                        continue;
                    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
                        out.push(`texte rogné : « ${el.textContent.trim().slice(0, 40)} »`);
                }
                // les libellés d'un dessin doivent tenir dans son cadre
                for (const svg of document.querySelectorAll("main svg[viewBox]")) {
                    const [x, , l] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
                    for (const t of svg.querySelectorAll("text")) {
                        const b = t.getBBox();
                        if (b.x < x - 0.5 || b.x + b.width > x + l + 0.5)
                            out.push(`libellé hors du cadre du dessin : « ${t.textContent} »`);
                    }
                }
                return out;
            }, taille === "tres-grand");
            r.forEach((x) => out.push(`${nom} / texte ${taille} — ${x}`));
            await p.close();
        }
        await ctx.close();
    }
    noter("rien n'est coupé ni ne déborde", out);
}

// --- 3. Le texte reste lisible, dans les deux thèmes ----------------------------------
{
    const out = [];
    for (const theme of ["light", "dark"]) {
        const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme });
        for (const [nom, hash] of ROUTES) {
            const { p } = await ouvrir(ctx, hash);
            const r = await p.evaluate(() => {
                const num = (c) => (c.match(/[\d.]+/g) || []).map(Number);
                const fond = (el) => {
                    const couches = [];
                    let n = el;
                    while (n && n !== document.documentElement) {
                        const v = num(getComputedStyle(n).backgroundColor);
                        if (v.length && (v[3] === undefined || v[3] > 0)) {
                            couches.push(v);
                            if (v[3] === undefined || v[3] === 1)
                                break;
                        }
                        n = n.parentElement;
                    }
                    couches.push([15, 42, 67, 1]);
                    let sortie = couches.pop();
                    while (couches.length) {
                        const c = couches.pop();
                        const a = c[3] === undefined ? 1 : c[3];
                        sortie = [0, 1, 2].map((k) => c[k] * a + sortie[k] * (1 - a));
                    }
                    return sortie;
                };
                const L = (v) => {
                    const m = v.map((x) => x / 255).map((y) => (y <= 0.03928 ? y / 12.92 : Math.pow((y + 0.055) / 1.055, 2.4)));
                    return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
                };
                const out = [];
                for (const el of document.querySelectorAll("main *")) {
                    if (el.children.length || !el.textContent.trim())
                        continue;
                    const s = getComputedStyle(el);
                    if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0)
                        continue;
                    const c = num(s.color);
                    if (c[3] !== undefined && c[3] < 0.05)
                        continue;
                    const f = fond(el);
                    const a = c[3] === undefined ? 1 : c[3];
                    const devant = [0, 1, 2].map((k) => c[k] * a + f[k] * (1 - a));
                    const l1 = L(devant), l2 = L(f);
                    const v = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
                    const px = parseFloat(s.fontSize);
                    const seuil = px >= 18.66 || (px >= 24 && parseInt(s.fontWeight, 10) >= 600) ? 3 : 4.5;
                    if (v < seuil)
                        out.push(`${v.toFixed(2)} au lieu de ${seuil} — « ${el.textContent.trim().slice(0, 34)} »`);
                }
                return out;
            });
            r.forEach((x) => out.push(`${nom} / thème ${theme} — ${x}`));
            await p.close();
        }
        await ctx.close();
    }
    noter("le texte reste lisible dans les deux thèmes", out);
}

// --- 4. Aucune violation d'accessibilité ----------------------------------------------
{
    const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
    const out = [];
    for (const [nom, hash] of ROUTES.slice(0, 10)) {
        const { p } = await ouvrir(ctx, hash);
        await p.addScriptTag({ content: axeSource });
        const r = await p.evaluate(async () => {
            const res = await window.axe.run(document, { resultTypes: ["violations"] });
            // On rend l'élément fautif, pas seulement le nom de la règle : une violation
            // de contraste vue une fois et non reproduite est restée indiagnosticable
            // faute de savoir sur quoi elle portait.
            return res.violations.map((v) => {
                const n = v.nodes[0] || {};
                const quoi = (n.html || "").replace(/\s+/g, " ").slice(0, 120);
                const pourquoi = (n.any || []).map((c) => c.message).join(" ; ").slice(0, 160);
                return `${v.id} (${v.nodes.length}) : ${v.help}\n        ${quoi}\n        ${pourquoi}`;
            });
        });
        r.forEach((x) => out.push(`${nom} — ${x}`));
        await p.close();
    }
    await ctx.close();
    noter("aucune violation d'accessibilité", out);
}

// --- 5. L'application s'ouvre sans réseau ---------------------------------------------
// C'est sa promesse centrale : une rééducation se fait en salle, en vacances, dans un
// sous-sol. Un service worker cassé ne se voit pas tant qu'on a du réseau.
{
    const out = [];
    const profil = mkdtempSync(join(tmpdir(), "verif-hors-ligne-"));
    // un service worker ne survit qu'à un profil persistant
    const ctx = await chromium.launchPersistentContext(profil, { viewport: { width: 390, height: 844 } });
    try {
        const p = ctx.pages()[0] || await ctx.newPage();
        await p.goto(BASE, { waitUntil: "networkidle" });
        const bouton = p.getByRole("button", { name: /J'ai compris/ });
        if (await bouton.count()) {
            await bouton.click();
            await p.waitForTimeout(300);
        }
        await p.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 })
            .catch(() => out.push("le service worker n'a jamais pris la main"));
        const enCache = await p.evaluate(async () => {
            const noms = await caches.keys();
            if (!noms.length)
                return [];
            const c = await caches.open(noms[0]);
            return (await c.keys()).map((r) => new URL(r.url).pathname).sort();
        });
        for (const attendu of ["/", "/index.html", "/manifest.webmanifest"])
            if (!enCache.includes(attendu))
                out.push(`« ${attendu} » absent du cache après la première visite`);

        await ctx.setOffline(true);
        await p.goto(BASE, { waitUntil: "domcontentloaded" });
        await p.waitForTimeout(800);
        if (!(await p.locator("text=Quelle zone").count()))
            out.push("l'accueil ne s'affiche pas sans réseau");
        const externes = await p.evaluate(() => performance.getEntriesByType("resource")
            .filter((r) => !r.name.startsWith(location.origin)).length);
        if (externes)
            out.push(`${externes} requête(s) vers l'extérieur : l'application n'est pas autonome`);

        await p.goto(BASE + "#/z/genou/entorse/e1", { waitUntil: "domcontentloaded" });
        await p.waitForTimeout(800);
        const btn = p.getByRole("button", { name: /J'ai compris/ });
        if (await btn.count()) {
            await btn.click();
            await p.waitForTimeout(300);
        }
        if (!(await p.locator("main svg").count()))
            out.push("les pictogrammes ne s'affichent pas sans réseau");
    } finally {
        await ctx.close();
        rmSync(profil, { recursive: true, force: true });
    }
    noter("l'application s'ouvre sans réseau", out);
}

// --- 6. Le lien prescrit tient dans le temps ------------------------------------------
// Un lien reçu du kinésithérapeute doit être retenu : à la réouverture, l'accueil montre le
// programme au lieu de redemander au patient de choisir sa blessure parmi quarante-deux.
{
    const out = [];
    const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
    // les sept formes de lien que la fabrique peut produire
    for (const lien of ["#/z/hanche/moyen-fessier", "#/z/genou/entorse/e2", "#/coureur/essuie-glace",
        "#/coureur/essuie-glace/e1", "#/croissance/osgood", "#/croissance/osgood/e1",
        "#/prevention/warmup/course"]) {
        const { p } = await ouvrir(ctx, lien);
        await p.goto(BASE, { waitUntil: "load" });
        await p.waitForTimeout(500);
        const r = await p.evaluate(() => {
            const surtitre = document.querySelector("main p");
            const carte = [...document.querySelectorAll("main button")]
                .find((x) => /ENVOY\u00c9 PAR VOTRE KIN/i.test(x.textContent));
            return {
                surtitre: surtitre ? surtitre.textContent.trim() : "",
                carte: !!carte,
                catalogue: !!document.querySelector('main svg[role="group"]'),
                bouton: [...document.querySelectorAll("main button")]
                    .some((x) => /Voir tous les programmes/.test(x.textContent)),
            };
        });
        if (r.surtitre !== "Votre programme")
            out.push(`${lien} — l'accueil ne reconna\u00eet pas le programme (« ${r.surtitre} »)`);
        if (!r.carte)
            out.push(`${lien} — la carte du programme prescrit manque`);
        if (r.catalogue)
            out.push(`${lien} — le catalogue s'affiche encore alors qu'un programme est prescrit`);
        if (!r.bouton)
            out.push(`${lien} — aucun moyen d'atteindre le catalogue`);
        else {
            await p.getByRole("button", { name: /Voir tous les programmes/ }).click();
            await p.waitForTimeout(300);
            if (!(await p.locator('main svg[role="group"]').count()))
                out.push(`${lien} — le catalogue ne s'ouvre pas quand on le demande`);
        }
        await p.close();
    }
    await ctx.close();
    noter("le lien prescrit est retenu et n'enferme pas", out);
}

// --- 7. Chaque règle de prudence paraît une fois par jour, sur son parcours -----------
// Le premier contrôle qui porte sur un enchaînement d'écrans, et non sur un écran seul.
// Il naît d'un défaut que rien ne surveillait : les quatre parcours portent quatre textes
// différents mais partageaient une seule date « vue aujourd'hui », si bien qu'un patient
// qui faisait son épaule puis ses étirements ne voyait jamais la règle de la prévention.
// Un contrôle de rendu ne l'aurait pas vu : chaque écran, pris isolément, était correct.
{
    const out = [];
    const REGLES = [
        { nom: "blessure", route: "#/z/epaule/coiffe/e1", suivant: "#/z/epaule/coiffe/e2",
            debut: "Arrêtez l'exercice si la douleur dépasse" },
        { nom: "prévention", route: "#/prevention/stretch-post/inferieur", suivant: "#/prevention/flexibility/dos",
            debut: "Ces exercices supposent l'absence de douleur" },
        { nom: "coureur", route: "#/coureur/essuie-glace/e1", suivant: "#/coureur/essuie-glace/e2",
            debut: "Repère de charge" },
        { nom: "croissance", route: "#/croissance/osgood/e1", suivant: "#/croissance/osgood/e2",
            debut: "Arrête si la douleur devient vive" },
    ];
    // Une navigation franche. « goto » sur une adresse qui ne diffère que par le dièse ne
    // recharge pas le document : l'application affiche l'écran, la note s'y marque « vue »,
    // et le rechargement qui suivait ne montrait donc plus rien. La sonde consommait la vue
    // qu'elle mesurait. On passe par une page vierge pour forcer un vrai chargement.
    const ouvrirFranchement = async (p, hash) => {
        await p.goto("about:blank");
        await p.goto(BASE + hash, { waitUntil: "load" });
        await p.waitForSelector("main");
    };
    // On attend l'élément plutôt qu'un délai fixe : sous la charge de la suite entière, les
    // 300 ms d'origine étaient parfois trop courts et le contrôle se déclarait en échec
    // alors que la règle allait paraître. Une attente qui expire vaut « absente ».
    const presente = async (p, debut) => {
        try {
            await p.getByText(debut, { exact: false }).first().waitFor({ state: "visible", timeout: 2500 });
            return true;
        }
        catch {
            return false;
        }
    };

    // a. Chaque règle paraît sur son parcours, quel que soit ce qui a été vu avant.
    for (const ordre of [REGLES, [...REGLES].reverse()]) {
        const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
        // On passe par l'accueil pour écarter l'introduction : ouvrir directement le
        // premier parcours consommerait la vue que le contrôle cherche justement à observer.
        const { p } = await ouvrir(ctx, "#/");
        const vues = [];
        for (const r of ordre) {
            await ouvrirFranchement(p, r.route);
            if (!(await presente(p, r.debut)))
                out.push(`après ${vues.join(", ") || "rien"} — la règle « ${r.nom} » ne paraît pas`);
            // L'application note « vue » dans un effet, et l'enregistre dans un second :
            // partir avant que ce soit écrit ferait lire au prochain écran un état d'avant.
            await p.waitForFunction((cle) => {
                const st = JSON.parse(localStorage.getItem("kine-exercices-v1") || "{}");
                return !!(st.prudenceVue && st.prudenceVue[cle]);
            }, r.nom === "prévention" ? "prevention" : r.nom).catch(() => {});
            vues.push(r.nom);
        }
        await p.close();
        await ctx.close();
    }
    // b. Et elle ne reparaît pas au deuxième écran du même parcours.
    for (const r of REGLES) {
        const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
        const { p } = await ouvrir(ctx, "#/");
        await ouvrirFranchement(p, r.route);
        await ouvrirFranchement(p, r.suivant);
        if (await presente(p, r.debut))
            out.push(`« ${r.nom} » — la règle reparaît au deuxième écran de la journée`);
        await p.close();
        await ctx.close();
    }
    noter("chaque règle de prudence paraît une fois par jour, sur son parcours", out);
}

// --- 8. Les signes d'alerte ne paraissent qu'à l'accueil, une fois par jour -----------
// Ils ont vécu en pied de chaque écran d'exercices et sur chaque écran de bilan. À ce
// rythme ils devenaient un décor. Une seule lecture par jour vaut mieux que dix qu'on ne
// lit plus — encore faut-il qu'elle ait lieu, et qu'elle n'ait pas lieu ailleurs.
{
    const out = [];
    const TITRE = "Quand consulter sans attendre";
    const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
    const { p } = await ouvrir(ctx, "#/");
    // « innerText » rend le texte tel qu'il s'affiche : ce titre porte un text-transform
    // en capitales, et une comparaison sensible à la casse ne le trouvait jamais.
    // Même prudence qu'au contrôle précédent : on attend l'élément, pas un délai.
    const presents = async () => {
        try {
            await p.getByText(TITRE, { exact: false }).first().waitFor({ state: "visible", timeout: 2500 });
            return true;
        }
        catch {
            return false;
        }
    };
    // Même précaution qu'au contrôle précédent : sans passer par une page vierge, « goto »
    // ne recharge pas quand seul le dièse change, et la sonde consomme la vue qu'elle mesure.
    const ouvrirFranchement = async (hash) => {
        await p.goto("about:blank");
        await p.goto(BASE + hash, { waitUntil: "load" });
        await p.waitForSelector("main");
    };
    if (!(await presents()))
        out.push("accueil — les signes ne paraissent pas à la première ouverture du jour");
    for (const [nom, hash] of [["bilan de départ", "#/z/genou/entorse"], ["exercices", "#/z/genou/entorse/e1"],
        ["exercices tardifs", "#/z/genou/entorse/e4"], ["coureur", "#/coureur/essuie-glace/e1"],
        ["croissance bilan", "#/croissance/osgood"], ["croissance exercices", "#/croissance/osgood/e1"],
        ["prévention", "#/prevention/warmup/course"]]) {
        await ouvrirFranchement(hash);
        if (await presents())
            out.push(`${nom} — les signes s'affichent alors qu'ils ne devraient paraître qu'à l'accueil`);
    }
    await ouvrirFranchement("#/");
    if (await presents())
        out.push("accueil — les signes reparaissent à la deuxième ouverture de la journée");
    // Le lendemain : la date retenue est effacée, ils doivent revenir.
    await p.evaluate(() => {
        const st = JSON.parse(localStorage.getItem("kine-exercices-v1") || "{}");
        st.prudenceVue = {};
        localStorage.setItem("kine-exercices-v1", JSON.stringify(st));
    });
    await ouvrirFranchement("#/");
    if (!(await presents()))
        out.push("accueil — les signes ne reviennent pas le lendemain");
    await p.close();
    await ctx.close();
    noter("les signes d'alerte ne paraissent qu'à l'accueil, une fois par jour", out);
}

await navigateur.close();
serveur.close();

rapport.forEach((l) => console.log(l));
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
console.log(`\n${rapport.length} contrôles passés sur ${ROUTES.length} écrans.`);
