# Vérification

Quarante-trois contrôles automatiques — trente-trois statiques, dix sur rendu. Chacun correspond à un défaut réellement survenu, pas à une
règle imaginée : un contrôle qui n'a jamais rien attrapé finit par être ignoré.

Un troisième script, `mutation.mjs`, introduit un défaut par contrôle statique, un par un, et vérifie que le
contrôle concerné les voit. Deux d'entre eux avaient cessé de vérifier quoi que ce soit sans
que rien ne le signale.

## Les lancer

```sh
node verification/statique.mjs          # quelques secondes, rien à installer

npm install --no-save playwright axe-core
npx playwright install --with-deps chromium
node verification/rendu.mjs             # deux à trois minutes

node verification/mutation.mjs          # une vingtaine de secondes
```

Les trois tournent aussi à chaque `push` et à chaque proposition de modification, via
`.github/workflows/verification.yml`, en trois tâches séparées : l'échec le plus courant
remonte ainsi sans attendre le navigateur.

Sur une machine qui a déjà Chromium mais pas la version attendue par Playwright,
`CHROMIUM_EXECUTABLE=/chemin/vers/chrome` évite le téléchargement. Et comme pour les
contrôles statiques, `EXERCICES_SOURCE` substitue à `index.html` un fichier trafiqué le
temps d'une exécution, sans jamais toucher au vrai : c'est ainsi qu'on vérifie que ces
contrôles-ci mordent encore.

## Ce qu'ils surveillent, et pourquoi

### Contrôles statiques — `statique.mjs`

| Contrôle | Le défaut qui l'a fait naître |
| --- | --- |
| Le script se compile | Trois parenthèses déséquilibrées en une semaine, chacune produisant un écran blanc |
| Tout symbole majuscule employé est déclaré | En retirant un bloc de code, une constante voisine est partie avec. Le script compilait toujours et les contrôles de contenu passaient, mais cinq écrans ne s'affichaient plus : un identifiant absent n'est une erreur qu'à l'exécution, et seulement sur le chemin qui l'emprunte |
| Toute classe employée est définie | `pb-4`, `pb-8`, `gap-5`, `mt-2.5`, `mt-3.5` n'existaient pas dans le Tailwind figé de la page : elles ne faisaient rien, sans le moindre signe |
| Aucune couleur hors de la palette | Trente valeurs écrites en dur avaient divergé — sept verts pour trois rôles, deux gris de prose presque identiques |
| Aucun emoji couleur | Quatre emoji système servaient d'icônes ; le dernier a survécu à une passe de remplacement parce qu'il était écrit en clair et non échappé |
| Chaque exercice est complet | — |
| Chaque consigne se termine par un point | Une consigne sans point se lit comme tronquée |
| Le pictogramme ne contredit pas la consigne | Quarante-neuf pictogrammes montraient une posture que leur consigne démentait : un bonhomme allongé pour un exercice décrit assis. Depuis, l'application bascule d'elle-même sur un dessin de remplacement, et le contrôle ne pouvait plus rien trouver puisqu'il lisait le dessin d'après la bascule. Il vérifie maintenant que la bascule aboutit : un remplaçant qui contredit à son tour, ou l'absence de remplaçant, restent des défauts. Le dos et le flanc comptaient pour une seule posture, « allongé » : huit exercices qui commencent par « Allongé sur le dos » montraient une silhouette couchée sur le côté, et le contrôle les voyait d'accord. Ils se déclarent désormais séparément, comme le ventre et les quatre pattes. Une consigne qui laisse le choix — « Assis ou allongé » — nomme deux postures acceptables plutôt qu'une seule, faute de quoi un étirement debout passait pour conforme. « À genoux » n'était pas lu du tout : un étirement « un genou au sol » a montré quelqu'un debout tenant son pied, et la relecture d'octobre 2026 l'a trouvé à la main. La posture est lue depuis, et le contrôle vérifie que chacune des postures se lit encore |
| Tout exercice à élastique offre une version sans | Un patient sans élastique ne doit pas rester bloqué. Le contrôle lui-même est tombé en panne : il appelait sa fonction avec le mauvais argument et ne voyait plus aucun des soixante exercices concernés. Il vérifie désormais qu'aucun élastique n'est nommé par un autre mot, qu'aucune consigne ne dise déjà le repli, et que le repérage voie encore quelque chose |
| Chaque blessure a des conseils pour les premiers jours | Une consigne sans point final se lit comme tronquée, et une blessure sans conseil laisse l'étape la plus décisive sans autre chose que des exercices |
| L'étiquette de position ne contredit pas le dessin | « Mobilité complète en charge fonctionnelle » affichait « Debout » à deux centimètres d'une silhouette allongée. Le contrôle voisin ne l'a pas vue : il lit la consigne, qui ne nommait aucune posture |
| Le repère d'effort ne contredit pas la consigne | Le repère se déduit du nom et de la consigne, et s'est trompé cinq fois : « Montée de marche » prise pour de la marche, « Balancers » pour un lancer, « Squat mural maintenu » pour de la charge lourde, « Extension sur rouleau » pour du renforcement, et la glace après le sport — dix minutes — pour des répétitions |
| Les repères tutoyés couvrent les mêmes familles, sans charge inventée | Le parcours croissance affiche les mêmes repères à la deuxième personne. Une famille absente de la table tutoyée n'afficherait rien, sans erreur ; et « assez lourd » n'a de sens pour un enfant que si une charge est nommée quelque part |
| Chaque rythme propre couvre toutes ses étapes | Six parcours remplacent le rythme par défaut par le leur. Une entrée manquante ne se verrait pas en lisant le fichier : l'écran lit le rythme par index et se rendrait vide sur la dernière étape, celle qu'on ouvre le moins souvent en vérifiant |
| Chaque mot du lexique est écrit quelque part dans l'application | « scapulo » a vécu depuis sa création sans qu'aucun texte ne contienne ce mot : une définition que personne ne pouvait voir, et que personne ne corrigeait donc. Le contrôle a d'abord cherché dans les seules cartes d'exercice ; il lit maintenant tout le texte de l'application, commentaires exclus — sa première version passait parce qu'un commentaire citait en exemple les trois mots manquants |
| Aucun mot du lexique n'est masqué par un autre | La recherche rend le premier terme contenu dans le texte, dans l'ordre du tableau. « abdomino-adducteurs », placé derrière « adducteurs », n'est jamais sorti : la carte qui écrivait le mot composé expliquait l'intérieur de la cuisse |
| Les mots réservés au lexique n'en sortent jamais | « prévention » et « échauffement » figurent dans la consigne de quatre exercices, où leur définition répond à une question que personne ne se pose à cet endroit : ils restent définis, sans déclencher de pastille. Le contrôle garde sa propre copie de la liste — sa première version la lisait dans le fichier, et le banc l'a prise en défaut : retirer un mot de l'ensemble la rendait aveugle à son propre défaut |
| L'écran du lexique montre tout le tableau | L'écran se déduit du tableau des définitions, et c'est précisément ce qu'on vérifie : un mot ajouté doit y paraître sans qu'on y pense, et le classement par lettre ne doit en perdre aucun en route |
| Tout dessin de silhouette entière déclare sa posture | Le contrôle de cohérence compare la posture que la consigne nomme à celle que le dessin déclare. Un dessin qui n'en déclare aucune n'est comparé à rien : trois « bascules du bassin », dont la consigne commence par « allongé sur le dos », ont montré un homme debout pendant des mois sans qu'aucun des vingt-cinq autres contrôles ne puisse le voir. Les dessins qui ne montrent pas une silhouette — un bloc-notes, un pied, une tête, un élastique — sont exemptés par une liste écrite en clair, et c'est elle qu'il faut modifier pour en exempter un de plus |
| Chaque « pourquoi » désigne une étape qui existe | La table est indexée par libellé d'étape : un libellé mal orthographié n'afficherait rien, sans la moindre erreur |
| Aucun écran du patient ne mène à la fabrique de liens | Une version a montré une ligne « Lien patient » dans le Profil du téléphone qui avait ouvert la fabrique. Le praticien n'en veut aucune trace côté patient : la fabrique s'ouvre par `praticien.html`, et par aucun bouton ni lien de l'application. Le contrôle vérifie aussi que cette page ouvre bien la fabrique, et qu'elle ne porte pas le manifeste des patients |
| Le QR code se lit | La fabrique de liens dessine elle-même ses QR codes, sans bibliothèque tierce. Un code faux ne se lit pas, et rien ne le signale. Le contrôle confronte le dessin aux valeurs de référence de la norme (correcteurs de l'exemple « HELLO WORLD », mot de format, mot de version) et à sa structure |
| Le rythme porté par le lien ne casse pas le lien | La fabrique ajoute « ?s=5 » au lien quand le kinésithérapeute attend un autre rythme que trois séances par semaine. Si la lecture de l'adresse ne l'écartait pas, « entorse?s=5 » ne désignerait plus aucune blessure et le patient atterrirait sur l'accueil, son programme perdu |
| La baisse de douleur affichée est exacte | L'écran Progrès affiche un badge « −60 % » que le patient montre à son kinésithérapeute. Un signe inversé ferait lire une aggravation comme un progrès ; le contrôle vérifie aussi que le point de départ ouvre la courbe, que la note retenue pour un jour est la plus haute, et qu'une première note à zéro ne produit aucun pourcentage |
| Le repos affiché suit la règle du praticien | Le contenu n'écrit aucun temps de repos ; la fiche d'exercice en déduit un du dosage, selon la règle donnée par le praticien en octobre 2026 — trente secondes après des répétitions, autant que le travail pour un maintien en secondes, rien pour un travail en minutes. Le contrôle fige le résultat jugé sur sept dosages types, et vérifie qu'aucun dosage qui ne décrit pas des séries ne reçoit de tuiles |
| Une sauvegarde ancienne garde toute sa progression | La refonte de 2026 a porté la sauvegarde en version 4. Les trois migrations précédentes n'avaient été vérifiées qu'en ouvrant l'application sur un téléphone qui gardait une sauvegarde d'avant — en pratique, chez le patient. Le contrôle rejoue une sauvegarde v1, une v3, le passage au lendemain et une seconde lecture, et exige que coches, journal, douleurs, charges, programme prescrit et réglages survivent |
| La vignette de l'accueil est bien l'icône installée | Le logo encastré dans la page et le fichier `icon-192.png` avaient divergé : l'accueil montrait un dessin que l'icône posée sur l'écran d'accueil ne montrait plus. Le contrôle compare les octets |

### Contrôles de rendu — `rendu.mjs`

| Contrôle | Le défaut qui l'a fait naître |
| --- | --- |
| Chaque écran s'affiche sans erreur | 32 écrans, console surveillée. Un écran qui ne rend rien est un résultat nommé, et arrête la suite : les contrôles suivants mesureraient des couleurs sur des pages vides |
| Rien n'est coupé ni ne déborde | « Thoraciques » sortait du cadre du mannequin, le texte indicatif de la recherche était rogné en plein mot, un surtitre passait à deux lignes. Contrôlé aux trois tailles de texte |
| Le texte reste lisible dans les deux thèmes | Contraste calculé en composant les couches translucides, seuils WCAG AA |
| Aucune violation d'accessibilité | axe-core sur tous les écrans. Il s'arrêtait aux dix premiers, et les seize suivants — la scoliose, la croissance, la prévention, le récapitulatif, « À propos », la fabrique de liens — n'avaient jamais été examinés. L'élément fautif est nommé : une violation de contraste vue une fois et non reproduite est restée indiagnosticable faute de savoir sur quoi elle portait |
| L'application s'ouvre sans réseau | C'est sa promesse centrale, et un service worker cassé ne se voit pas tant qu'on a du réseau |
| Le lien prescrit est retenu et n'enferme pas | Les sept formes de lien : l'accueil doit reconnaître le programme, ne pas afficher le catalogue, et laisser un moyen de l'atteindre |
| Chaque règle de prudence paraît une fois par jour, sur son parcours | Les quatre parcours portent quatre textes différents mais partageaient une seule date « vue aujourd'hui » : un patient qui faisait son épaule puis ses étirements ne voyait jamais la règle de la prévention |
| Les signes d'alerte ne paraissent qu'à l'accueil, une fois par jour | Ils ont vécu en pied de chaque écran d'exercices et sur chaque écran de bilan : à ce rythme ils devenaient un décor |
| Le relevé de douleur n'invente aucune valeur | Le curseur partait à 2 sur 10 : un patient qui touchait « Enregistrer » sans y poser le doigt transmettait un 2 qu'il n'avait jamais dit |
| La coche de la fiche et celle de la liste ne font qu'une | Depuis la refonte, un exercice se coche d'un geste sur la liste ou par le gros bouton de sa fiche. Deux états qui divergeraient montreraient l'exercice fait sur un écran et à faire sur l'autre. Éprouvé à la main sur une copie où le bouton de la fiche ne cochait plus : trois cas rouges |

## Lire du JavaScript sans analyseur syntaxique

Le contrôle des symboles doit distinguer le code du reste. Une expression régulière n'y
suffit pas : celle qui tentait d'apparier les gabarits en avalait deux cent quarante mille
caractères d'un seul tenant. Un lecteur caractère par caractère la remplace, et il a fallu
quatre corrections avant qu'il soit juste — le guillemet oblique de fermeture pris pour une
ouverture, le texte d'un gabarit analysé comme du code (une apostrophe française y ouvrait
une chaîne), la barre oblique après `return` lue comme une division, et les jetons de
substitution collés aux identifiants. Chacune faisait accuser des constantes parfaitement
déclarées.

La leçon tient en une ligne : **un contrôle qui signale un défaut inexistant est un défaut**,
et se corrige avant d'être publié.

## Un piège de sonde, deux fois rencontré

Deux contrôles portent sur un enchaînement d'écrans. Tous deux ont d'abord échoué à cause
de leur propre montage : `goto` sur une adresse qui ne diffère que par le dièse **ne
recharge pas le document**. L'application affichait l'écran, la note s'y marquait « vue », et
le rechargement qui suivait ne montrait plus rien — la sonde consommait la vue qu'elle
mesurait. On passe désormais par une page vierge pour forcer un vrai chargement.

## Les captures d'écran — `captures.mjs`

Les contrôles disent « rien n'est coupé », « le contraste tient », « aucune erreur
console ». Ils ne disent pas « cet écran ressemble à ce qu'il était ». Sur une refonte
visuelle c'est pourtant la question : qu'est-ce qui a changé, et qu'est-ce qui a changé
sans qu'on le veuille.

```
node verification/captures.mjs                 photographie tous les écrans
node verification/captures.mjs --avant main    photographie aussi « main », et compare
```

Sans `--avant`, l'outil écrit aussi une **planche de contact de tous les écrans** en une
seule image : l'inventaire de l'application à un instant donné, qu'on peut envoyer et
regarder d'un coup.

La comparaison écrit trois choses dans `verification/captures/apres/` : un **rapport HTML**
avec avant, après et ce qui a bougé pour chaque écran ; une **planche en PNG** des seuls
écrans modifiés, lisible dans une conversation ; et la liste triée sur la sortie standard.
Rien n'est versionné : `.gitignore` écarte le dossier, c'est l'outil qui compte.

La part de pixels ne mesure pas l'ampleur d'un changement mais sa **hauteur de départ** :
un bloc qui grandit de trente pixels décale tout ce qui le suit, et tout ce qui le suit
compte alors comme différent. C'est l'image de différence qu'il faut regarder.

La liste des écrans vit dans `ecrans.mjs`, lu par la suite de rendu **et** par cet outil :
deux copies auraient dérivé dès le premier écran ajouté d'un seul côté.

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

## Le banc de mutation — `mutation.mjs`

Deux contrôles de cette suite ont passé des mois à ne rien vérifier. Celui des élastiques
appelait sa fonction avec le mauvais argument ; celui des pictogrammes lisait le dessin
après une bascule qui résout déjà toute contradiction. Les deux passaient au vert. **Un
contrôle vert qui ne peut pas rougir est pire que pas de contrôle : il rassure.**

Le banc empêche cette panne de revenir. Pour chaque contrôle, il injecte dans une copie du
fichier le défaut que ce contrôle prétend attraper, relance la suite statique, et vérifie
que c'est bien celui-là qui échoue. Le vrai `index.html` n'est jamais touché : la copie
trafiquée passe par la variable `EXERCICES_SOURCE`, car une sauvegarde suivie d'une
restauration laisserait le dépôt abîmé au moindre plantage en cours de route.

Deux issues sont rapportées. Un contrôle **muet** n'a pas vu son défaut. Une mutation
**ratée** ne s'applique plus, le fichier ayant changé sous elle : il faut alors la réécrire,
et surtout pas la supprimer.

La mutation doit viser un texte **unique** dans le fichier. Une consigne partagée par deux
exercices a fait déclarer un contrôle muet à tort, la mutation frappant un homonyme.

## Ajouter un contrôle

Dans `statique.mjs` ou `rendu.mjs`, appelez `controle(nom, fn)` ou `noter(nom, lignes)` : la
fonction rend la liste des cas fautifs, vide si tout va bien. Écrivez au-dessus le défaut qui
l'a motivé — c'est ce qui permet, plus tard, de décider si une tolérance est encore justifiée.

Vérifiez qu'un nouveau contrôle **échoue** sur un défaut introduit exprès avant de le
considérer comme acquis. Un contrôle qui passe toujours ne prouve rien.

Ajoutez la mutation correspondante dans `mutation.mjs` : c'est ce qui transforme cette
consigne en garantie, plutôt qu'en intention.
