const GamePhase = {
    DRAW: 'draw',
    PLAY: 'play',
    CHOOSE_TARGET: 'choose_target',
    CHOOSE_SALARY_INVEST: 'choose_salary_invest',
    CASINO_BET: 'casino_bet',
    CHANCE_PICK: 'chance_pick',
    ARC_EN_CIEL: 'arc_en_ciel',
    ANNIVERSARY_COLLECT: 'anniversary_collect',
    TROC_PICK: 'troc_pick',
    ETOILE_PICK: 'etoile_pick',
    VENGEANCE_PICK: 'vengeance_pick',
    PISTON_PICK: 'piston_pick',
    GAME_OVER: 'game_over'
};

class Player {
    constructor(name, index) {
        this.name = name;
        this.index = index;
        this.hand = [];

        this.board = {
            etudes: [],
            metier: null,
            salaires: [],
            flirts: [],
            mariage: null,
            adultere: null,
            flirtsAdultere: [],
            enfants: [],
            animaux: [],
            voyages: [],
            maisons: [],
            distinctions: [],
            speciales: [],
        };

        this.malusRecus = [];
        this.personalDiscard = [];
        this.skipTurns = 0;
        this.usedPiston = false;
        this.hadBandit = false;
        this.hadAttentat = false;
    }

    getStudyLevel() {
        let level = 0;
        for (const card of this.board.etudes) {
            level += card.studyLevels || 1;
        }
        return level;
    }

    getMaxStudyCards() {
        return 6;
    }

    getMaxHandSize() {
        if (this.board.metier && this.board.metier.advantage === 'sixCards') return 6;
        return 5;
    }

    canStudy() {
        if (this.board.metier) {
            const m = this.board.metier;
            if (m.advantage === 'canStudyWhileWorking' || m.keepStudies) return true;
            return false;
        }
        return this.board.etudes.length < this.getMaxStudyCards();
    }

    hasMetier() {
        return this.board.metier !== null;
    }

    getMetierId() {
        return this.board.metier ? this.board.metier.id : null;
    }

    getMetierSalaryLevel() {
        if (!this.board.metier) return 0;
        let level = this.board.metier.salaireMax || this.board.metier.salaryLevel || 0;
        const gp = this.board.distinctions.find(d => d.id === 'grand_prix' && d.active);
        if (gp) level = 4;
        return level;
    }

    getAvailableSalaries() {
        return this.board.salaires.filter(s => !s.invested);
    }

    getAvailableSalaryTotal() {
        return this.getAvailableSalaries().reduce((sum, s) => sum + (s.level || 0), 0);
    }

    getSalaryCount() {
        return this.getAvailableSalaries().length;
    }

    isMarried() {
        return this.board.mariage !== null;
    }

    isInAdultery() {
        return this.board.adultere !== null;
    }

    canFlirt() {
        if (this.isMarried() && !this.isInAdultery()) return false;
        if (this.isInAdultery()) return true;
        if (this.board.metier && this.board.metier.advantage === 'unlimitedFlirts') return true;
        return this.board.flirts.length < 5;
    }

    hasFlirts() {
        return this.board.flirts.length > 0;
    }

    isFonctionnaire() {
        return this.board.metier && this.board.metier.statut === 'fonctionnaire';
    }

    isInterimaire() {
        return this.board.metier && this.board.metier.statut === 'interimaire';
    }

    getScore() {
        let total = 0;

        for (const cards of [
            this.board.etudes, this.board.salaires, this.board.flirts,
            this.board.flirtsAdultere, this.board.enfants,
            this.board.animaux, this.board.voyages, this.board.maisons,
            this.board.distinctions, this.board.speciales
        ]) {
            for (const card of cards) {
                let smiles = card.smiles || 0;
                if (card.special === 'doubleIfCombo' && card.comboCards) {
                    const specialIds = this.board.speciales.map(s => s.id);
                    if (card.comboCards.every(cid => specialIds.includes(cid))) {
                        smiles *= 2;
                    }
                }
                total += smiles;
            }
        }

        if (this.board.metier) total += this.board.metier.smiles || 0;
        if (this.board.mariage) total += this.board.mariage.smiles || 0;
        if (this.board.adultere) total += this.board.adultere.smiles || 0;

        return total;
    }
}

class Game {
    constructor() {
        this.players = [];
        this.deck = [];
        this.discard = [];
        this.outOfGame = [];
        this.currentPlayerIndex = 0;
        this.phase = GamePhase.DRAW;
        this.pendingAction = null;
        this.casinoState = null;
        this.arcEnCielRemaining = 0;
        this.onUpdate = null;
    }

    init(playerNames, options = {}) {
        this.options = {
            variant: options.variant || 'classique',
            deckSize: options.deckSize || 'complet',
            handSize: options.handSize || 5,
            turnOrder: options.turnOrder || 'random',
        };

        this.players = playerNames.map((name, i) => new Player(name, i));
        this.deck = createDeck();
        this.discard = [];
        this.outOfGame = [];
        this.casinoState = null;

        if (this.options.deckSize === 'moitie') {
            this.deck = this.deck.slice(0, Math.ceil(this.deck.length / 2));
        }

        for (const player of this.players) {
            for (let i = 0; i < this.options.handSize; i++) {
                if (this.deck.length > 0) {
                    player.hand.push(this.deck.pop());
                }
            }
        }

        if (this.options.turnOrder === 'order') {
            this.currentPlayerIndex = 0;
        } else {
            this.currentPlayerIndex = this.findStartingPlayer();
        }
        this.phase = GamePhase.DRAW;
    }

    findStartingPlayer() {
        let maxSmiles = -1;
        let startIndex = 0;
        this.players.forEach((player, i) => {
            const handSmiles = player.hand.reduce((sum, c) => sum + (c.smiles || 0), 0);
            if (handSmiles > maxSmiles) {
                maxSmiles = handSmiles;
                startIndex = i;
            }
        });
        return startIndex;
    }

    currentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    // ===== PHASE DE PIOCHE =====

    drawCard() {
        if (this.phase !== GamePhase.DRAW) return false;
        const player = this.currentPlayer();

        if (player.skipTurns > 0) {
            player.skipTurns--;
            this.nextTurn();
            return 'skipped';
        }

        if (this.deck.length === 0) {
            if (player.hand.length > 0) {
                this.phase = GamePhase.PLAY;
                return 'no_draw';
            }
            this.phase = GamePhase.GAME_OVER;
            return 'game_over';
        }

        const card = this.deck.pop();
        player.hand.push(card);
        this.phase = GamePhase.PLAY;

        if (this.deck.length === 0) {
            // on finit le tour en cours puis c'est fini
        }

        return card;
    }

    takeFromDiscard() {
        if (this.phase !== GamePhase.DRAW) return false;
        if (this.discard.length === 0) return false;

        const player = this.currentPlayer();

        if (player.skipTurns > 0) {
            player.skipTurns--;
            this.nextTurn();
            return 'skipped';
        }

        const card = this.discard.pop();

        if (!this.canPlayCard(card, player)) {
            this.discard.push(card);
            return false;
        }

        this.playCardDirect(card, player);
        return card;
    }

    // ===== DÉMISSION =====

    canResign(player) {
        if (!player) player = this.currentPlayer();
        return player.hasMetier() && this.phase === GamePhase.DRAW;
    }

    resign() {
        if (!this.canResign()) return false;
        const player = this.currentPlayer();
        const metier = player.board.metier;

        if (player.isInterimaire()) {
            this.discard.push(metier);
            player.board.metier = null;
            this.deactivateGrandPrix(player);

            if (metier.id === 'chercheur') {
                // chercheur perd une carte en main en plus — à gérer dans l'UI
            }

            this.phase = GamePhase.DRAW;
            return 'resign_interimaire';
        }

        this.discard.push(metier);
        player.board.metier = null;
        this.deactivateGrandPrix(player);

        if (metier.id === 'chercheur') {
            // joueur doit jeter une carte de sa main
        }

        player.skipTurns = 1;
        this.nextTurn();
        return true;
    }

    // ===== DIVORCE =====

    canDivorce(player) {
        if (!player) player = this.currentPlayer();
        if (!player.isMarried()) return false;
        if (player.hasMetier() && player.board.metier.advantage === 'cantDivorce') return false;
        return this.phase === GamePhase.DRAW;
    }

    divorce() {
        if (!this.canDivorce()) return false;
        const player = this.currentPlayer();

        if (player.isInAdultery()) {
            this.discard.push(player.board.adultere);
            this.discard.push(player.board.mariage);
            for (const enfant of player.board.enfants) {
                this.discard.push(enfant);
            }
            player.board.enfants = [];
            player.board.adultere = null;
            player.board.mariage = null;
            for (const f of player.board.flirtsAdultere) {
                f.flipped = true;
            }
        } else {
            this.discard.push(player.board.mariage);
            player.board.mariage = null;
        }

        player.skipTurns = 1;
        this.nextTurn();
        return true;
    }

    // ===== DÉFAUSSER ADULTÈRE =====

    canDiscardAdultery(player) {
        if (!player) player = this.currentPlayer();
        return player.isInAdultery();
    }

    discardAdultery() {
        const player = this.currentPlayer();
        if (!player.isInAdultery()) return false;

        this.discard.push(player.board.adultere);
        player.board.adultere = null;
        return true;
    }

    // ===== JOUER UNE CARTE =====

    canPlayCard(card, player) {
        if (!player) player = this.currentPlayer();

        switch (card.category) {
            case 'etudes':
                if (!player.canStudy()) return false;
                const unlimitedStudies = player.board.metier && player.board.metier.keepStudies;
                if (!unlimitedStudies && player.board.etudes.length >= player.getMaxStudyCards()) return false;
                if (card.requires && card.requires.studyLevel) {
                    if (player.getStudyLevel() < card.requires.studyLevel) return false;
                }
                return true;

            case 'metier':
                if (card.isPromotion) {
                    if (!player.hasMetier()) return false;
                    if (card.requires && card.requires.metier && player.getMetierId() !== card.requires.metier) return false;
                    if (card.requires && card.requires.metierIn && !card.requires.metierIn.includes(player.getMetierId())) return false;
                } else {
                    if (player.hasMetier()) return false;
                }
                if (card.etudesRequises && card.etudesRequises > 0) {
                    if (player.getStudyLevel() < card.etudesRequises && !player.usedPiston) return false;
                }
                if (card.requires && card.requires.studyLevel) {
                    if (player.getStudyLevel() < card.requires.studyLevel && !player.usedPiston) return false;
                }
                return true;

            case 'salaire':
                if (!player.hasMetier()) return false;
                if ((card.salaireLevel || card.level) > player.getMetierSalaryLevel()) return false;
                return true;

            case 'flirt':
                return player.canFlirt();

            case 'mariage':
                if (player.isMarried()) return false;
                return player.hasFlirts();

            case 'adultere':
                return player.isMarried() && !player.isInAdultery();

            case 'enfant':
                if (player.isMarried()) return true;
                const lastFlirt = player.board.flirts[player.board.flirts.length - 1];
                if (lastFlirt && lastFlirt.allowsChild && !lastFlirt.childUsed) return true;
                return false;

            case 'animal':
                return true;

            case 'voyage':
                if (!card.price) return true;
                if (player.board.metier && player.board.metier.advantage === 'freeVoyage') return true;
                return this.canAfford(player, card.price);

            case 'maison':
                if (!card.price) return true;
                if (player.board.metier && player.board.metier.advantage === 'freeMaison') return true;
                let price = card.price;
                if (player.isMarried()) price = Math.ceil(price / 2);
                return this.canAfford(player, price);

            case 'distinction':
                if (card.id === 'legion_honneur') {
                    if (player.hadBandit || player.hadAttentat) return false;
                    if (player.getMetierId() === 'bandit') return false;
                    return true;
                }
                if (card.id === 'grand_prix') {
                    const validMetiers = card.requires?.metierIn || [];
                    if (!player.hasMetier()) return false;
                    if (!validMetiers.includes(player.getMetierId())) return false;
                    if (player.board.distinctions.some(d => d.id === 'grand_prix' && d.active)) return false;
                    return true;
                }
                return true;

            case 'special':
                if (card.special === 'piston') {
                    if (player.hasMetier()) return false;
                    return this.getValidPistonMetiers(player).length > 0;
                }
                return true;

            case 'malus':
                return this.getValidMalusTargets(card).length > 0;

            default:
                return true;
        }
    }

    canAfford(player, price) {
        const available = player.getAvailableSalaries();
        let total = 0;
        for (const s of available) {
            total += s.level || 1;
        }
        return total >= price;
    }

    playCard(card) {
        if (this.phase !== GamePhase.PLAY) return false;
        const player = this.currentPlayer();

        if (!this.canPlayCard(card, player)) return false;

        const handIndex = player.hand.findIndex(c => c.uid === card.uid);
        if (handIndex === -1) return false;

        player.hand.splice(handIndex, 1);

        if (this.needsSalaryChoice(card, player)) {
            const price = this.getCardPrice(card, player);
            this.pendingAction = { type: 'salary_payment', card, price };
            this.phase = GamePhase.CHOOSE_SALARY_INVEST;
            return 'choose_salary';
        }

        if (card.category === 'malus') {
            const targets = this.getValidMalusTargets(card);
            if (targets.length === 1) {
                this.applyMalus(card, targets[0]);
                this.nextTurn();
                return true;
            }
            this.pendingAction = { type: 'malus', card };
            this.phase = GamePhase.CHOOSE_TARGET;
            return 'choose_target';
        }

        if (card.category === 'special') {
            return this.playSpecialCard(card, player);
        }

        this.placeCard(card, player);
        this.nextTurn();
        return true;
    }

    playCardDirect(card, player) {
        if (card.category === 'malus') {
            const targets = this.getValidMalusTargets(card);
            if (targets.length === 1) {
                this.applyMalus(card, targets[0]);
                this.nextTurn();
                return true;
            }
            this.pendingAction = { type: 'malus', card };
            this.phase = GamePhase.CHOOSE_TARGET;
            return 'choose_target';
        }

        if (card.category === 'special') {
            return this.playSpecialCard(card, player);
        }

        this.placeCard(card, player);

        if (card.category === 'metier' && card.advantage === 'freeMaison') {
            const maisonsInHand = player.hand.filter(c => c.category === 'maison');
            if (maisonsInHand.length > 0) {
                this.pendingAction = { type: 'freeMaison', player };
                return 'choose_free_maison';
            }
        }

        if (card.category === 'metier' && card.advantage === 'pickDiscard') {
            const playable = this.discard.filter(c => this.canPlayCard(c, player));
            if (playable.length > 0) {
                this.pendingAction = { type: 'pickDiscard', player };
                return 'pick_discard';
            }
        }

        this.nextTurn();
        return true;
    }

    placeCard(card, player) {
        switch (card.category) {
            case 'etudes':
                player.board.etudes.push(card);
                break;

            case 'metier':
                if (card.isPromotion && player.board.metier) {
                    this.discard.push(player.board.metier);
                }
                player.board.metier = card;
                player.usedPiston = false;
                this.checkPoliceEffect(player);
                while (this.deck.length > 0 && player.hand.length < player.getMaxHandSize()) {
                    player.hand.push(this.deck.pop());
                }
                break;

            case 'salaire':
                player.board.salaires.push({ ...card, invested: false });
                break;

            case 'flirt':
                if (player.isInAdultery()) {
                    player.board.flirtsAdultere.push(card);
                } else {
                    const unlimited = player.board.metier && player.board.metier.advantage === 'unlimitedFlirts';
                    if (player.board.flirts.length < 5 || card.stolen || unlimited) {
                        player.board.flirts.push(card);
                    }
                }
                this.checkFlirtSteal(card, player);
                break;

            case 'mariage':
                player.board.mariage = card;
                break;

            case 'adultere':
                player.board.adultere = card;
                break;

            case 'enfant':
                player.board.enfants.push(card);
                if (!player.isMarried()) {
                    const lastFlirt = player.board.flirts[player.board.flirts.length - 1];
                    if (lastFlirt) lastFlirt.childUsed = true;
                }
                break;

            case 'animal':
                player.board.animaux.push(card);
                break;

            case 'voyage':
                player.board.voyages.push(card);
                break;

            case 'maison':
                player.board.maisons.push(card);
                break;

            case 'distinction':
                if (card.id === 'grand_prix') {
                    card.active = true;
                    card.linkedMetier = player.getMetierId();
                }
                player.board.distinctions.push(card);
                break;
        }
    }

    needsSalaryChoice(card, player) {
        if (card.category === 'voyage' && card.price) {
            const pilote = player.board.metier && player.board.metier.advantage === 'freeVoyage';
            return !pilote;
        }
        if (card.category === 'maison' && card.price) {
            const archi = player.board.metier && player.board.metier.advantage === 'freeMaison';
            return !archi;
        }
        return false;
    }

    getCardPrice(card, player) {
        if (card.category === 'maison' && card.price && player.isMarried()) {
            return Math.ceil(card.price / 2);
        }
        return card.price || 0;
    }

    resolveSalaryPayment(selectedUids) {
        if (this.phase !== GamePhase.CHOOSE_SALARY_INVEST) return false;
        if (!this.pendingAction || this.pendingAction.type !== 'salary_payment') return false;

        const player = this.currentPlayer();
        const { card, price } = this.pendingAction;

        let total = 0;
        const toRemove = [];
        for (const uid of selectedUids) {
            const sal = player.board.salaires.find(s => s.uid === uid);
            if (!sal) return false;
            total += sal.salaireLevel || sal.level || 1;
            toRemove.push(sal);
        }

        if (total < price) return false;

        for (const sal of toRemove) {
            const idx = player.board.salaires.findIndex(s => s.uid === sal.uid);
            if (idx !== -1) {
                player.personalDiscard.push(player.board.salaires.splice(idx, 1)[0]);
            }
        }

        if (card.category === 'voyage') {
            player.board.voyages.push(card);
        } else if (card.category === 'maison') {
            player.board.maisons.push(card);
        }

        this.pendingAction = null;
        this.nextTurn();
        return true;
    }

    resolveFreeMaison(maisonUid) {
        if (!this.pendingAction || this.pendingAction.type !== 'freeMaison') return false;
        const player = this.pendingAction.player;

        if (maisonUid) {
            const idx = player.hand.findIndex(c => c.uid === maisonUid);
            if (idx === -1) return false;
            const maison = player.hand.splice(idx, 1)[0];
            player.board.maisons.push(maison);
        }

        this.pendingAction = null;
        this.nextTurn();
        return true;
    }

    resolvePickDiscard(cardUid) {
        if (!this.pendingAction || this.pendingAction.type !== 'pickDiscard') return false;
        const player = this.pendingAction.player;

        if (cardUid) {
            const idx = this.discard.findIndex(c => c.uid === cardUid);
            if (idx === -1) return false;
            const card = this.discard.splice(idx, 1)[0];
            this.placeCard(card, player);
        }

        this.pendingAction = null;
        this.nextTurn();
        return true;
    }

    investSalaries(player, amount) {
        let remaining = amount;
        const available = player.board.salaires.filter(s => !s.invested);
        available.sort((a, b) => (a.level || 1) - (b.level || 1));

        const toRemove = [];
        for (const salary of available) {
            if (remaining <= 0) break;
            toRemove.push(salary);
            remaining -= salary.level || 1;
        }
        for (const salary of toRemove) {
            const idx = player.board.salaires.findIndex(s => s.uid === salary.uid);
            if (idx !== -1) {
                player.personalDiscard.push(player.board.salaires.splice(idx, 1)[0]);
            }
        }
    }

    deactivateGrandPrix(player) {
        for (const d of player.board.distinctions) {
            if (d.id === 'grand_prix' && d.active) {
                d.active = false;
                d.flipped = true;
            }
        }
    }

    checkFlirtSteal(card, player) {
        if (!card.lieu) return;
        for (const other of this.players) {
            if (other.index === player.index) continue;
            const flirts = other.board.flirts;
            if (flirts.length === 0) continue;
            const lastFlirt = flirts[flirts.length - 1];
            if (lastFlirt.lieu === card.lieu && !lastFlirt.flipped) {
                flirts.pop();
                lastFlirt.stolen = true;
                if (player.isInAdultery()) {
                    player.board.flirtsAdultere.push(lastFlirt);
                } else {
                    player.board.flirts.push(lastFlirt);
                }
            }
        }
    }

    checkPoliceEffect(player) {
        if (player.board.metier && player.board.metier.id === 'policier') {
            for (const other of this.players) {
                if (other.index === player.index) continue;
                if (other.board.metier &&
                    (other.board.metier.id === 'bandit' || other.board.metier.id === 'gourou')) {
                    this.discard.push(other.board.metier);
                    other.board.metier = null;
                }
            }
        }
    }

    // ===== CARTES SPÉCIALES =====

    playSpecialCard(card, player) {
        player.board.speciales.push({ ...card, flipped: true });

        switch (card.special) {
            case 'etoileFilante':
                if (this.discard.length === 0) {
                    this.nextTurn();
                    return true;
                }
                this.phase = GamePhase.ETOILE_PICK;
                return 'etoile_pick';

            case 'casino':
                this.casinoState = { owner: player.index, bet1: null, bet2: null, open: true };
                this.phase = GamePhase.CASINO_BET;
                return 'casino_bet';

            case 'chance':
                const drawn = [];
                for (let i = 0; i < 3 && this.deck.length > 0; i++) {
                    drawn.push(this.deck.pop());
                }
                this.pendingAction = { type: 'chance', cards: drawn };
                this.phase = GamePhase.CHANCE_PICK;
                return 'chance_pick';

            case 'arcEnCiel':
                this.arcEnCielRemaining = 3;
                this.phase = GamePhase.ARC_EN_CIEL;
                return 'arc_en_ciel';

            case 'anniversaire':
                this.pendingAction = { type: 'anniversaire', collected: 0, currentTarget: -1 };
                this.phase = GamePhase.ANNIVERSARY_COLLECT;
                return 'anniversary_collect';

            case 'vengeance':
                if (player.malusRecus.length === 0) {
                    this.nextTurn();
                    return true;
                }
                this.phase = GamePhase.VENGEANCE_PICK;
                return 'vengeance_pick';

            case 'troc':
                this.phase = GamePhase.TROC_PICK;
                return 'troc_pick';

            case 'tsunami':
                this.executeTsunami();
                this.nextTurn();
                return true;

            case 'piston':
                player.usedPiston = true;
                const pistonMetiers = this.getValidPistonMetiers(player);
                if (pistonMetiers.length === 1) {
                    this.resolvePistonDirect(pistonMetiers[0], player);
                    return true;
                }
                this.phase = GamePhase.PISTON_PICK;
                return 'piston_pick';

            case 'heritage':
                player.board.salaires.push({
                    id: 'heritage_salaire', name: 'Héritage', category: 'salaire',
                    level: 3, smiles: 0, emoji: '💎', invested: false, isHeritage: true,
                    uid: `heritage_sal_${Date.now()}`
                });
                this.nextTurn();
                return true;

            default:
                this.nextTurn();
                return true;
        }
    }

    executeTsunami() {
        const allCards = [];
        for (const player of this.players) {
            allCards.push(...player.hand);
            player.hand = [];
        }

        const shuffled = shuffle(allCards);
        let i = 0;
        while (i < shuffled.length) {
            for (const player of this.players) {
                if (i < shuffled.length && player.hand.length < player.getMaxHandSize()) {
                    player.hand.push(shuffled[i]);
                    i++;
                }
            }
        }
    }

    // ===== RÉSOLUTIONS SPÉCIALES =====

    resolveChance(chosenIndex) {
        if (this.phase !== GamePhase.CHANCE_PICK) return false;
        const { cards } = this.pendingAction;

        const chosen = cards[chosenIndex];
        this.currentPlayer().hand.push(chosen);

        for (let i = 0; i < cards.length; i++) {
            if (i !== chosenIndex) this.discard.push(cards[i]);
        }

        this.pendingAction = null;
        this.phase = GamePhase.PLAY;
        return true;
    }

    resolveEtoile(cardUid) {
        if (this.phase !== GamePhase.ETOILE_PICK) return false;
        const idx = this.discard.findIndex(c => c.uid === cardUid);
        if (idx === -1) return false;

        const card = this.discard.splice(idx, 1)[0];
        const player = this.currentPlayer();

        if (this.canPlayCard(card, player)) {
            this.placeCard(card, player);
            this.nextTurn();
            return true;
        }
        this.discard.splice(idx, 0, card);
        return false;
    }

    resolveVengeance(malusUid, targetPlayerIndex) {
        if (this.phase !== GamePhase.VENGEANCE_PICK) return false;
        const player = this.currentPlayer();
        const target = this.players[targetPlayerIndex];

        const malusIdx = player.malusRecus.findIndex(m => m.uid === malusUid);
        if (malusIdx === -1) return false;

        const malus = player.malusRecus.splice(malusIdx, 1)[0];
        this.applyMalus(malus, target);
        this.nextTurn();
        return true;
    }

    resolveTroc(targetPlayerIndex) {
        if (this.phase !== GamePhase.TROC_PICK) return false;
        const player = this.currentPlayer();
        const target = this.players[targetPlayerIndex];

        if (player.hand.length === 0 || target.hand.length === 0) return false;

        const myIdx = Math.floor(Math.random() * player.hand.length);
        const theirIdx = Math.floor(Math.random() * target.hand.length);

        const myCard = player.hand.splice(myIdx, 1)[0];
        const theirCard = target.hand.splice(theirIdx, 1)[0];

        player.hand.push(theirCard);
        target.hand.push(myCard);

        this.nextTurn();
        return true;
    }

    resolveArcEnCiel(card) {
        if (this.phase !== GamePhase.ARC_EN_CIEL) return false;
        const player = this.currentPlayer();

        if (card === null) {
            const cardsPlayed = 3 - this.arcEnCielRemaining;
            for (let i = 0; i < cardsPlayed && this.deck.length > 0; i++) {
                player.hand.push(this.deck.pop());
            }
            this.arcEnCielRemaining = 0;
            this.nextTurn();
            return 'done';
        }

        const handIdx = player.hand.findIndex(c => c.uid === card.uid);
        if (handIdx === -1) return false;

        player.hand.splice(handIdx, 1);

        if (card.category === 'malus') {
            const targets = this.getValidMalusTargets(card);
            if (targets.length > 0) {
                this.applyMalus(card, targets[0]);
            } else {
                this.discard.push(card);
            }
        } else if (this.canPlayCard(card, player)) {
            this.placeCard(card, player);
        } else {
            this.discard.push(card);
        }

        this.arcEnCielRemaining--;

        if (this.arcEnCielRemaining <= 0) {
            const cardsPlayed = 3;
            for (let i = 0; i < cardsPlayed && this.deck.length > 0; i++) {
                if (player.hand.length < player.getMaxHandSize()) {
                    player.hand.push(this.deck.pop());
                }
            }
            this.nextTurn();
            return 'done';
        }

        return true;
    }

    resolveCasinoBet(salaryCard) {
        if (!this.casinoState) return false;
        const player = this.currentPlayer();

        if (this.casinoState.bet1 === null) {
            const idx = player.board.salaires.findIndex(s => s.uid === salaryCard.uid && !s.invested);
            if (idx === -1) return false;
            const sal = player.board.salaires.splice(idx, 1)[0];
            this.casinoState.bet1 = { card: sal, playerIndex: player.index };

            if (this.deck.length > 0 && player.hand.length < player.getMaxHandSize()) {
                player.hand.push(this.deck.pop());
            }
            this.nextTurn();
            return true;
        }

        return false;
    }

    resolveCasinoChallenge(salaryCard) {
        if (!this.casinoState || !this.casinoState.bet1) return false;
        const player = this.currentPlayer();

        const idx = player.board.salaires.findIndex(s => s.uid === salaryCard.uid && !s.invested);
        if (idx === -1) return false;

        const sal = player.board.salaires.splice(idx, 1)[0];
        this.casinoState.bet2 = { card: sal, playerIndex: player.index };

        const bet1 = this.casinoState.bet1;
        const bet2 = this.casinoState.bet2;

        if ((bet1.card.level || 1) === (bet2.card.level || 1)) {
            const winner = this.players[bet2.playerIndex];
            winner.board.salaires.push({ ...bet1.card, invested: false });
            winner.board.salaires.push({ ...bet2.card, invested: false });
        } else {
            const winner = this.players[bet1.playerIndex];
            winner.board.salaires.push({ ...bet1.card, invested: false });
            winner.board.salaires.push({ ...bet2.card, invested: false });
        }

        this.casinoState.bet1 = null;
        this.casinoState.bet2 = null;
        return true;
    }

    resolvePiston(metierCard) {
        if (this.phase !== GamePhase.PISTON_PICK) return false;
        const player = this.currentPlayer();
        return this.resolvePistonDirect(metierCard, player);
    }

    resolvePistonDirect(metierCard, player) {
        if (metierCard.category !== 'metier') return false;
        if (metierCard.isPromotion) return false;

        const handIdx = player.hand.findIndex(c => c.uid === metierCard.uid);
        if (handIdx === -1) return false;

        player.hand.splice(handIdx, 1);
        player.board.metier = metierCard;
        this.checkPoliceEffect(player);

        if (this.deck.length > 0 && player.hand.length < player.getMaxHandSize()) {
            player.hand.push(this.deck.pop());
        }

        player.usedPiston = false;
        this.nextTurn();
        return true;
    }

    getValidPistonMetiers(player) {
        if (!player) player = this.currentPlayer();
        return player.hand.filter(c => c.category === 'metier' && !c.isPromotion);
    }

    // ===== MALUS =====

    getValidMalusTargets(malusCard) {
        return this.players.filter((p, i) => {
            if (i === this.currentPlayerIndex) return false;
            return this.canApplyMalus(malusCard, p);
        });
    }

    canApplyMalus(malusCard, target) {
        const type = malusCard.special || malusCard.id;

        switch (type) {
            case 'accident':
                if (target.board.metier && target.board.metier.advantage === 'noAccident') return false;
                return true;
            case 'maladie':
                if (target.board.metier && target.board.metier.advantage === 'noMaladie') return false;
                return true;
            case 'burnout':
                return target.hasMetier();
            case 'divorce':
                if (!target.isMarried()) return false;
                if (target.board.metier && target.board.metier.advantage === 'cantDivorce') return false;
                return true;
            case 'impot':
                if (target.getMetierId() === 'bandit') return false;
                return target.hasMetier() && target.board.salaires.some(s => !s.invested);
            case 'licenciement':
                if (!target.hasMetier()) return false;
                if (target.getMetierId() === 'bandit') return false;
                if (target.isFonctionnaire()) return false;
                if (target.board.metier && target.board.metier.advantage === 'noLicenciement') return false;
                return true;
            case 'prison':
                return target.getMetierId() === 'bandit';
            case 'redoublement':
                return !target.hasMetier() && target.board.etudes.length > 0;
            case 'attentat':
                const hasMilitaire = this.players.some(p =>
                    p.board.metier && p.board.metier.advantage === 'noAttentat'
                );
                if (hasMilitaire) return false;
                return this.players.some(p => p.board.enfants.length > 0);
            default:
                return true;
        }
    }

    applyMalus(malusCard, target) {
        const type = malusCard.special || malusCard.id;

        switch (type) {
            case 'accident':
            case 'maladie':
                target.skipTurns = 1;
                break;

            case 'burnout':
                target.skipTurns = 1;
                break;

            case 'divorce':
                if (target.isInAdultery()) {
                    this.discard.push(target.board.adultere);
                    this.discard.push(target.board.mariage);
                    for (const e of target.board.enfants) this.discard.push(e);
                    target.board.enfants = [];
                    target.board.adultere = null;
                    target.board.mariage = null;
                } else {
                    this.discard.push(target.board.mariage);
                    target.board.mariage = null;
                }
                break;

            case 'impot':
                const sals = target.board.salaires.filter(s => !s.invested);
                if (sals.length > 0) {
                    const last = sals[sals.length - 1];
                    const idx = target.board.salaires.findIndex(s => s.uid === last.uid);
                    if (idx !== -1) {
                        target.personalDiscard.push(target.board.salaires.splice(idx, 1)[0]);
                    }
                }
                break;

            case 'licenciement':
                if (target.board.metier) {
                    this.discard.push(target.board.metier);
                    target.board.metier = null;
                    this.deactivateGrandPrix(target);
                }
                break;

            case 'prison':
                if (target.getMetierId() === 'bandit') {
                    target.skipTurns = 3;
                    target.personalDiscard.push(target.board.metier);
                    target.board.metier = null;
                    target.hadBandit = true;
                }
                break;

            case 'redoublement':
                if (target.board.etudes.length > 0) {
                    const lastEtude = target.board.etudes.pop();
                    target.personalDiscard.push(lastEtude);
                }
                break;

            case 'attentat':
                const attacker = this.currentPlayer();
                attacker.hadAttentat = true;
                for (const p of this.players) {
                    for (const e of p.board.enfants) {
                        p.personalDiscard.push(e);
                    }
                    p.board.enfants = [];
                }
                attacker.personalDiscard.push({ ...malusCard, flipped: true });
                attacker.malusRecus.push({ ...malusCard, flipped: true });
                return;
        }

        target.malusRecus.push({ ...malusCard, flipped: true });
        target.personalDiscard.push({ ...malusCard, flipped: true });
    }

    selectMalusTarget(targetPlayerIndex) {
        if (this.phase !== GamePhase.CHOOSE_TARGET) return false;
        if (!this.pendingAction || this.pendingAction.type !== 'malus') return false;

        const target = this.players[targetPlayerIndex];
        const card = this.pendingAction.card;

        this.applyMalus(card, target);
        this.pendingAction = null;
        this.nextTurn();
        return true;
    }

    // ===== DÉFAUSSER UNE CARTE =====

    discardCard(card) {
        if (this.phase !== GamePhase.PLAY) return false;

        const player = this.currentPlayer();
        const handIndex = player.hand.findIndex(c => c.uid === card.uid);
        if (handIndex === -1) return false;

        player.hand.splice(handIndex, 1);
        this.discard.push(card);
        this.nextTurn();
        return true;
    }

    // ===== TOUR SUIVANT =====

    nextTurn() {
        if (this.deck.length === 0) {
            let allEmpty = this.players.every(p => p.hand.length === 0);
            if (allEmpty) {
                this.phase = GamePhase.GAME_OVER;
                return;
            }
        }

        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.phase = GamePhase.DRAW;
    }

    isGameOver() {
        return this.phase === GamePhase.GAME_OVER;
    }

    getRankings() {
        return [...this.players]
            .map(p => ({ player: p, score: p.getScore() }))
            .sort((a, b) => b.score - a.score);
    }
}
