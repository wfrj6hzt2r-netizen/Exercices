// Les écrans adressables de l'application, et le nom sous lequel on en parle.
//
// Deux outils s'en servent : la suite de rendu, qui les ouvre tous pour y chercher des
// défauts, et l'outil de captures, qui les photographie pour comparer deux versions. La
// liste vivait dans la suite de rendu ; l'outil de captures en aurait fait une copie, et
// une copie se met à dériver dès qu'un écran est ajouté d'un côté seulement.

export const ROUTES = [
    ["accueil", "#/"], ["choisir une zone", "#/zone"], ["profil", "#/profil"], ["blessures", "#/z/genou"], ["check-in", "#/z/genou/entorse"],
    ["exercices", "#/z/genou/entorse/e1"], ["fiche d'exercice", "#/z/genou/entorse/e2/x/presse-a-une-jambe-legere"], ["exercices tardifs", "#/z/genou/entorse/e4"],
    ["fin de parcours", "#/z/genou/entorse/fin"], ["lombaires", "#/z/lombaire/hernie-discale"],
    ["hernie positions", "#/z/lombaire/hernie-discale/e1"],
    ["cheville", "#/z/cheville/achille-insertion/e4"], ["cervicales", "#/z/cervical/cervicalgie"],
    ["hanche", "#/z/hanche/arthrose-hanche"], ["coureur", "#/coureur"],
    ["arthrose entretien", "#/z/genou/arthrose-genou/e3"],
    ["scoliose correction", "#/croissance/scoliose/e1"],
    ["scoliose entretien", "#/croissance/scoliose/e4"],
    ["coureur exercices", "#/coureur/essuie-glace/e1"], ["croissance", "#/croissance"],
    ["croissance exercices", "#/croissance/osgood/e1"], ["prévention", "#/prevention"],
    ["prévention exercices", "#/prevention/warmup/course"], ["récapitulatif", "#/recap"],
    ["à propos", "#/apropos"], ["lexique", "#/lexique"],
    ["fabrique de liens", "#/lien"], ["pied", "#/z/pied/coussinet/e1"],
    ["cervicalgie C5", "#/z/cervical/ncb-c5/e1"], ["coude lanceur", "#/croissance/coude-lanceur/e1"],
];
