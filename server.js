const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname)));

const rooms = new Map();

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function getUniqueCode() {
    let code;
    do { code = generateCode(); } while (rooms.has(code));
    return code;
}

function broadcastLobby(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    const lobbyData = {
        code: roomCode,
        players: room.players.map(p => ({ name: p.name, isHost: p.isHost })),
        maxPlayers: room.maxPlayers,
        settings: room.settings,
        hostId: room.hostId
    };
    io.to(roomCode).emit('lobby_update', lobbyData);
}

io.on('connection', (socket) => {
    console.log(`Connected: ${socket.id}`);

    socket.on('create_room', ({ playerName, maxPlayers, settings }) => {
        const code = getUniqueCode();
        const room = {
            code,
            hostId: socket.id,
            maxPlayers: maxPlayers || 4,
            settings: settings || { variant: 'classique', deckSize: 'complet', handSize: 5 },
            players: [{ id: socket.id, name: playerName, isHost: true }],
            gameState: null,
            started: false
        };
        rooms.set(code, room);
        socket.join(code);
        socket.roomCode = code;
        socket.emit('room_created', { code });
        broadcastLobby(code);
    });

    socket.on('join_room', ({ code, playerName }) => {
        const room = rooms.get(code);
        if (!room) {
            socket.emit('join_error', { message: 'Partie introuvable' });
            return;
        }
        if (room.started) {
            const existing = room.players.find(p => p.name === playerName && !p.connected);
            if (existing) {
                existing.id = socket.id;
                existing.connected = true;
                socket.join(code);
                socket.roomCode = code;
                socket.emit('rejoined', { code, playerIndex: room.players.indexOf(existing) });
                if (room.gameState) {
                    socket.emit('game_state', sanitizeStateForPlayer(room.gameState, room.players.indexOf(existing)));
                }
                broadcastLobby(code);
                return;
            }
            socket.emit('join_error', { message: 'Partie déjà en cours' });
            return;
        }
        if (room.players.length >= room.maxPlayers) {
            socket.emit('join_error', { message: 'Partie pleine' });
            return;
        }
        if (room.players.some(p => p.name === playerName)) {
            socket.emit('join_error', { message: 'Ce pseudo est déjà pris' });
            return;
        }
        room.players.push({ id: socket.id, name: playerName, isHost: false, connected: true });
        socket.join(code);
        socket.roomCode = code;
        socket.emit('joined', { code });
        broadcastLobby(code);
    });

    socket.on('update_settings', ({ maxPlayers, settings }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.hostId !== socket.id) return;
        if (maxPlayers) room.maxPlayers = maxPlayers;
        if (settings) room.settings = { ...room.settings, ...settings };
        broadcastLobby(socket.roomCode);
    });

    socket.on('start_game', () => {
        const room = rooms.get(socket.roomCode);
        if (!room || room.hostId !== socket.id) return;
        if (room.players.length < 2) return;

        room.started = true;
        const names = room.players.map(p => p.name);
        room.gameState = createServerGame(names, room.settings);

        room.players.forEach((p, i) => {
            const sock = io.sockets.sockets.get(p.id);
            if (sock) {
                sock.emit('game_started', {
                    playerIndex: i,
                    state: sanitizeStateForPlayer(room.gameState, i)
                });
            }
        });
    });

    socket.on('game_action', (action) => {
        const room = rooms.get(socket.roomCode);
        if (!room || !room.gameState) return;

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;

        const result = executeAction(room.gameState, playerIndex, action);
        if (!result.success) {
            socket.emit('action_error', { message: result.message });
            return;
        }

        room.players.forEach((p, i) => {
            const sock = io.sockets.sockets.get(p.id);
            if (sock) {
                sock.emit('game_state', sanitizeStateForPlayer(room.gameState, i));
                if (result.event) {
                    sock.emit('game_event', result.event);
                }
            }
        });
    });

    socket.on('leave_room', () => {
        handleLeave(socket);
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);
        handleLeave(socket, true);
    });
});

function handleLeave(socket, isDisconnect = false) {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;

    if (room.started) {
        room.players[idx].connected = false;
        broadcastLobby(code);
        io.to(code).emit('game_event', {
            type: 'player_disconnected',
            playerName: room.players[idx].name
        });
    } else {
        room.players.splice(idx, 1);
        socket.leave(code);
        socket.roomCode = null;

        if (room.players.length === 0) {
            rooms.delete(code);
            return;
        }
        if (room.hostId === socket.id) {
            room.hostId = room.players[0].id;
            room.players[0].isHost = true;
        }
        broadcastLobby(code);
    }
}

// ===== SERVER-SIDE GAME ENGINE =====

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const CARD_DEFINITIONS = require('./js/cards-data.js');

function createServerDeck() {
    const deck = [];
    for (const def of CARD_DEFINITIONS) {
        const count = def.count || 1;
        for (let i = 0; i < count; i++) {
            deck.push({ ...def, uid: `${def.id}_${i}` });
        }
    }
    return shuffle(deck);
}

function createServerPlayer(name, index) {
    return {
        name,
        index,
        hand: [],
        board: {
            etudes: [], metier: null, salaires: [],
            flirts: [], mariage: null, adultere: null,
            flirtsAdultere: [], enfants: [],
            animaux: [], voyages: [], maisons: [],
            distinctions: [], speciales: []
        },
        malusRecus: [],
        personalDiscard: [],
        skipTurns: 0,
        usedPiston: false,
        hadBandit: false,
        hadAttentat: false
    };
}

function getMaxHandSize(player) {
    if (player.board.metier && player.board.metier.advantage === 'sixCards') return 6;
    return 5;
}

function getStudyLevel(player) {
    let level = 0;
    for (const card of player.board.etudes) {
        level += card.studyLevels || card.etudesValue || 1;
    }
    return level;
}

function getMetierSalaryLevel(player) {
    if (!player.board.metier) return 0;
    let level = player.board.metier.salaireMax || player.board.metier.salaryLevel || 0;
    const gp = player.board.distinctions.find(d => d.id === 'grand_prix' && d.active);
    if (gp) level = 4;
    return level;
}

function canAfford(player, price) {
    const available = player.board.salaires.filter(s => !s.invested);
    let total = 0;
    for (const s of available) total += s.salaireLevel || s.level || 1;
    return total >= price;
}

function canStudy(player) {
    if (player.board.metier) {
        const m = player.board.metier;
        if (m.advantage === 'canStudyWhileWorking' || m.keepStudies) return true;
        return false;
    }
    return player.board.etudes.length < 6;
}

function canFlirt(player) {
    const isMarried = player.board.mariage !== null;
    const isInAdultery = player.board.adultere !== null;
    if (isMarried && !isInAdultery) return false;
    if (isInAdultery) return true;
    if (player.board.metier && player.board.metier.advantage === 'unlimitedFlirts') return true;
    return player.board.flirts.length < 5;
}

function canPlayCard(game, card, player) {
    switch (card.category) {
        case 'etudes': {
            if (!canStudy(player)) return false;
            const unlimitedStudies = player.board.metier && player.board.metier.keepStudies;
            if (!unlimitedStudies && player.board.etudes.length >= 6) return false;
            if (card.requires && card.requires.studyLevel) {
                if (getStudyLevel(player) < card.requires.studyLevel) return false;
            }
            return true;
        }
        case 'metier': {
            if (card.isPromotion) {
                if (!player.board.metier) return false;
                if (card.requires && card.requires.metier && player.board.metier.id !== card.requires.metier) return false;
                if (card.requires && card.requires.metierIn && !card.requires.metierIn.includes(player.board.metier.id)) return false;
            } else {
                if (player.board.metier) return false;
            }
            if (card.etudesRequises && card.etudesRequises > 0) {
                if (getStudyLevel(player) < card.etudesRequises && !player.usedPiston) return false;
            }
            return true;
        }
        case 'salaire':
            if (!player.board.metier) return false;
            if ((card.salaireLevel || card.level) > getMetierSalaryLevel(player)) return false;
            return true;
        case 'flirt':
            return canFlirt(player);
        case 'mariage':
            if (player.board.mariage !== null) return false;
            return player.board.flirts.length > 0;
        case 'adultere':
            return player.board.mariage !== null && player.board.adultere === null;
        case 'enfant': {
            if (player.board.mariage !== null) return true;
            const lastFlirt = player.board.flirts[player.board.flirts.length - 1];
            if (lastFlirt && lastFlirt.allowsChild && !lastFlirt.childUsed) return true;
            return false;
        }
        case 'animal':
            return true;
        case 'voyage':
            if (!card.price) return true;
            if (player.board.metier && player.board.metier.advantage === 'freeVoyage') return true;
            return canAfford(player, card.price);
        case 'maison': {
            if (!card.price) return true;
            if (player.board.metier && player.board.metier.advantage === 'freeMaison') return true;
            let price = card.price;
            if (player.board.mariage !== null) price = Math.ceil(price / 2);
            return canAfford(player, price);
        }
        case 'distinction': {
            if (card.id === 'legion_honneur') {
                if (player.hadBandit || player.hadAttentat) return false;
                if (player.board.metier && player.board.metier.id === 'bandit') return false;
                return true;
            }
            if (card.id === 'grand_prix') {
                const validMetiers = card.requires?.metierIn || [];
                if (!player.board.metier) return false;
                if (!validMetiers.includes(player.board.metier.id)) return false;
                if (player.board.distinctions.some(d => d.id === 'grand_prix' && d.active)) return false;
                return true;
            }
            return true;
        }
        case 'special': {
            if (card.special === 'piston') {
                if (player.board.metier) return false;
                return player.hand.some(c => c.category === 'metier' && !c.isPromotion);
            }
            return true;
        }
        case 'malus':
            return getValidMalusTargets(game, card).length > 0;
        default:
            return true;
    }
}

function canApplyMalus(game, malusCard, target) {
    const type = malusCard.special || malusCard.id;
    switch (type) {
        case 'accident':
            if (target.board.metier && target.board.metier.advantage === 'noAccident') return false;
            return true;
        case 'maladie':
            if (target.board.metier && target.board.metier.advantage === 'noMaladie') return false;
            return true;
        case 'burnout':
            return target.board.metier !== null;
        case 'divorce':
            if (target.board.mariage === null) return false;
            if (target.board.metier && target.board.metier.advantage === 'cantDivorce') return false;
            return true;
        case 'impot':
            if (target.board.metier && target.board.metier.id === 'bandit') return false;
            return target.board.metier !== null && target.board.salaires.some(s => !s.invested);
        case 'licenciement':
            if (!target.board.metier) return false;
            if (target.board.metier.id === 'bandit') return false;
            if (target.board.metier.statut === 'fonctionnaire') return false;
            return true;
        case 'prison':
            return target.board.metier && target.board.metier.id === 'bandit';
        case 'redoublement':
            return !target.board.metier && target.board.etudes.length > 0;
        case 'attentat': {
            const hasMilitaire = game.players.some(p =>
                p.board.metier && p.board.metier.advantage === 'noAttentat'
            );
            if (hasMilitaire) return false;
            return game.players.some(p => p.board.enfants.length > 0);
        }
        default:
            return true;
    }
}

function getValidMalusTargets(game, malusCard) {
    return game.players.filter((p, i) => {
        if (i === game.currentPlayerIndex) return false;
        return canApplyMalus(game, malusCard, p);
    });
}

function placeCard(game, card, player) {
    switch (card.category) {
        case 'etudes':
            player.board.etudes.push(card);
            break;
        case 'metier':
            if (card.isPromotion && player.board.metier) {
                game.discard.push(player.board.metier);
            }
            player.board.metier = card;
            player.usedPiston = false;
            checkPoliceEffect(game, player);
            while (game.deck.length > 0 && player.hand.length < getMaxHandSize(player)) {
                player.hand.push(game.deck.pop());
            }
            break;
        case 'salaire':
            player.board.salaires.push({ ...card, invested: false });
            break;
        case 'flirt': {
            const isInAdultery = player.board.adultere !== null;
            if (isInAdultery) {
                player.board.flirtsAdultere.push(card);
            } else {
                const unlimited = player.board.metier && player.board.metier.advantage === 'unlimitedFlirts';
                if (player.board.flirts.length < 5 || card.stolen || unlimited) {
                    player.board.flirts.push(card);
                }
            }
            checkFlirtSteal(game, card, player);
            break;
        }
        case 'mariage':
            player.board.mariage = card;
            break;
        case 'adultere':
            player.board.adultere = card;
            break;
        case 'enfant':
            player.board.enfants.push(card);
            if (player.board.mariage === null) {
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
                card.linkedMetier = player.board.metier?.id;
            }
            player.board.distinctions.push(card);
            break;
    }
}

function checkFlirtSteal(game, card, player) {
    if (!card.lieu) return;
    for (const other of game.players) {
        if (other.index === player.index) continue;
        const flirts = other.board.flirts;
        if (flirts.length === 0) continue;
        const lastFlirt = flirts[flirts.length - 1];
        if (lastFlirt.lieu === card.lieu && !lastFlirt.flipped) {
            flirts.pop();
            lastFlirt.stolen = true;
            const isInAdultery = player.board.adultere !== null;
            if (isInAdultery) {
                player.board.flirtsAdultere.push(lastFlirt);
            } else {
                player.board.flirts.push(lastFlirt);
            }
        }
    }
}

function checkPoliceEffect(game, player) {
    if (player.board.metier && player.board.metier.id === 'policier') {
        for (const other of game.players) {
            if (other.index === player.index) continue;
            if (other.board.metier &&
                (other.board.metier.id === 'bandit' || other.board.metier.id === 'gourou')) {
                game.discard.push(other.board.metier);
                other.board.metier = null;
            }
        }
    }
}

function applyMalus(game, malusCard, target) {
    const type = malusCard.special || malusCard.id;
    switch (type) {
        case 'accident':
        case 'maladie':
        case 'burnout':
            target.skipTurns = type === 'burnout' ? 1 : 1;
            break;
        case 'divorce':
            if (target.board.adultere !== null) {
                game.discard.push(target.board.adultere);
                game.discard.push(target.board.mariage);
                for (const e of target.board.enfants) game.discard.push(e);
                target.board.enfants = [];
                target.board.adultere = null;
                target.board.mariage = null;
            } else {
                game.discard.push(target.board.mariage);
                target.board.mariage = null;
            }
            break;
        case 'impot': {
            const sals = target.board.salaires.filter(s => !s.invested);
            if (sals.length > 0) {
                const last = sals[sals.length - 1];
                const idx = target.board.salaires.findIndex(s => s.uid === last.uid);
                if (idx !== -1) target.personalDiscard.push(target.board.salaires.splice(idx, 1)[0]);
            }
            break;
        }
        case 'licenciement':
            if (target.board.metier) {
                game.discard.push(target.board.metier);
                target.board.metier = null;
                deactivateGrandPrix(target);
            }
            break;
        case 'prison':
            if (target.board.metier && target.board.metier.id === 'bandit') {
                target.skipTurns = 3;
                target.personalDiscard.push(target.board.metier);
                target.board.metier = null;
                target.hadBandit = true;
            }
            break;
        case 'redoublement':
            if (target.board.etudes.length > 0) {
                target.personalDiscard.push(target.board.etudes.pop());
            }
            break;
        case 'attentat': {
            const attacker = game.players[game.currentPlayerIndex];
            attacker.hadAttentat = true;
            for (const p of game.players) {
                for (const e of p.board.enfants) p.personalDiscard.push(e);
                p.board.enfants = [];
            }
            attacker.personalDiscard.push({ ...malusCard, flipped: true });
            attacker.malusRecus.push({ ...malusCard, flipped: true });
            return;
        }
    }
    target.malusRecus.push({ ...malusCard, flipped: true });
    target.personalDiscard.push({ ...malusCard, flipped: true });
}

function deactivateGrandPrix(player) {
    for (const d of player.board.distinctions) {
        if (d.id === 'grand_prix' && d.active) {
            d.active = false;
            d.flipped = true;
        }
    }
}

function nextTurn(game) {
    if (game.deck.length === 0) {
        if (game.players.every(p => p.hand.length === 0)) {
            game.phase = 'game_over';
            return;
        }
    }
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    game.phase = 'draw';
}

function createServerGame(playerNames, settings) {
    const game = {
        players: playerNames.map((name, i) => createServerPlayer(name, i)),
        deck: createServerDeck(),
        discard: [],
        outOfGame: [],
        currentPlayerIndex: 0,
        phase: 'draw',
        pendingAction: null,
        casinoState: null,
        arcEnCielRemaining: 0,
        settings
    };

    if (settings.deckSize === 'moitie') {
        game.deck = game.deck.slice(0, Math.ceil(game.deck.length / 2));
    }

    const handSize = settings.handSize || 5;
    for (const player of game.players) {
        for (let i = 0; i < handSize; i++) {
            if (game.deck.length > 0) player.hand.push(game.deck.pop());
        }
    }

    // Starting player: most smiles in hand
    let maxSmiles = -1;
    game.players.forEach((p, i) => {
        const s = p.hand.reduce((sum, c) => sum + (c.smiles || 0), 0);
        if (s > maxSmiles) { maxSmiles = s; game.currentPlayerIndex = i; }
    });

    return game;
}

function needsSalaryChoice(card, player) {
    if (card.category === 'voyage' && card.price) {
        return !(player.board.metier && player.board.metier.advantage === 'freeVoyage');
    }
    if (card.category === 'maison' && card.price) {
        return !(player.board.metier && player.board.metier.advantage === 'freeMaison');
    }
    return false;
}

function getCardPrice(card, player) {
    if (card.category === 'maison' && card.price && player.board.mariage !== null) {
        return Math.ceil(card.price / 2);
    }
    return card.price || 0;
}

function executeAction(game, playerIndex, action) {
    const player = game.players[playerIndex];

    switch (action.type) {
        case 'draw': {
            if (game.phase !== 'draw') return { success: false, message: 'Pas la phase de pioche' };
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };

            if (player.skipTurns > 0) {
                player.skipTurns--;
                nextTurn(game);
                return { success: true, event: { type: 'turn_skipped', playerName: player.name } };
            }

            if (game.deck.length === 0) {
                if (player.hand.length > 0) {
                    game.phase = 'play';
                    return { success: true, event: { type: 'no_draw' } };
                }
                game.phase = 'game_over';
                return { success: true, event: { type: 'game_over' } };
            }

            player.hand.push(game.deck.pop());
            game.phase = 'play';
            return { success: true, event: { type: 'card_drawn', playerName: player.name } };
        }

        case 'take_discard': {
            if (game.phase !== 'draw') return { success: false, message: 'Pas la phase de pioche' };
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };
            if (game.discard.length === 0) return { success: false, message: 'Défausse vide' };

            if (player.skipTurns > 0) {
                player.skipTurns--;
                nextTurn(game);
                return { success: true, event: { type: 'turn_skipped', playerName: player.name } };
            }

            const card = game.discard[game.discard.length - 1];
            if (!canPlayCard(game, card, player)) {
                return { success: false, message: 'Carte non jouable' };
            }

            game.discard.pop();
            playCardDirect(game, card, player);
            return { success: true, event: { type: 'took_discard', playerName: player.name, cardName: card.name } };
        }

        case 'play_card': {
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };
            const isPlay = game.phase === 'play' || game.phase === 'arc_en_ciel' || game.phase === 'piston_pick';
            if (!isPlay) return { success: false, message: 'Pas la phase de jeu' };

            const card = player.hand.find(c => c.uid === action.cardUid);
            if (!card) return { success: false, message: 'Carte non trouvée en main' };

            if (game.phase === 'arc_en_ciel') {
                return resolveArcEnCiel(game, card);
            }

            if (!canPlayCard(game, card, player)) {
                return { success: false, message: 'Carte non jouable' };
            }

            const handIdx = player.hand.findIndex(c => c.uid === card.uid);
            player.hand.splice(handIdx, 1);

            if (needsSalaryChoice(card, player)) {
                const price = getCardPrice(card, player);
                game.pendingAction = { type: 'salary_payment', card, price };
                game.phase = 'choose_salary';
                return { success: true, event: { type: 'choose_salary', price } };
            }

            if (card.category === 'malus') {
                const targets = getValidMalusTargets(game, card);
                if (targets.length === 1) {
                    applyMalus(game, card, targets[0]);
                    nextTurn(game);
                    return { success: true, event: { type: 'malus_applied', cardName: card.name, targetName: targets[0].name } };
                }
                game.pendingAction = { type: 'malus', card };
                game.phase = 'choose_target';
                return { success: true, event: { type: 'choose_target', targets: targets.map(t => ({ index: t.index, name: t.name })) } };
            }

            if (card.category === 'special') {
                return playSpecialCard(game, card, player);
            }

            placeCard(game, card, player);
            nextTurn(game);
            return { success: true, event: { type: 'card_played', playerName: player.name, cardName: card.name } };
        }

        case 'discard_card': {
            if (game.phase !== 'play') return { success: false, message: 'Pas la phase de jeu' };
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };

            const card = player.hand.find(c => c.uid === action.cardUid);
            if (!card) return { success: false, message: 'Carte non trouvée' };

            const idx = player.hand.findIndex(c => c.uid === card.uid);
            player.hand.splice(idx, 1);
            game.discard.push(card);
            nextTurn(game);
            return { success: true, event: { type: 'card_discarded', playerName: player.name } };
        }

        case 'select_target': {
            if (game.phase !== 'choose_target' || !game.pendingAction) return { success: false, message: 'Pas la bonne phase' };
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };

            const target = game.players[action.targetIndex];
            if (!target) return { success: false, message: 'Cible invalide' };

            applyMalus(game, game.pendingAction.card, target);
            game.pendingAction = null;
            nextTurn(game);
            return { success: true, event: { type: 'malus_applied', targetName: target.name } };
        }

        case 'salary_payment': {
            if (game.phase !== 'choose_salary' || !game.pendingAction) return { success: false, message: 'Pas la bonne phase' };
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };

            const { card, price } = game.pendingAction;
            let total = 0;
            const toRemove = [];
            for (const uid of action.selectedUids) {
                const sal = player.board.salaires.find(s => s.uid === uid);
                if (!sal) return { success: false, message: 'Salaire non trouvé' };
                total += sal.salaireLevel || sal.level || 1;
                toRemove.push(sal);
            }
            if (total < price) return { success: false, message: 'Paiement insuffisant' };

            for (const sal of toRemove) {
                const idx = player.board.salaires.findIndex(s => s.uid === sal.uid);
                if (idx !== -1) player.personalDiscard.push(player.board.salaires.splice(idx, 1)[0]);
            }

            if (card.category === 'voyage') player.board.voyages.push(card);
            else if (card.category === 'maison') player.board.maisons.push(card);

            game.pendingAction = null;
            nextTurn(game);
            return { success: true, event: { type: 'purchase_complete', cardName: card.name } };
        }

        case 'resign': {
            if (game.phase !== 'draw') return { success: false, message: 'Pas la phase de pioche' };
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };
            if (!player.board.metier) return { success: false, message: 'Pas de métier' };

            const metier = player.board.metier;
            game.discard.push(metier);
            player.board.metier = null;
            deactivateGrandPrix(player);

            if (metier.statut === 'interimaire') {
                game.phase = 'draw';
                return { success: true, event: { type: 'resign_interimaire', playerName: player.name } };
            }

            player.skipTurns = 1;
            nextTurn(game);
            return { success: true, event: { type: 'resigned', playerName: player.name } };
        }

        case 'divorce_action': {
            if (game.phase !== 'draw') return { success: false, message: 'Pas la phase de pioche' };
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };
            if (!player.board.mariage) return { success: false, message: 'Pas marié' };
            if (player.board.metier && player.board.metier.advantage === 'cantDivorce') {
                return { success: false, message: 'Avocat empêche le divorce' };
            }

            if (player.board.adultere) {
                game.discard.push(player.board.adultere);
                game.discard.push(player.board.mariage);
                for (const e of player.board.enfants) game.discard.push(e);
                player.board.enfants = [];
                player.board.adultere = null;
                player.board.mariage = null;
            } else {
                game.discard.push(player.board.mariage);
                player.board.mariage = null;
            }

            player.skipTurns = 1;
            nextTurn(game);
            return { success: true, event: { type: 'divorced', playerName: player.name } };
        }

        case 'discard_adultery': {
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };
            if (!player.board.adultere) return { success: false, message: 'Pas en adultère' };

            game.discard.push(player.board.adultere);
            player.board.adultere = null;
            return { success: true, event: { type: 'adultery_stopped', playerName: player.name } };
        }

        case 'chance_pick': {
            if (game.phase !== 'chance_pick' || !game.pendingAction) return { success: false, message: 'Pas la bonne phase' };
            const { cards } = game.pendingAction;
            const chosen = cards[action.chosenIndex];
            if (!chosen) return { success: false, message: 'Choix invalide' };

            player.hand.push(chosen);
            for (let i = 0; i < cards.length; i++) {
                if (i !== action.chosenIndex) game.discard.push(cards[i]);
            }
            game.pendingAction = null;
            game.phase = 'play';
            return { success: true, event: { type: 'chance_resolved' } };
        }

        case 'etoile_pick': {
            if (game.phase !== 'etoile_pick') return { success: false, message: 'Pas la bonne phase' };
            if (action.cardUid === null) {
                nextTurn(game);
                return { success: true, event: { type: 'etoile_skipped' } };
            }
            const eIdx = game.discard.findIndex(c => c.uid === action.cardUid);
            if (eIdx === -1) return { success: false, message: 'Carte non trouvée' };
            const eCard = game.discard.splice(eIdx, 1)[0];
            if (canPlayCard(game, eCard, player)) {
                placeCard(game, eCard, player);
                nextTurn(game);
                return { success: true, event: { type: 'etoile_played', cardName: eCard.name } };
            }
            game.discard.splice(eIdx, 0, eCard);
            return { success: false, message: 'Carte non jouable' };
        }

        case 'troc_pick': {
            if (game.phase !== 'troc_pick') return { success: false, message: 'Pas la bonne phase' };
            const tTarget = game.players[action.targetIndex];
            if (!tTarget || tTarget.hand.length === 0) return { success: false, message: 'Cible invalide' };
            const myIdx = Math.floor(Math.random() * player.hand.length);
            const theirIdx = Math.floor(Math.random() * tTarget.hand.length);
            const myCard = player.hand.splice(myIdx, 1)[0];
            const theirCard = tTarget.hand.splice(theirIdx, 1)[0];
            player.hand.push(theirCard);
            tTarget.hand.push(myCard);
            nextTurn(game);
            return { success: true, event: { type: 'troc_done', playerName: player.name, targetName: tTarget.name } };
        }

        case 'vengeance_pick': {
            if (game.phase !== 'vengeance_pick') return { success: false, message: 'Pas la bonne phase' };
            const mIdx = player.malusRecus.findIndex(m => m.uid === action.malusUid);
            if (mIdx === -1) return { success: false, message: 'Malus non trouvé' };
            const vTarget = game.players[action.targetIndex];
            if (!vTarget) return { success: false, message: 'Cible invalide' };
            const malus = player.malusRecus.splice(mIdx, 1)[0];
            applyMalus(game, malus, vTarget);
            nextTurn(game);
            return { success: true, event: { type: 'vengeance_done' } };
        }

        case 'piston_pick': {
            if (game.phase !== 'piston_pick') return { success: false, message: 'Pas la bonne phase' };
            const pCard = player.hand.find(c => c.uid === action.cardUid);
            if (!pCard || pCard.category !== 'metier' || pCard.isPromotion) return { success: false, message: 'Métier invalide' };
            const pIdx = player.hand.findIndex(c => c.uid === pCard.uid);
            player.hand.splice(pIdx, 1);
            player.board.metier = pCard;
            checkPoliceEffect(game, player);
            if (game.deck.length > 0 && player.hand.length < getMaxHandSize(player)) {
                player.hand.push(game.deck.pop());
            }
            player.usedPiston = false;
            nextTurn(game);
            return { success: true, event: { type: 'piston_done', cardName: pCard.name } };
        }

        case 'free_maison': {
            if (!game.pendingAction || game.pendingAction.type !== 'freeMaison') return { success: false, message: 'Pas la bonne phase' };
            if (action.cardUid) {
                const mIdx = player.hand.findIndex(c => c.uid === action.cardUid);
                if (mIdx === -1) return { success: false, message: 'Maison non trouvée' };
                const maison = player.hand.splice(mIdx, 1)[0];
                player.board.maisons.push(maison);
            }
            game.pendingAction = null;
            nextTurn(game);
            return { success: true, event: { type: 'free_maison_done' } };
        }

        case 'pick_discard': {
            if (!game.pendingAction || game.pendingAction.type !== 'pickDiscard') return { success: false, message: 'Pas la bonne phase' };
            if (action.cardUid) {
                const dIdx = game.discard.findIndex(c => c.uid === action.cardUid);
                if (dIdx === -1) return { success: false, message: 'Carte non trouvée' };
                const dCard = game.discard.splice(dIdx, 1)[0];
                placeCard(game, dCard, player);
            }
            game.pendingAction = null;
            nextTurn(game);
            return { success: true, event: { type: 'pick_discard_done' } };
        }

        case 'buy_discard': {
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };
            if (!player.board.metier || player.board.metier.advantage !== 'buyDiscard') return { success: false, message: 'Pas Chef des achats' };
            const bIdx = game.discard.findIndex(c => c.uid === action.cardUid);
            if (bIdx === -1) return { success: false, message: 'Carte non trouvée' };
            const bCard = game.discard[bIdx];
            if (bCard.category !== 'voyage' && bCard.category !== 'maison') return { success: false, message: 'Pas une acquisition' };
            let bPrice = bCard.price || 0;
            if (bCard.category === 'maison' && player.board.mariage !== null) bPrice = Math.ceil(bPrice / 2);
            if (!canAfford(player, bPrice)) return { success: false, message: 'Pas assez de salaires' };
            game.discard.splice(bIdx, 1);
            game.pendingAction = { type: 'salary_payment', card: bCard, price: bPrice };
            game.phase = 'choose_salary';
            return { success: true, event: { type: 'choose_salary', price: bPrice } };
        }

        case 'pick_salaire': {
            if (game.currentPlayerIndex !== playerIndex) return { success: false, message: 'Pas ton tour' };
            if (!player.board.metier || player.board.metier.advantage !== 'pickSalaire') return { success: false, message: 'Pas Chef des ventes' };
            const sIdx = game.discard.findIndex(c => c.uid === action.cardUid);
            if (sIdx === -1) return { success: false, message: 'Carte non trouvée' };
            const sCard = game.discard[sIdx];
            if (sCard.category !== 'salaire') return { success: false, message: 'Pas un salaire' };
            if (!canPlayCard(game, sCard, player)) return { success: false, message: 'Salaire non jouable' };
            game.discard.splice(sIdx, 1);
            placeCard(game, sCard, player);
            return { success: true, event: { type: 'salary_picked', cardName: sCard.name } };
        }

        case 'cancel_action': {
            if (game.pendingAction && game.pendingAction.card) {
                player.hand.push(game.pendingAction.card);
            }
            game.pendingAction = null;
            game.phase = 'play';
            return { success: true };
        }

        default:
            return { success: false, message: 'Action inconnue' };
    }
}

function playCardDirect(game, card, player) {
    if (card.category === 'malus') {
        const targets = getValidMalusTargets(game, card);
        if (targets.length === 1) {
            applyMalus(game, card, targets[0]);
            nextTurn(game);
            return;
        }
        game.pendingAction = { type: 'malus', card };
        game.phase = 'choose_target';
        return;
    }
    if (card.category === 'special') {
        playSpecialCard(game, card, player);
        return;
    }
    placeCard(game, card, player);

    if (card.category === 'metier' && card.advantage === 'freeMaison') {
        const maisons = player.hand.filter(c => c.category === 'maison');
        if (maisons.length > 0) {
            game.pendingAction = { type: 'freeMaison', playerIndex: player.index };
            return;
        }
    }
    if (card.category === 'metier' && card.advantage === 'pickDiscard') {
        const playable = game.discard.filter(c => canPlayCard(game, c, player));
        if (playable.length > 0) {
            game.pendingAction = { type: 'pickDiscard', playerIndex: player.index };
            return;
        }
    }
    nextTurn(game);
}

function playSpecialCard(game, card, player) {
    player.board.speciales.push({ ...card, flipped: true });

    switch (card.special) {
        case 'etoileFilante':
            if (game.discard.length === 0) { nextTurn(game); return { success: true }; }
            game.phase = 'etoile_pick';
            return { success: true, event: { type: 'etoile_pick' } };
        case 'casino':
            game.casinoState = { owner: player.index, bet1: null, bet2: null };
            game.phase = 'casino_bet';
            nextTurn(game);
            return { success: true, event: { type: 'casino_started' } };
        case 'chance': {
            const drawn = [];
            for (let i = 0; i < 3 && game.deck.length > 0; i++) drawn.push(game.deck.pop());
            game.pendingAction = { type: 'chance', cards: drawn };
            game.phase = 'chance_pick';
            return { success: true, event: { type: 'chance_pick', cards: drawn } };
        }
        case 'arcEnCiel':
            game.arcEnCielRemaining = 3;
            game.phase = 'arc_en_ciel';
            return { success: true, event: { type: 'arc_en_ciel' } };
        case 'anniversaire':
            game.phase = 'draw';
            nextTurn(game);
            return { success: true, event: { type: 'anniversaire' } };
        case 'vengeance':
            if (player.malusRecus.length === 0) { nextTurn(game); return { success: true }; }
            game.phase = 'vengeance_pick';
            return { success: true, event: { type: 'vengeance_pick' } };
        case 'troc':
            game.phase = 'troc_pick';
            return { success: true, event: { type: 'troc_pick' } };
        case 'tsunami':
            executeTsunami(game);
            nextTurn(game);
            return { success: true, event: { type: 'tsunami' } };
        case 'piston': {
            player.usedPiston = true;
            const metiers = player.hand.filter(c => c.category === 'metier' && !c.isPromotion);
            if (metiers.length === 1) {
                const m = metiers[0];
                const idx = player.hand.findIndex(c => c.uid === m.uid);
                player.hand.splice(idx, 1);
                player.board.metier = m;
                checkPoliceEffect(game, player);
                if (game.deck.length > 0 && player.hand.length < getMaxHandSize(player)) {
                    player.hand.push(game.deck.pop());
                }
                player.usedPiston = false;
                nextTurn(game);
                return { success: true, event: { type: 'piston_auto', cardName: m.name } };
            }
            game.phase = 'piston_pick';
            return { success: true, event: { type: 'piston_pick' } };
        }
        case 'heritage':
            player.board.salaires.push({
                id: 'heritage_salaire', name: 'Héritage', category: 'salaire',
                level: 3, smiles: 0, emoji: '💎', invested: false, isHeritage: true,
                uid: `heritage_sal_${Date.now()}`
            });
            nextTurn(game);
            return { success: true, event: { type: 'heritage' } };
        default:
            nextTurn(game);
            return { success: true };
    }
}

function resolveArcEnCiel(game, card) {
    const player = game.players[game.currentPlayerIndex];
    if (card === null) {
        const played = 3 - game.arcEnCielRemaining;
        for (let i = 0; i < played && game.deck.length > 0; i++) {
            if (player.hand.length < getMaxHandSize(player)) player.hand.push(game.deck.pop());
        }
        game.arcEnCielRemaining = 0;
        nextTurn(game);
        return { success: true, event: { type: 'arc_en_ciel_done' } };
    }
    const handIdx = player.hand.findIndex(c => c.uid === card.uid);
    if (handIdx === -1) return { success: false, message: 'Carte non trouvée' };
    player.hand.splice(handIdx, 1);

    if (card.category === 'malus') {
        const targets = getValidMalusTargets(game, card);
        if (targets.length > 0) applyMalus(game, card, targets[0]);
        else game.discard.push(card);
    } else if (canPlayCard(game, card, player)) {
        placeCard(game, card, player);
    } else {
        game.discard.push(card);
    }

    game.arcEnCielRemaining--;
    if (game.arcEnCielRemaining <= 0) {
        for (let i = 0; i < 3 && game.deck.length > 0; i++) {
            if (player.hand.length < getMaxHandSize(player)) player.hand.push(game.deck.pop());
        }
        nextTurn(game);
        return { success: true, event: { type: 'arc_en_ciel_done' } };
    }
    return { success: true, event: { type: 'arc_en_ciel_continue', remaining: game.arcEnCielRemaining } };
}

function executeTsunami(game) {
    const allCards = [];
    for (const p of game.players) {
        allCards.push(...p.hand);
        p.hand = [];
    }
    const shuffled = shuffle(allCards);
    let i = 0;
    while (i < shuffled.length) {
        for (const p of game.players) {
            if (i < shuffled.length && p.hand.length < getMaxHandSize(p)) {
                p.hand.push(shuffled[i]);
                i++;
            }
        }
    }
}

function getScore(player) {
    let total = 0;
    for (const cards of [
        player.board.etudes, player.board.salaires, player.board.flirts,
        player.board.flirtsAdultere, player.board.enfants,
        player.board.animaux, player.board.voyages, player.board.maisons,
        player.board.distinctions, player.board.speciales
    ]) {
        for (const card of cards) {
            let smiles = card.smiles || 0;
            if (card.special === 'doubleIfCombo' && card.comboCards) {
                const specialIds = player.board.speciales.map(s => s.id);
                if (card.comboCards.every(cid => specialIds.includes(cid))) smiles *= 2;
            }
            total += smiles;
        }
    }
    if (player.board.metier) total += player.board.metier.smiles || 0;
    if (player.board.mariage) total += player.board.mariage.smiles || 0;
    if (player.board.adultere) total += player.board.adultere.smiles || 0;
    return total;
}

function sanitizeStateForPlayer(game, playerIndex) {
    const state = {
        phase: game.phase,
        currentPlayerIndex: game.currentPlayerIndex,
        deckCount: game.deck.length,
        discardTop: game.discard.length > 0 ? game.discard[game.discard.length - 1] : null,
        discardCount: game.discard.length,
        discard: game.discard,
        pendingAction: game.pendingAction,
        arcEnCielRemaining: game.arcEnCielRemaining,
        casinoState: game.casinoState,
        players: game.players.map((p, i) => {
            const base = {
                name: p.name,
                index: p.index,
                board: p.board,
                score: getScore(p),
                handCount: p.hand.length,
                skipTurns: p.skipTurns,
                malusRecus: p.malusRecus
            };
            if (i === playerIndex) {
                base.hand = p.hand;
            }
            // Journaliste: show all hands
            const me = game.players[playerIndex];
            if (me.board.metier && me.board.metier.advantage === 'seeHands' && i !== playerIndex) {
                base.hand = p.hand;
            }
            return base;
        })
    };

    // Medium: show top 13 deck cards
    const me = game.players[playerIndex];
    if (me.board.metier && me.board.metier.advantage === 'medium') {
        state.deckTop13 = game.deck.slice(-13).reverse();
    }

    return state;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SmileLife server running on http://localhost:${PORT}`);
});
