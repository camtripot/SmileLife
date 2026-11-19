const Network = {
    socket: null,
    roomCode: null,
    playerIndex: -1,
    isOnline: false,
    isHost: false,

    init() {
        if (typeof io === 'undefined') { console.log('Socket.io not loaded, online features disabled'); return; }
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            if (this.isOnline) {
                UI.showToast('Connexion perdue...', 'error', 5000);
            }
        });

        this.socket.on('room_created', ({ code }) => {
            this.roomCode = code;
            this.isHost = true;
            this.isOnline = true;
            document.getElementById('lobby-code').textContent = code;
            document.getElementById('lobby-settings').style.display = '';
            UI.showScreen('screen-lobby');
        });

        this.socket.on('joined', ({ code }) => {
            this.roomCode = code;
            this.isHost = false;
            this.isOnline = true;
            document.getElementById('lobby-code').textContent = code;
            document.getElementById('lobby-settings').style.display = 'none';
            UI.showScreen('screen-lobby');
        });

        this.socket.on('rejoined', ({ code, playerIndex }) => {
            this.roomCode = code;
            this.playerIndex = playerIndex;
            this.isOnline = true;
            UI.showToast('Reconnecté !', 'success');
        });

        this.socket.on('join_error', ({ message }) => {
            UI.showToast(message, 'error', 3000);
        });

        this.socket.on('lobby_update', (data) => {
            this.renderOnlineLobby(data);
        });

        this.socket.on('game_started', ({ playerIndex, state }) => {
            this.playerIndex = playerIndex;
            UI.viewedPlayerIndex = playerIndex;
            UI.showScreen('screen-game');
            this.applyState(state);
            UI.showToast('La partie commence !', 'success', 2000);
        });

        this.socket.on('game_state', (state) => {
            this.applyState(state);
        });

        this.socket.on('game_event', (event) => {
            this.handleEvent(event);
        });

        this.socket.on('action_error', ({ message }) => {
            UI.showToast(message, 'error', 2000);
        });
    },

    // ===== ROOM ACTIONS =====

    createRoom(playerName) {
        this.socket.emit('create_room', {
            playerName,
            maxPlayers: 4,
            settings: { variant: 'classique', deckSize: 'complet', handSize: 5 }
        });
    },

    joinRoom(code, playerName) {
        this.socket.emit('join_room', { code: code.toUpperCase(), playerName });
    },

    updateSettings(data) {
        this.socket.emit('update_settings', data);
    },

    startGame() {
        this.socket.emit('start_game');
    },

    leaveRoom() {
        this.socket.emit('leave_room');
        this.isOnline = false;
        this.roomCode = null;
        this.playerIndex = -1;
        UI.showScreen('screen-mode');
    },

    // ===== GAME ACTIONS =====

    sendAction(action) {
        this.socket.emit('game_action', action);
    },

    draw() { this.sendAction({ type: 'draw' }); },
    takeDiscard() { this.sendAction({ type: 'take_discard' }); },
    playCard(cardUid) { this.sendAction({ type: 'play_card', cardUid }); },
    discardCard(cardUid) { this.sendAction({ type: 'discard_card', cardUid }); },
    selectTarget(targetIndex) { this.sendAction({ type: 'select_target', targetIndex }); },
    salaryPayment(selectedUids) { this.sendAction({ type: 'salary_payment', selectedUids }); },
    resign() { this.sendAction({ type: 'resign' }); },
    divorceAction() { this.sendAction({ type: 'divorce_action' }); },
    discardAdultery() { this.sendAction({ type: 'discard_adultery' }); },
    chancePick(chosenIndex) { this.sendAction({ type: 'chance_pick', chosenIndex }); },
    etoilePick(cardUid) { this.sendAction({ type: 'etoile_pick', cardUid }); },
    trocPick(targetIndex) { this.sendAction({ type: 'troc_pick', targetIndex }); },
    vengeancePick(malusUid, targetIndex) { this.sendAction({ type: 'vengeance_pick', malusUid, targetIndex }); },
    pistonPick(cardUid) { this.sendAction({ type: 'piston_pick', cardUid }); },
    freeMaison(cardUid) { this.sendAction({ type: 'free_maison', cardUid }); },
    pickDiscard(cardUid) { this.sendAction({ type: 'pick_discard', cardUid }); },
    buyDiscard(cardUid) { this.sendAction({ type: 'buy_discard', cardUid }); },
    pickSalaire(cardUid) { this.sendAction({ type: 'pick_salaire', cardUid }); },
    cancelAction() { this.sendAction({ type: 'cancel_action' }); },

    // ===== LOBBY RENDERING =====

    renderOnlineLobby(data) {
        const list = document.getElementById('lobby-player-list');
        list.innerHTML = '';
        for (let i = 0; i < data.maxPlayers; i++) {
            const p = data.players[i];
            const slot = document.createElement('div');
            slot.className = `player-slot ${p ? 'occupied' : 'empty'}`;
            slot.innerHTML = p
                ? `<div class="player-avatar">${p.name[0].toUpperCase()}</div><span class="player-slot-name">${p.name}</span>${p.isHost ? '<span class="player-slot-badge">Chef</span>' : ''}`
                : `<div class="player-avatar">?</div><span class="player-slot-name">En attente...</span>`;
            list.appendChild(slot);
        }
        document.getElementById('player-count-display').textContent = `(${data.players.length}/${data.maxPlayers})`;

        const startBtn = document.getElementById('btn-start-game');
        startBtn.disabled = !this.isHost || data.players.length < 2;
        startBtn.style.display = this.isHost ? '' : 'none';

        if (!this.isHost) {
            document.getElementById('lobby-settings').style.display = 'none';
        }
    },

    // ===== STATE APPLICATION =====

    applyState(state) {
        this.currentState = state;
        const myPlayer = state.players[this.playerIndex];
        if (!myPlayer) return;

        UI.onlineState = state;
        UI.onlinePlayerIndex = this.playerIndex;
        UI.renderOnlineGame(state, this.playerIndex);
    },

    handleEvent(event) {
        switch (event.type) {
            case 'card_drawn':
                break;
            case 'card_played':
                UI.showToast(`${event.playerName} a joué ${event.cardName}`, 'info', 1500);
                break;
            case 'card_discarded':
                break;
            case 'malus_applied':
                if (event.targetName) UI.showToast(`${event.cardName || 'Malus'} infligé à ${event.targetName}`, 'warning', 2000);
                break;
            case 'turn_skipped':
                UI.showToast(`${event.playerName} passe son tour`, 'info', 1500);
                break;
            case 'resigned':
            case 'resign_interimaire':
                UI.showToast(`${event.playerName} a démissionné`, 'info', 1500);
                break;
            case 'divorced':
                UI.showToast(`${event.playerName} a divorcé`, 'info', 1500);
                break;
            case 'tsunami':
                UI.showToast('Tsunami ! Toutes les mains redistribuées', 'warning', 2000);
                break;
            case 'game_over':
                break;
            case 'player_disconnected':
                UI.showToast(`${event.playerName} s'est déconnecté`, 'warning', 3000);
                break;
            case 'choose_target':
                if (this.currentState?.currentPlayerIndex === this.playerIndex) {
                    UI.showOnlineTargetModal(event.targets);
                }
                break;
            case 'choose_salary':
                if (this.currentState?.currentPlayerIndex === this.playerIndex) {
                    UI.showOnlineSalaryModal(event.price);
                }
                break;
            case 'chance_pick':
                if (this.currentState?.currentPlayerIndex === this.playerIndex) {
                    UI.showOnlineChanceModal(event.cards);
                }
                break;
        }
    },

    isMyTurn() {
        return this.currentState && this.currentState.currentPlayerIndex === this.playerIndex;
    }
};
