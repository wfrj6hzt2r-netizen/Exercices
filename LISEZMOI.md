# Mes exercices

Programme d'exercices de rééducation, remis en consultation par
**Maxime Chevallier, masseur-kinésithérapeute**, et destiné à ses patients entre deux séances.

955 exercices, 42 blessures sur 10 zones, plus trois parcours à part : coureur, croissance,
prévention. L'application s'ouvre sans réseau une fois ajoutée à l'écran d'accueil, ne demande
aucun compte, et rien de ce que le patient coche ne quitte son téléphone.

## Envoyer un programme à un patient

Ouvrez **`#/lien`** — par exemple `https://…/#/lien`. Cet écran n'est référencé nulle part
dans l'application : les patients ne le rencontrent pas.

Choisissez la zone, la blessure et le point de départ, puis copiez le lien et envoyez-le.

Le patient qui ouvre ce lien arrive directement sur son programme, et **l'application s'en
souvient** : à chaque ouverture suivante, l'accueil affiche « Votre programme » au lieu de lui
demander de choisir sa blessure parmi quarante-deux. Le catalogue reste accessible d'un
bouton, pour une douleur nouvelle.

Le **bilan de départ** est le point d'entrée recommandé : il fait choisir au patient son stade
en fonction de ce qu'il ressent le jour où il ouvre le lien. Ouvrir une étape précise
court-circuite ce réglage.

Envoyer un nouveau lien remplace le précédent.

## Ce que contient le dépôt

| Fichier | |
| --- | --- |
| `index.html` | Toute l'application : contenu, écrans, styles, React inclus. Aucune étape de compilation |
| `sw.js` | Le service worker, qui rend l'ouverture possible sans réseau |
| `manifest.webmanifest`, `*.png` | L'installation sur l'écran d'accueil |
| `verification/` | Dix-neuf contrôles automatiques — voir son [mode d'emploi](verification/LISEZMOI.md) |
| `.github/workflows/` | Les mêmes contrôles, à chaque modification |

## Modifier le contenu

Les exercices vivent dans `index.html`, dans les tableaux `PATHOLOGIES`, `RUNNER_DATA`,
`CROISSANCE_DATA` et `PREVENTION_CATEGORIES`. Un exercice ressemble à ceci :

```js
{ name: "Isométrique quadriceps", dose: "5 × 30 sec",
  tip: "Assis ou allongé, jambe tendue. Contractez le muscle à l'avant de la cuisse…" }
```

Trois choses à savoir avant d'y toucher :

1. **La consigne décide du pictogramme**, pas le titre. Écrire « assis » dans la consigne fait
   apparaître un bonhomme assis. C'est voulu : le titre nomme le geste, la consigne décrit la
   position, et c'est elle qui est fiable.
2. **Toute consigne se termine par un point**, et les couleurs se prennent dans la palette
   déclarée en tête de fichier — jamais écrites en dur.
3. **Lancez les contrôles avant de publier** : `node verification/statique.mjs`. Ils prennent
   quelques secondes et connaissent les pièges de ce fichier.

## Publier

Le dépôt est servi par GitHub Pages. Pousser sur `main` publie.

Les patients ne voient pas la nouvelle version immédiatement : le service worker sert d'abord
ce qu'il a en cache, affiche une bannière « une nouvelle version est disponible », et applique
le changement au rechargement. C'est délibéré — l'application ne doit jamais dépendre du
réseau pour s'ouvrir.

Pensez à remonter la date de dernière révision (`CABINET.revision`) quand le contenu change :
elle s'affiche dans l'écran « À propos ».
