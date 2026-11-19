// Shared card definitions - used by both client and server
// Server: const CARD_DEFINITIONS = require('./js/cards-data.js');
// Client: loaded via <script> tag (sets window.CARD_DEFINITIONS)

const CARD_DEFINITIONS_DATA = [
    // --- ANIMAUX ---
    { id: 'chat', name: 'Chat', category: 'animal', smiles: 1, emoji: '🐱', count: 1 },
    { id: 'poussin', name: 'Poussin', category: 'animal', smiles: 1, emoji: '🐥', count: 1 },
    { id: 'lapin', name: 'Lapin', category: 'animal', smiles: 1, emoji: '🐰', count: 1 },
    { id: 'chien', name: 'Chien', category: 'animal', smiles: 1, emoji: '🐕', count: 1 },
    { id: 'licorne', name: 'Licorne', category: 'animal', smiles: 3, emoji: '🦄', count: 1,
        special: 'doubleIfCombo', comboCards: ['arc_en_ciel', 'etoile_filante'],
        description: 'Vaut double si Arc-en-ciel et Étoile filante posées.' },

    // --- AMOUR ---
    { id: 'adultere', name: 'Adultère', category: 'adultere', smiles: 1, emoji: '🫣', count: 3,
        requires: { mariage: true },
        description: 'Flirts illimités après mariage. Perte des enfants si divorce. Peut être jeté dans la défausse personnelle sans passer le tour.' },

    // --- DISTINCTIONS ---
    { id: 'legion_honneur', name: "Légion d'honneur", category: 'distinction', smiles: 3, emoji: '🎖️', count: 1,
        requires: { notBandit: true, notAttentat: true },
        description: 'Posable directement. Interdit si bandit ou attentat commis.' },
    { id: 'grand_prix', name: "Grand prix d'excellence", category: 'distinction', smiles: 4, emoji: '🏆', count: 2,
        requires: { metierIn: ['journaliste', 'chercheur', 'ecrivain'] },
        special: 'grandPrix',
        description: 'Salaire monte au niveau 4. Si licenciement/démission, garde 4 smiles mais perd l\'effet.' },

    // --- SPÉCIALES ---
    { id: 'etoile_filante', name: 'Étoile filante', category: 'special', smiles: 0, emoji: '🌠', count: 1, special: 'etoileFilante', description: 'Prenez une carte posable dans la défausse pour la jouer de suite.' },
    { id: 'casino', name: 'Casino', category: 'special', smiles: 0, emoji: '🎰', count: 1, special: 'casino', description: 'Misez une carte salaire face cachée. Même valeur → adversaire gagne. Différente → vous gagnez.' },
    { id: 'chance', name: 'Chance', category: 'special', smiles: 0, emoji: '🍀', count: 1, special: 'chance', description: 'Piochez 3 cartes, gardez-en 1 en main, défaussez les 2 autres puis jouez.' },
    { id: 'arc_en_ciel', name: 'Arc-en-ciel', category: 'special', smiles: 0, emoji: '🌈', count: 1, special: 'arcEnCiel', description: 'Jouez jusqu\'à 3 cartes d\'un coup puis repiochez.' },
    { id: 'anniversaire', name: 'Anniversaire', category: 'special', smiles: 0, emoji: '🎂', count: 1, special: 'anniversaire', description: 'Chaque joueur vous donne un de ses salaires posés de son choix.' },
    { id: 'vengeance', name: 'Vengeance', category: 'special', smiles: 0, emoji: '😈', count: 1, special: 'vengeance', description: 'Infligez un de vos malus reçus à un autre joueur.' },
    { id: 'troc', name: 'Troc', category: 'special', smiles: 0, emoji: '🤝', count: 1, special: 'troc', description: 'Échangez une carte au hasard avec le joueur de votre choix.' },
    { id: 'tsunami', name: 'Tsunami', category: 'special', smiles: 0, emoji: '🌊', count: 1, special: 'tsunami', description: 'Mélangez et redistribuez toutes les cartes en main.' },
    { id: 'piston', name: 'Piston', category: 'special', smiles: 0, emoji: '🔧', count: 1, special: 'piston', description: 'Posez un métier sans les études requises puis repiochez.' },
    { id: 'heritage', name: 'Héritage', category: 'special', smiles: 0, emoji: '💎', count: 1, special: 'heritage', description: 'Équivaut à un salaire de niveau 3 pour vos achats.' },

    // --- ÉTUDES ---
    { id: 'etudes', name: 'Études', category: 'etudes', smiles: 1, emoji: '🎓', count: 22, requires: { noMetier: true }, maxOnBoard: 6, description: 'Posable uniquement sans métier. Maximum 6 sur le plateau.' },
    { id: 'double_etudes', name: 'Double Études', category: 'etudes', smiles: 1, emoji: '🎓🎓', count: 3, requires: { noMetier: true }, maxOnBoard: 6, etudesValue: 2, description: 'Vaut pour 2 études. Posable uniquement sans métier. Maximum 6 études par joueur.' },

    // --- MÉTIERS ---
    { id: 'stripteaser', name: 'Stripteaser', category: 'metier', smiles: 2, emoji: '💃', count: 1, statut: 'interimaire', salaireMax: 1, etudesRequises: 0, description: 'Intérimaire. Salaire max N1. 0 étude requise.' },
    { id: 'serveur', name: 'Serveur', category: 'metier', smiles: 2, emoji: '🍽️', count: 1, statut: 'interimaire', salaireMax: 1, etudesRequises: 0, description: 'Intérimaire. Salaire max N1. 0 étude requise.' },
    { id: 'medium', name: 'Médium', category: 'metier', smiles: 2, emoji: '🔮', count: 1, statut: 'interimaire', salaireMax: 1, etudesRequises: 0, advantage: 'medium', description: 'Intérimaire. Salaire max N1. 0 étude. Voyez les 13 prochaines cartes de la pioche.' },
    { id: 'barman', name: 'Barman', category: 'metier', smiles: 2, emoji: '🍸', count: 1, statut: 'interimaire', salaireMax: 1, etudesRequises: 0, advantage: 'unlimitedFlirts', description: 'Intérimaire. Salaire max N1. 0 étude. Flirts illimités avant le mariage.' },
    { id: 'ecrivain', name: 'Écrivain', category: 'metier', smiles: 2, emoji: '✍️', count: 1, statut: 'interimaire', salaireMax: 1, etudesRequises: 0, advantage: 'grandPrix', description: 'Intérimaire. Salaire max N1. 0 étude. Possibilité d\'avoir le Grand Prix d\'Excellence.' },
    { id: 'pizzaiolo', name: 'Pizzaïolo', category: 'metier', smiles: 2, emoji: '🍕', count: 1, statut: 'interimaire', salaireMax: 2, etudesRequises: 0, description: 'Intérimaire. Salaire max N2. 0 étude.' },
    { id: 'militaire', name: 'Militaire', category: 'metier', smiles: 2, emoji: '🎖️', count: 1, statut: 'fonctionnaire', salaireMax: 1, etudesRequises: 0, advantage: 'noAttentat', description: 'Fonctionnaire. Salaire max N1. 0 étude. Aucun attentat en votre présence.' },
    { id: 'gourou', name: 'Gourou', category: 'metier', smiles: 2, emoji: '🧿', count: 1, statut: 'interimaire', salaireMax: 3, etudesRequises: 0, description: 'Intérimaire. Salaire max N3. 0 étude.' },
    { id: 'bandit', name: 'Bandit', category: 'metier', smiles: 2, emoji: '🦹', count: 1, statut: 'interimaire', salaireMax: 4, etudesRequises: 0, advantage: 'bandit', description: 'Intérimaire. Salaire max N4. 0 étude. Ni impôt ni licenciement. Prison possible.' },
    { id: 'architecte', name: 'Architecte', category: 'metier', smiles: 2, emoji: '📐', count: 1, salaireMax: 3, etudesRequises: 4, advantage: 'freeMaison', description: 'Salaire max N3. 4 études. Posez une maison gratuitement en jouant ce métier.' },
    { id: 'chirurgien', name: 'Chirurgien', category: 'metier', smiles: 2, emoji: '🔪', count: 1, salaireMax: 4, etudesRequises: 6, advantage: 'noMaladie', keepStudies: true, description: 'Salaire max N4. 6 études. Aucune maladie. Conserve ses études.' },
    { id: 'pharmacien', name: 'Pharmacien', category: 'metier', smiles: 2, emoji: '💊', count: 1, salaireMax: 3, etudesRequises: 5, advantage: 'noMaladie', description: 'Salaire max N3. 5 études. Aucune maladie.' },
    { id: 'prof_maths', name: 'Prof de maths', category: 'metier', smiles: 2, emoji: '📏', count: 1, statut: 'fonctionnaire', salaireMax: 2, etudesRequises: 2, description: 'Fonctionnaire. Salaire max N2. 2 études.' },
    { id: 'plombier', name: 'Plombier', category: 'metier', smiles: 2, emoji: '🔧', count: 1, statut: 'interimaire', salaireMax: 1, etudesRequises: 1, description: 'Intérimaire. Salaire max N1. 1 étude.' },
    { id: 'astronaute', name: 'Astronaute', category: 'metier', smiles: 2, emoji: '🚀', count: 1, salaireMax: 4, etudesRequises: 6, advantage: 'pickDiscard', description: 'Salaire max N4. 6 études. Choisissez une carte posable de la défausse.' },
    { id: 'prof_anglais', name: "Prof d'anglais", category: 'metier', smiles: 2, emoji: '🇬🇧', count: 1, statut: 'fonctionnaire', salaireMax: 2, etudesRequises: 2, description: "Fonctionnaire. Salaire max N2. 2 études." },
    { id: 'designer', name: 'Designer', category: 'metier', smiles: 2, emoji: '🎨', count: 1, statut: 'interimaire', salaireMax: 3, etudesRequises: 4, description: 'Intérimaire. Salaire max N3. 4 études.' },
    { id: 'pilote', name: 'Pilote de ligne', category: 'metier', smiles: 2, emoji: '✈️', count: 1, salaireMax: 4, etudesRequises: 5, advantage: 'freeVoyage', description: 'Salaire max N4. 5 études. Voyages posables gratuitement.' },
    { id: 'garagiste', name: 'Garagiste', category: 'metier', smiles: 2, emoji: '🔩', count: 1, statut: 'interimaire', salaireMax: 2, etudesRequises: 1, advantage: 'noAccident', description: 'Intérimaire. Salaire max N2. 1 étude. Aucun accident.' },
    { id: 'jardinier', name: 'Jardinier', category: 'metier', smiles: 2, emoji: '🌱', count: 1, statut: 'interimaire', salaireMax: 1, etudesRequises: 1, description: 'Intérimaire. Salaire max N1. 1 étude.' },
    { id: 'medecin', name: 'Médecin', category: 'metier', smiles: 2, emoji: '🩺', count: 1, salaireMax: 4, etudesRequises: 6, advantage: 'noMaladie', keepStudies: true, description: 'Salaire max N4. 6 études. Aucune maladie. Conserve ses études.' },
    { id: 'chef_achats', name: 'Chef des achats', category: 'metier', smiles: 2, emoji: '🛒', count: 1, salaireMax: 3, etudesRequises: 3, advantage: 'buyDiscard', description: 'Salaire max N3. 3 études. Achat possible d\'une acquisition défaussée.' },
    { id: 'prof_histoire', name: "Prof d'histoire-géo", category: 'metier', smiles: 2, emoji: '🌍', count: 1, statut: 'fonctionnaire', salaireMax: 2, etudesRequises: 2, description: 'Fonctionnaire. Salaire max N2. 2 études.' },
    { id: 'prof_francais', name: 'Prof de français', category: 'metier', smiles: 2, emoji: '📖', count: 1, statut: 'fonctionnaire', salaireMax: 2, etudesRequises: 2, description: 'Fonctionnaire. Salaire max N2. 2 études.' },
    { id: 'grand_prof', name: 'Grand prof', category: 'metier', smiles: 2, emoji: '🎓', count: 1, statut: 'fonctionnaire', salaireMax: 3, etudesRequises: 0, isPromotion: true, requires: { metierIn: ['prof_maths', 'prof_anglais', 'prof_histoire', 'prof_francais'] }, description: 'Fonctionnaire. Salaire max N3. Promotion réservée aux profs.' },
    { id: 'policier', name: 'Policier', category: 'metier', smiles: 2, emoji: '👮', count: 1, statut: 'fonctionnaire', salaireMax: 1, etudesRequises: 1, description: 'Fonctionnaire. Salaire max N1. 1 étude. Ni gourou ni bandit : défaussés si posés.' },
    { id: 'chercheur', name: 'Chercheur', category: 'metier', smiles: 2, emoji: '🔬', count: 1, salaireMax: 2, etudesRequises: 6, advantage: 'sixCards', description: 'Salaire max N2. 6 études. Jouez avec 6 cartes en main.' },
    { id: 'avocat', name: 'Avocat', category: 'metier', smiles: 2, emoji: '⚖️', count: 1, salaireMax: 3, etudesRequises: 4, advantage: 'cantDivorce', description: 'Salaire max N3. 4 études. Aucun divorce.' },
    { id: 'chef_ventes', name: 'Chef des ventes', category: 'metier', smiles: 2, emoji: '💼', count: 1, salaireMax: 3, etudesRequises: 3, advantage: 'pickSalaire', description: 'Salaire max N3. 3 études. Récupérez un salaire posable de la défausse.' },
    { id: 'journaliste', name: 'Journaliste', category: 'metier', smiles: 2, emoji: '📰', count: 1, salaireMax: 2, etudesRequises: 3, advantage: 'seeHands', description: 'Salaire max N2. 3 études. Regardez le jeu en main de chacun.' },

    // --- SALAIRES ---
    { id: 'salaire_1', name: 'Salaire N1', category: 'salaire', smiles: 1, emoji: '💰', count: 10, salaireLevel: 1, requires: { metierSalaireMin: 1 }, description: 'Nécessite un métier autorisant les salaires de niveau 1.' },
    { id: 'salaire_2', name: 'Salaire N2', category: 'salaire', smiles: 1, emoji: '💰💰', count: 10, salaireLevel: 2, salaireValue: 2, requires: { metierSalaireMin: 2 }, description: 'Vaut pour 2 salaires. Nécessite un métier autorisant les salaires de niveau 2.' },
    { id: 'salaire_3', name: 'Salaire N3', category: 'salaire', smiles: 1, emoji: '💰💰💰', count: 10, salaireLevel: 3, salaireValue: 3, requires: { metierSalaireMin: 3 }, description: 'Vaut pour 3 salaires. Nécessite un métier autorisant les salaires de niveau 3.' },
    { id: 'salaire_4', name: 'Salaire N4', category: 'salaire', smiles: 1, emoji: '💰💰💰💰', count: 10, salaireLevel: 4, salaireValue: 4, requires: { metierSalaireMin: 4 }, description: 'Vaut pour 4 salaires. Nécessite un métier autorisant les salaires de niveau 4.' },

    // --- MARIAGE ---
    { id: 'mariage', name: 'Mariage', category: 'mariage', smiles: 3, emoji: '💒', count: 7, requires: { hasFlirt: true }, description: 'Posable après un flirt. Permet d\'avoir des enfants.' },

    // --- VOYAGES ---
    { id: 'sydney', name: 'Sydney', category: 'voyage', smiles: 1, emoji: '🦘', count: 1, price: 3, description: 'Coûte 3 salaires.' },
    { id: 'londres', name: 'Londres', category: 'voyage', smiles: 1, emoji: '🇬🇧', count: 1, price: 3, description: 'Coûte 3 salaires.' },
    { id: 'le_caire', name: 'Le Caire', category: 'voyage', smiles: 1, emoji: '🏛️', count: 1, price: 3, description: 'Coûte 3 salaires.' },
    { id: 'rio', name: 'Rio de Janeiro', category: 'voyage', smiles: 1, emoji: '🇧🇷', count: 1, price: 3, description: 'Coûte 3 salaires.' },
    { id: 'new_york', name: 'New York', category: 'voyage', smiles: 1, emoji: '🗽', count: 1, price: 3, description: 'Coûte 3 salaires.' },

    // --- MAISONS ---
    { id: 'petite_maison', name: 'Petite Maison', category: 'maison', smiles: 1, emoji: '🏡', count: 2, price: 6, description: 'Coûte 6 salaires (moitié prix si marié).' },
    { id: 'maison', name: 'Maison', category: 'maison', smiles: 2, emoji: '🏠', count: 2, price: 8, description: 'Coûte 8 salaires (moitié prix si marié).' },
    { id: 'grande_maison', name: 'Grande Maison', category: 'maison', smiles: 3, emoji: '🏰', count: 1, price: 10, description: 'Coûte 10 salaires (moitié prix si marié).' },

    // --- FLIRTS ---
    { id: 'flirt_hotel', name: "Flirt à l'hôtel", category: 'flirt', smiles: 1, emoji: '🏨', count: 2, lieu: 'hotel', allowsChild: true, description: 'Avant mariage, max 5 flirts. Possibilité d\'avoir un enfant.' },
    { id: 'flirt_camping', name: 'Flirt au camping', category: 'flirt', smiles: 1, emoji: '🏕️', count: 2, lieu: 'camping', allowsChild: true, description: 'Avant mariage, max 5 flirts. Possibilité d\'avoir un enfant.' },
    { id: 'flirt_zoo', name: 'Flirt au zoo', category: 'flirt', smiles: 1, emoji: '🦁', count: 2, lieu: 'zoo', description: 'Avant mariage, max 5 flirts.' },
    { id: 'flirt_bar', name: 'Flirt au bar', category: 'flirt', smiles: 1, emoji: '🍸', count: 2, lieu: 'bar', description: 'Avant mariage, max 5 flirts.' },
    { id: 'flirt_parc', name: 'Flirt au parc', category: 'flirt', smiles: 1, emoji: '🌳', count: 2, lieu: 'parc', description: 'Avant mariage, max 5 flirts.' },
    { id: 'flirt_theatre', name: 'Flirt au théâtre', category: 'flirt', smiles: 1, emoji: '🎭', count: 2, lieu: 'theatre', description: 'Avant mariage, max 5 flirts.' },
    { id: 'flirt_internet', name: 'Flirt sur internet', category: 'flirt', smiles: 1, emoji: '💻', count: 2, lieu: 'internet', description: 'Avant mariage, max 5 flirts.' },
    { id: 'flirt_boite', name: 'Flirt en boîte de nuit', category: 'flirt', smiles: 1, emoji: '🪩', count: 2, lieu: 'boite', description: 'Avant mariage, max 5 flirts.' },
    { id: 'flirt_cinema', name: 'Flirt au cinéma', category: 'flirt', smiles: 1, emoji: '🎬', count: 2, lieu: 'cinema', description: 'Avant mariage, max 5 flirts.' },
    { id: 'flirt_restaurant', name: 'Flirt au restaurant', category: 'flirt', smiles: 1, emoji: '🍽️', count: 2, lieu: 'restaurant', description: 'Avant mariage, max 5 flirts.' },

    // --- ENFANTS ---
    { id: 'enfant_laura', name: 'Laura', category: 'enfant', smiles: 2, emoji: '👧', count: 1, gender: 'fille', description: 'Après mariage.' },
    { id: 'enfant_zelda', name: 'Zelda', category: 'enfant', smiles: 2, emoji: '👧', count: 1, gender: 'fille', description: 'Après mariage.' },
    { id: 'enfant_hermione', name: 'Hermione', category: 'enfant', smiles: 2, emoji: '👧', count: 1, gender: 'fille', description: 'Après mariage.' },
    { id: 'enfant_leia', name: 'Leïa', category: 'enfant', smiles: 2, emoji: '👧', count: 1, gender: 'fille', description: 'Après mariage.' },
    { id: 'enfant_diana', name: 'Diana', category: 'enfant', smiles: 2, emoji: '👧', count: 1, gender: 'fille', description: 'Après mariage.' },
    { id: 'enfant_rocky', name: 'Rocky', category: 'enfant', smiles: 2, emoji: '👦', count: 1, gender: 'garçon', description: 'Après mariage.' },
    { id: 'enfant_luigi', name: 'Luigi', category: 'enfant', smiles: 2, emoji: '👦', count: 1, gender: 'garçon', description: 'Après mariage.' },
    { id: 'enfant_mario', name: 'Mario', category: 'enfant', smiles: 2, emoji: '👦', count: 1, gender: 'garçon', description: 'Après mariage.' },
    { id: 'enfant_harry', name: 'Harry', category: 'enfant', smiles: 2, emoji: '👦', count: 1, gender: 'garçon', description: 'Après mariage.' },
    { id: 'enfant_luke', name: 'Luke', category: 'enfant', smiles: 2, emoji: '👦', count: 1, gender: 'garçon', description: 'Après mariage.' },

    // --- MALUS ---
    { id: 'attentat', name: 'Attentat', category: 'malus', smiles: 0, emoji: '💣', count: 1, special: 'attentat', target: 'all', description: 'Tous les joueurs perdent tous leurs enfants posés.' },
    { id: 'prison', name: 'Prison', category: 'malus', smiles: 0, emoji: '🔒', count: 1, special: 'prison', target: 'opponent', requires: { targetHas: 'bandit' }, skipTurns: 3, description: 'Jouable uniquement sur un joueur ayant Bandit. Il passe 3 tours puis jette Bandit et Prison.' },
    { id: 'maladie', name: 'Maladie', category: 'malus', smiles: 0, emoji: '🤒', count: 5, special: 'maladie', target: 'opponent', skipTurns: 1, description: 'Le joueur ciblé passe 1 tour.' },
    { id: 'accident', name: 'Accident', category: 'malus', smiles: 0, emoji: '🚑', count: 5, special: 'accident', target: 'opponent', skipTurns: 1, description: 'Le joueur ciblé passe 1 tour.' },
    { id: 'burnout', name: 'Burn-out', category: 'malus', smiles: 0, emoji: '😵', count: 5, special: 'burnout', target: 'opponent', requires: { targetHas: 'metier' }, skipTurns: 1, description: 'Jouable uniquement sur un joueur ayant un métier. Il passe 1 tour.' },
    { id: 'licenciement', name: 'Licenciement', category: 'malus', smiles: 0, emoji: '📦', count: 5, special: 'licenciement', target: 'opponent', requires: { targetHas: 'metier' }, description: 'Il défausse son métier dans la défausse commune.' },
    { id: 'impot', name: 'Impôt sur le revenu', category: 'malus', smiles: 0, emoji: '🧾', count: 5, special: 'impot', target: 'opponent', requires: { targetHas: 'metier' }, description: 'Il jette son dernier salaire posé dans sa défausse personnelle.' },
    { id: 'redoublement', name: 'Redoublement', category: 'malus', smiles: 0, emoji: '📉', count: 5, special: 'redoublement', target: 'opponent', requires: { targetHas: 'etudes', targetNoMetier: true }, description: 'Il jette sa dernière carte études dans sa défausse personnelle.' },
    { id: 'divorce', name: 'Divorce', category: 'malus', smiles: 0, emoji: '💔', count: 5, special: 'divorce', target: 'opponent', requires: { targetHas: 'mariage' }, description: 'Il défausse son mariage dans la défausse commune.' },
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CARD_DEFINITIONS_DATA;
}
