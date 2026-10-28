# Travailler sur ce dépôt

Ce fichier est lu au début de chaque session. Il dit ce qu'une conversation ne peut pas
transmettre : les contraintes du fichier, la façon de travailler avec le praticien, et les
pièges dans lesquels on est déjà tombé.

Pour ce que fait l'application et comment on s'en sert : [LISEZMOI.md](LISEZMOI.md).
Pour les contrôles : [verification/LISEZMOI.md](verification/LISEZMOI.md).

## Avant de commencer

Lire les **issues ouvertes** du dépôt : elles portent le travail en cours et les décisions
en attente, et chacune dit le défaut qui l'a fait naître.

**Les issues fermées comptent autant.** Elles gardent le raisonnement, pas seulement le
résultat, et plusieurs resservent :

| | |
| --- | --- |
| **#74** | L'audit typographique du designer, avec le comptage fait dans le code : huit classes de taille, quatre styles d'étiquette, trois paddings de carte, quatre rayons, et des rôles de couleur qui se chevauchent. C'est le document de référence pour toute refonte visuelle. |
| **#71** | La relecture d'une patiente de 72 ans sur la hiérarchie des boutons — « quand un bouton est vert et gros, j'appuie dessus ». |
| **#75** | Les 84 pictogrammes relus un par un, et le lien vers la planche qui conserve les verdicts. |
| **#90** | Pourquoi un contrôle vert peut ne rien vérifier. |

Les messages de fusion des PR disent aussi, chacun, le défaut qu'ils réparent et ce qui a
été essayé puis retiré. `git log` est une source, pas un journal.

## Les contraintes du fichier

**Un seul fichier.** Tout vit dans `index.html` : contenu, écrans, styles, React compris.
Aucune étape de compilation. L'application doit s'ouvrir sans réseau une fois ajoutée à
l'écran d'accueil — c'est la raison d'être du fichier unique, et elle ne se négocie pas.

**Le Tailwind est figé.** La feuille de style contient les classes réellement employées,
pré-calculées, au lieu des 398 Ko de compilateur qui tournaient dans le navigateur du
patient. Conséquence : **une classe nouvelle ne fait rien tant que sa règle CSS n'est pas
écrite à la main**. Silencieusement. Le contrôle « toute classe employée est définie »
l'attrape à chaque fois, mais il faut y penser.

**La typographie est française.** Espace insécable avant `:` `;` `?` `!`, et à l'intérieur
des guillemets `«` `»`. Ne jamais appliquer ce traitement à une chaîne qui sert de motif de
recherche : l'insécable ne correspondrait plus au texte cherché.

**Les commentaires sont en français**, et disent le défaut qui a motivé le code, pas ce que
le code fait. Un commentaire qui paraphrase la ligne suivante ne sert personne ; un
commentaire qui dit « trois bascules du bassin montraient un homme debout » empêche la
prochaine personne de défaire la correction.

## Les contrôles

```
node verification/statique.mjs     quelques dixièmes de seconde
node verification/mutation.mjs     une dizaine de secondes
node verification/rendu.mjs        deux minutes et demie, demande un navigateur
```

**Les trois passent avant chaque poussée.** Le banc de mutation met chaque contrôle en
défaut pour vérifier qu'il rougit encore : deux contrôles de cette suite ont passé des mois
à ne rien vérifier.

**Un contrôle nouveau vient avec sa mutation.** Sans quoi rien ne garantit qu'il voie le
défaut qu'il prétend attraper — c'est arrivé, y compris pour un contrôle qui lisait la
liste même qu'il était censé vérifier.

Pour un changement visuel, ajouter la comparaison d'écrans :

```
node verification/captures.mjs --avant main
```

Elle dit lesquels des écrans ont bougé, et montre quoi.

## Travailler avec le praticien

Maxime Chevallier est masseur-kinésithérapeute. Il décide du contenu clinique et de ce que
montrent les dessins ; le code et les contrôles sont de notre ressort.

- **Développer sur une branche**, jamais pousser sur `main`.
- **Une PR par sujet**, fusionnée en squash.
- **Le contenu clinique rédigé par nous est soumis avant fusion.** Une correction de défaut
  qu'il a demandée explicitement se fusionne directement.
- **Montrer, ne pas décrire.** Un dessin, une mise en page, une couleur se valident sur une
  capture d'écran de la vraie carte, à la vraie taille. Six versions du *sleeper stretch*
  ont été refusées parce qu'elles étaient discutées en mots.
- **Ne pas inventer à sa place.** Un dessin produit sans qu'il ait dit ce qu'il devait
  montrer part de travers à tous les coups. Quand la consigne ne suffit pas, proposer deux
  ou trois lectures en images et lui demander, plutôt que de deviner une fois de plus.

### Ce qui ne doit pas changer

- **L'adresse de courriel du praticien** (dans `CABINET`) ne sert **qu'aux mentions
  légales**. Elle ne devient jamais un moyen de contact offert au patient — `PRATICIEN_EMAIL`
  est laissé vide exprès. Ne pas la recopier dans un message destiné à un tiers.
- **Aucun numéro de téléphone** dans l'application : il est donné de la main à la main.

## Les pictogrammes

`viewBox "0 0 48 48"`, trait `2.2`, rendus à 24 px dans une pastille de 44.

- **`POSES` est ordonné, le premier test qui passe l'emporte.** Une règle large ajoutée trop
  haut supplante en silence une règle nommée plus étroitement.
- **Tout dessin de silhouette entière déclare sa posture** dans `POSTURE_DESSIN`. Un dessin
  muet n'est comparé à rien, et peut montrer un homme debout sous une consigne qui commence
  par « allongé sur le dos ». Un contrôle le vérifie, avec la liste des dessins exemptés
  écrite en clair.
- `DESSIN_AUTRE_POSTURE` donne le repli quand la consigne décrit une autre posture que celle
  du dessin.
- **Les affectations relues par le praticien sont figées** dans un contrôle. Il fige le
  résultat jugé, pas la règle qui le produit.

## Le lexique

`GLOSSARY` est un tableau ordonné : `findGlossaryTerm` rend **le premier terme contenu dans
le texte**. Un mot placé après un autre qui le contient ne sort donc jamais —
« abdomino-adducteurs », derrière « adducteurs », a expliqué l'intérieur de la cuisse pendant
des mois. Un contrôle demande à chaque mot de se reconnaître lui-même.

Les mots de `LEXIQUE_SEUL` restent définis mais ne posent aucune pastille sur une carte
d'exercice : ils ne se lisent que sur l'écran du lexique.
