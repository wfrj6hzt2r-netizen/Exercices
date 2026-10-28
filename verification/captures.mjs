// Photographie les vingt-sept écrans, et dit lesquels ont bougé entre deux versions.
//
// Les contrôles de rendu disent « rien n'est coupé », « le contraste tient », « aucune
// erreur console ». Ils ne disent pas « cet écran ressemble à ce qu'il était ». Sur une
// refonte visuelle c'est pourtant la question : qu'est-ce qui a changé, et qu'est-ce qui a
// changé sans qu'on le veuille. Cet outil répond aux deux, en images.
//
//   node verification/captures.mjs                 photographie l'état actuel
//   node verification/captures.mjs --avant main    photographie aussi « main », et compare
//
// Rien n'est versionné : les images vont dans « verification/captures/ », que .gitignore
// écarte. Ce qui compte dans le dépôt, c'est l'outil, pas ses sorties.

import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, join } from "node:path";
import { chromium } from "playwright";
import { RACINE } from "./lire.mjs";
import { ROUTES } from "./ecrans.mjs";

const PORT = 8124;
const BASE = `http://127.0.0.1:${PORT}/`;
const SORTIE = join(RACINE, "verification", "captures");
const TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".png": "image/png", ".webmanifest": "application/manifest+json",
};

const args = process.argv.slice(2);
const iAvant = args.indexOf("--avant");
const revision = iAvant >= 0 ? args[iAvant + 1] : null;
if (iAvant >= 0 && !revision) {
    console.error("« --avant » attend une révision git, par exemple « --avant main ».");
    process.exit(2);
}

// Le serveur sert le fichier que « source » désigne : l'index.html du dépôt, ou la copie
// tirée d'une révision passée. On bascule l'un pour l'autre entre deux séries.
let source = join(RACINE, "index.html");
const serveur = createServer((req, res) => {
    let chemin = decodeURIComponent(req.url.split("?")[0]);
    if (chemin.endsWith("/"))
        chemin += "index.html";
    try {
        const corps = readFileSync(chemin === "/index.html" ? source : join(RACINE, chemin));
        res.writeHead(200, { "Content-Type": TYPES[extname(chemin)] || "application/octet-stream",
            "Cache-Control": "no-cache" });
        res.end(corps);
    } catch {
        res.writeHead(404);
        res.end("absent");
    }
});
await new Promise((r) => serveur.listen(PORT, "127.0.0.1", r));

const LANCEMENT = process.env.CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
    : {};
const navigateur = await chromium.launch(LANCEMENT);

const slug = (nom) => nom.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Photographie les vingt-sept écrans dans un sous-dossier, et rend leur hauteur.
 * Le facteur d'échelle reste à 1 : l'écran du lexique fait douze mille pixels de haut, et
 * le doubler ne montrerait rien de plus qu'on ne verrait déjà.
 */
async function serie(dossier) {
    mkdirSync(join(SORTIE, dossier), { recursive: true });
    const ctx = await navigateur.newContext({
        viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const hauteurs = {};
    for (const [nom, hash] of ROUTES) {
        const p = await ctx.newPage();
        await p.goto(BASE + hash, { waitUntil: "load" });
        await p.waitForSelector("main", { timeout: 8000 }).catch(() => {});
        const bouton = p.getByRole("button", { name: /J'ai compris/ });
        if (await bouton.count()) {
            await bouton.click();
            await p.waitForTimeout(400);
        }
        // Les transitions de largeur des jauges d'étape durent trois dixièmes de seconde :
        // sans cette attente, deux séries identiques diffèrent de quelques pixels.
        await p.waitForTimeout(500);
        await p.screenshot({ path: join(SORTIE, dossier, slug(nom) + ".png"), fullPage: true });
        hauteurs[nom] = await p.evaluate(() => document.body.scrollHeight);
        await p.close();
    }
    await ctx.close();
    return hauteurs;
}

/**
 * Compare deux images dans le navigateur, faute de décodeur PNG sous Node. Rend la part de
 * pixels qui diffèrent, et une image où ce qui a bougé est rouge sur un fond éteint.
 */
async function comparer(page, cheminA, cheminB) {
    const lire = (c) => "data:image/png;base64," + readFileSync(c).toString("base64");
    return page.evaluate(async ([a, b]) => {
        const charger = (src) => new Promise((r) => {
            const i = new Image();
            i.onload = () => r(i);
            i.src = src;
        });
        const ia = await charger(a);
        const ib = await charger(b);
        const w = Math.max(ia.width, ib.width);
        const h = Math.max(ia.height, ib.height);
        const pixels = (img) => {
            const cv = document.createElement("canvas");
            cv.width = w;
            cv.height = h;
            const x = cv.getContext("2d", { willReadFrequently: true });
            x.fillStyle = "#fff";
            x.fillRect(0, 0, w, h);
            x.drawImage(img, 0, 0);
            return x.getImageData(0, 0, w, h).data;
        };
        const da = pixels(ia);
        const db = pixels(ib);
        const out = new Uint8ClampedArray(w * h * 4);
        let n = 0;
        for (let i = 0; i < da.length; i += 4) {
            // Un seuil de vingt-quatre sur la somme des trois canaux : en deçà, c'est le
            // lissage des polices, qui varie d'un rendu à l'autre sans que rien n'ait bougé.
            const ecart = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1])
                + Math.abs(da[i + 2] - db[i + 2]);
            const bouge = ecart > 24;
            if (bouge)
                n++;
            const gris = 255 - (255 - (da[i] * 0.3 + da[i + 1] * 0.59 + da[i + 2] * 0.11)) * 0.22;
            out[i] = bouge ? 214 : gris;
            out[i + 1] = bouge ? 38 : gris;
            out[i + 2] = bouge ? 38 : gris;
            out[i + 3] = 255;
        }
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        cv.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);
        return { part: (n / (w * h)) * 100, png: cv.toDataURL("image/png") };
    }, [lire(cheminA), lire(cheminB)]);
}

const echap = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

if (!revision) {
    rmSync(join(SORTIE, "actuel"), { recursive: true, force: true });
    const h = await serie("actuel");
    console.log(`${ROUTES.length} écrans photographiés dans verification/captures/actuel/`);
    for (const [nom, haut] of Object.entries(h))
        console.log(`  ${String(haut).padStart(6)} px  ${nom}`);
} else {
    // La révision passée est écrite à part : le dépôt n'est jamais touché, et un plantage
    // en cours de route ne laisse pas un index.html étranger à sa place.
    const copie = join(SORTIE, "index-avant.html");
    mkdirSync(SORTIE, { recursive: true });
    writeFileSync(copie, execFileSync("git", ["show", `${revision}:index.html`],
        { cwd: RACINE, maxBuffer: 64 * 1024 * 1024 }));

    rmSync(join(SORTIE, "avant"), { recursive: true, force: true });
    rmSync(join(SORTIE, "apres"), { recursive: true, force: true });
    source = copie;
    const hAvant = await serie("avant");
    source = join(RACINE, "index.html");
    const hApres = await serie("apres");

    const page = await (await navigateur.newContext()).newPage();
    const lignes = [];
    for (const [nom] of ROUTES) {
        const f = slug(nom) + ".png";
        const { part, png } = await comparer(page, join(SORTIE, "avant", f), join(SORTIE, "apres", f));
        writeFileSync(join(SORTIE, "apres", "diff-" + f),
            Buffer.from(png.split(",")[1], "base64"));
        lignes.push({ nom, f, part, avant: hAvant[nom], apres: hApres[nom] });
    }
    lignes.sort((a, b) => b.part - a.part);

    const bloc = (l) => `<section class="e${l.part < 0.02 ? " calme" : ""}">
  <h2>${echap(l.nom)} <span>${l.part.toFixed(2)} % des pixels · ${l.avant} → ${l.apres} px de haut</span></h2>
  <div class="t"><figure><img src="../avant/${l.f}"><figcaption>avant</figcaption></figure>
   <figure><img src="../apres/${l.f}"><figcaption>après</figcaption></figure>
   <figure><img src="diff-${l.f}"><figcaption>ce qui a bougé</figcaption></figure></div></section>`;
    const bouge = lignes.filter((l) => l.part >= 0.02);
    // La part de pixels se lit de travers si on la prend pour « l'ampleur du changement » :
    // un décalage de trente pixels fait différer tout ce qui se trouve en dessous. Elle dit
    // donc plutôt à quelle hauteur de l'écran le changement commence. L'image de différence,
    // elle, montre ce qui a vraiment bougé.
    const AVERTISSEMENT = `<p class="i">${bouge.length} écran${bouge.length > 1 ? "s ont" : " a"}
bougé sur ${ROUTES.length}. Les écrans sous 0,02&nbsp;% sont grisés&nbsp;: à cette échelle,
c'est le lissage des polices, pas une modification.</p>
<p class="i">La part de pixels ne mesure pas l'ampleur du changement mais sa hauteur de
départ&nbsp;: un bloc qui grandit de trente pixels décale tout ce qui le suit, et tout ce qui
le suit compte alors comme différent. C'est l'image de droite qu'il faut regarder.</p>`;
    const STYLE = `<style>
body{background:#F5F8FA;font:15px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:24px;color:#0F172A}
h1{font-size:22px;margin:0 0 4px}.i{color:#4B5565;margin:0 0 14px;max-width:760px}
.e{background:#fff;border:1px solid #DCE4EA;border-radius:14px;padding:16px;margin-bottom:16px}
.e.calme{opacity:.55}
h2{font-size:16px;margin:0 0 12px;font-weight:600}
h2 span{font-weight:400;color:#8A94A6;font-size:13px;margin-left:8px}
.t{display:flex;gap:14px;align-items:flex-start;overflow-x:auto}
figure{margin:0;flex:none}figure img{width:260px;display:block;border:1px solid #E6ECF0;border-radius:8px}
figcaption{font-size:12px;color:#8A94A6;text-align:center;margin-top:4px}
</style>`;
    writeFileSync(join(SORTIE, "apres", "rapport.html"), `<!doctype html><meta charset="utf-8">
<title>Écrans : ${echap(revision)} → état actuel</title>${STYLE}
<h1>Écrans : ${echap(revision)} → état actuel</h1>${AVERTISSEMENT}
${lignes.map(bloc).join("\n")}`);

    // Et la même chose en une seule image, pour les écrans qui ont bougé : un rapport en
    // HTML ne se regarde pas dans une conversation, une planche si.
    if (bouge.length) {
        // L'écran du lexique fait douze mille pixels de haut : sans plafond, la planche
        // pèserait quatre méga-octets pour montrer une liste qui se répète. On coupe au
        // premier écran et demi, et le rapport garde les images entières.
        writeFileSync(join(SORTIE, "apres", "planche.html"), `<!doctype html><meta charset="utf-8">
${STYLE}<style>figure img{max-height:760px;object-fit:cover;object-position:top}</style>
<h1>Écrans : ${echap(revision)} → état actuel</h1>${AVERTISSEMENT}
<p class="i">Les écrans longs sont coupés en bas&nbsp;; le rapport HTML les montre entiers.</p>
${bouge.map(bloc).join("\n")}`);
        const pl = await (await navigateur.newContext({
            viewport: { width: 900, height: 800 }, deviceScaleFactor: 1 })).newPage();
        await pl.goto("file://" + join(SORTIE, "apres", "planche.html"), { waitUntil: "load" });
        await pl.waitForTimeout(400);
        await pl.screenshot({ path: join(SORTIE, "apres", "planche.png"), fullPage: true });
        await pl.close();
    }

    console.log(`\n${bouge.length} écran(s) ont bougé sur ${ROUTES.length}\n`);
    for (const l of lignes) {
        const marque = l.part >= 0.02 ? "  BOUGE" : "   =   ";
        const dh = l.apres - l.avant;
        console.log(`${marque} ${l.part.toFixed(2).padStart(6)} %  ${String(dh > 0 ? "+" + dh : dh).padStart(7)} px  ${l.nom}`);
    }
    console.log("\nverification/captures/apres/rapport.html"
        + (bouge.length ? "\nverification/captures/apres/planche.png" : ""));
}

await navigateur.close();
serveur.close();
