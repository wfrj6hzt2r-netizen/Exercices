# Vérification

Dix-neuf contrôles automatiques. Chacun correspond à un défaut réellement survenu, pas à une
règle imaginée : un contrôle qui n'a jamais rien attrapé finit par être ignoré.

## Les lancer

```sh
node verification/statique.mjs          # quelques secondes, rien à installer

npm install --no-save playwright axe-core
npx playwright install --with-deps chromium
node verification/rendu.mjs             # deux à trois minutes
```

Les deux tournent aussi à chaque `push` et à chaque proposition de modification, via
`.github/workflows/verification.yml`.

## Ce qu'ils surveillent, et pourquoi

### Contrôles statiques — `statique.mjs`

| Contrôle | Le défaut qui l'a fait naître |
| --- | --- |
| Le script se compile | Trois parenthèses déséquilibrées en une semaine, chacune produisant un écran blanc |
| Toute classe employée est définie | `pb-4`, `pb-8`, `gap-5`, `mt-2.5`, `mt-3.5` n'existaient pas dans le Tailwind figé de la page : elles ne faisaient rien, sans le moindre signe |
| Aucune couleur hors de la palette | Trente valeurs écrites en dur avaient divergé — sept verts pour trois rôles, deux gris de prose presque identiques |
| Aucun emoji couleur | Quatre emoji système servaient d'icônes ; le dernier a survécu à une passe de remplacement parce qu'il était écrit en clair et non échappé |
| Chaque exercice est complet | — |
| Chaque consigne se termine par un point | Une consigne sans point se lit comme tronquée |
| Le pictogramme ne contredit pas la consigne | Quarante-neuf pictogrammes montraient une posture que leur consigne démentait : un bonhomme allongé pour un exercice décrit assis |
| Tout exercice à élastique offre une version sans | Un patient sans élastique ne doit pas rester bloqué |
| Chaque blessure a des conseils pour les premiers jours | Une consigne sans point final se lit comme tronquée, et une blessure sans conseil laisse l'étape la plus décisive sans autre chose que des exercices |
| L'étiquette de position ne contredit pas le dessin | « Mobilité complète en charge fonctionnelle » affichait « Debout » à deux centimètres d'une silhouette allongée. Le contrôle voisin ne l'a pas vue : il lit la consigne, qui ne nommait aucune posture |
| Chaque « pourquoi » désigne une étape qui existe | La table est indexée par libellé d'étape : un libellé mal orthographié n'afficherait rien, sans la moindre erreur |

### Contrôles de rendu — `rendu.mjs`

| Contrôle | Le défaut qui l'a fait naître |
| --- | --- |
| Chaque écran s'affiche sans erreur | 21 écrans, console surveillée |
| Rien n'est coupé ni ne déborde | « Thoraciques » sortait du cadre du mannequin, le texte indicatif de la recherche était rogné en plein mot, un surtitre passait à deux lignes. Contrôlé aux trois tailles de texte |
| Le texte reste lisible dans les deux thèmes | Contraste calculé en composant les couches translucides, seuils WCAG AA |
| Aucune violation d'accessibilité | axe-core sur les dix premiers écrans. L'élément fautif est nommé : une violation de contraste vue une fois et non reproduite est restée indiagnosticable faute de savoir sur quoi elle portait |
| L'application s'ouvre sans réseau | C'est sa promesse centrale, et un service worker cassé ne se voit pas tant qu'on a du réseau |
| Le lien prescrit est retenu et n'enferme pas | Les sept formes de lien : l'accueil doit reconnaître le programme, ne pas afficher le catalogue, et laisser un moyen de l'atteindre |
| Chaque règle de prudence paraît une fois par jour, sur son parcours | Les quatre parcours portent quatre textes différents mais partageaient une seule date « vue aujourd'hui » : un patient qui faisait son épaule puis ses étirements ne voyait jamais la règle de la prévention |
| Les signes d'alerte ne paraissent qu'à l'accueil, une fois par jour | Ils ont vécu en pied de chaque écran d'exercices et sur chaque écran de bilan : à ce rythme ils devenaient un décor |

## Un piège de sonde, deux fois rencontré

Deux contrôles portent sur un enchaînement d'écrans. Tous deux ont d'abord échoué à cause
de leur propre montage : `goto` sur une adresse qui ne diffère que par le dièse **ne
recharge pas le document**. L'application affichait l'écran, la note s'y marquait « vue », et
le rechargement qui suivait ne montrait plus rien — la sonde consommait la vue qu'elle
mesurait. On passe désormais par une page vierge pour forcer un vrai chargement.

## Deux contrôles à part

Les deux derniers sont les seuls qui portent sur un **enchaînement d'écrans** et non sur un écran isolé.
Le défaut qui l'a fait naître était invisible autrement : pris un par un, chaque écran était
correct — c'est leur succession qui perdait une règle en route. Quand un défaut ne se voit
qu'en passant d'un écran à l'autre, c'est ici qu'il faut écrire le contrôle.

## Deux tolérances assumées

**Les surtitres en capitales espacées** ne sont contrôlés qu'aux tailles normale et agrandie.
Au cran le plus grand, le repli est inévitable et légitime : le patient a demandé un texte
beaucoup plus grand. Ce qui n'est toléré à aucune taille, c'est la perte d'information — un
texte rogné est signalé partout.

**Les couleurs autorisées hors palette** sont celles du mannequin (`MANNEQUIN_*`) et le blanc.
Le dessin du corps est une image sans canal alpha : sa carte reste claire dans les deux
thèmes, et ce qui s'y pose garde donc les encres claires.

## Comment lire un échec

Chaque contrôle nomme les cas plutôt que de compter. Un échec ressemble à ceci :

```
ÉCHEC  le pictogramme ne contredit pas la consigne  (2 cas)

--- le pictogramme ne contredit pas la consigne : 2 cas ---
    Renforcement — « Isométrique des fléchisseurs » : dessin « allonge », consigne « assis »
```

## Ajouter un contrôle

Dans `statique.mjs` ou `rendu.mjs`, appelez `controle(nom, fn)` ou `noter(nom, lignes)` : la
fonction rend la liste des cas fautifs, vide si tout va bien. Écrivez au-dessus le défaut qui
l'a motivé — c'est ce qui permet, plus tard, de décider si une tolérance est encore justifiée.

Vérifiez qu'un nouveau contrôle **échoue** sur un défaut introduit exprès avant de le
considérer comme acquis. Un contrôle qui passe toujours ne prouve rien.
