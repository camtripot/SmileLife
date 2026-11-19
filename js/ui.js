const UI = {
    game: new Game(),
    selectedCardUid: null,
    toastContainer: null,
    viewedPlayerIndex: 0,
    onlineState: null,
    onlinePlayerIndex: -1,

    init() {
        this.initBackground();
        this.initToastContainer();
        this.bindHomeEvents();
        this.bindModeEvents();
        this.bindJoinEvents();
        this.bindLobbyEvents();
        this.bindLocalConfigEvents();
        this.bindGameEvents();
        this.bindModalEvents();
        this.bindBoardNav();
        this.bindGlobalDismiss();
        this.updateLocalPlayerInputs(3);
        if (typeof Network !== 'undefined') Network.init();
    },

    // ===== BACKGROUND PARTICLES =====
    initBackground() {
        const canvas = document.getElementById('bg-canvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener('resize', resize);

        for (let i = 0; i < 60; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                r: Math.random() * 2 + 0.5,
                dx: (Math.random() - 0.5) * 0.4,
                dy: (Math.random() - 0.5) * 0.4,
                alpha: Math.random() * 0.4 + 0.1
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of particles) {
                p.x += p.dx; p.y += p.dy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(124, 77, 255, ${p.alpha})`;
                ctx.fill();
            }
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(124, 77, 255, ${0.08 * (1 - d / 120)})`;
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(draw);
        };
        draw();
    },

    // ===== TOAST =====
    initToastContainer() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
    },

    showToast(message, type = 'info', duration = 2500) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        this.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // ===== SCREENS =====
    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },
    showModal(id) { document.getElementById(id).classList.add('active'); },
    hideModal(id) { document.getElementById(id).classList.remove('active'); },

    // ===== HOME =====
    bindHomeEvents() {
        document.getElementById('btn-play').addEventListener('click', () => this.showScreen('screen-mode'));
        document.getElementById('btn-rules-home').addEventListener('click', () => this.showModal('modal-rules'));
    },

    // ===== MODE =====
    bindModeEvents() {
        document.getElementById('btn-back-home').addEventListener('click', () => this.showScreen('screen-home'));
        document.getElementById('btn-host').addEventListener('click', () => this.hostGame());
        document.getElementById('btn-join').addEventListener('click', () => this.showScreen('screen-join'));
        document.getElementById('btn-local').addEventListener('click', () => this.showScreen('screen-local-config'));
    },

    // ===== HOST =====
    hostGame() {
        this.isHosting = true;
        document.getElementById('join-code').parentElement.style.display = 'none';
        document.getElementById('join-name').value = '';
        document.querySelector('#screen-join .panel-title').textContent = 'Créer une partie';
        document.getElementById('btn-join-confirm').textContent = 'Créer 🚀';
        document.getElementById('btn-back-mode-join').onclick = () => {
            this.isHosting = false;
            this.resetJoinScreen();
            this.showScreen('screen-mode');
        };
        this.showScreen('screen-join');
    },
    resetJoinScreen() {
        document.getElementById('join-code').parentElement.style.display = '';
        document.querySelector('#screen-join .panel-title').textContent = 'Rejoindre une partie';
        document.getElementById('btn-join-confirm').textContent = 'Rejoindre 🚀';
    },
    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    },

    // ===== JOIN =====
    bindJoinEvents() {
        document.getElementById('btn-back-mode-join').addEventListener('click', () => {
            this.isHosting = false;
            this.resetJoinScreen();
            this.showScreen('screen-mode');
        });
        document.getElementById('btn-join-confirm').addEventListener('click', () => {
            const name = document.getElementById('join-name').value.trim();
            if (!name) { this.showToast('Entre ton pseudo', 'warning'); return; }
            if (this.isHosting) {
                this.isHosting = false;
                this.resetJoinScreen();
                Network.createRoom(name);
                return;
            }
            const code = document.getElementById('join-code').value.trim().toUpperCase();
            if (!code || code.length < 4) { this.showToast('Entre le code de la partie', 'warning'); return; }
            Network.joinRoom(code, name);
        });
    },

    // ===== LOBBY =====
    bindLobbyEvents() {
        document.getElementById('btn-copy-code').addEventListener('click', () => {
            const code = document.getElementById('lobby-code').textContent;
            navigator.clipboard.writeText(code).then(() => this.showToast('Code copié !', 'success', 1500));
        });
        document.getElementById('btn-leave-lobby').addEventListener('click', () => {
            if (Network.isOnline) Network.leaveRoom();
            else this.showScreen('screen-mode');
        });
        document.getElementById('btn-start-game').addEventListener('click', () => {
            if (Network.isOnline) {
                Network.startGame();
            } else {
                const names = this.lobbyPlayers.map(p => p.name);
                if (names.length < 2) { this.showToast('Il faut au moins 2 joueurs', 'warning'); return; }
                this.game.init(names);
                this.showTransition();
            }
        });
        document.querySelectorAll('#max-players-selector .setting-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#max-players-selector .setting-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (Network.isOnline) {
                    Network.updateSettings({ maxPlayers: parseInt(btn.dataset.val) });
                } else {
                    this.maxPlayers = parseInt(btn.dataset.val);
                    this.renderLobby();
                }
            });
        });
        ['variant-selector', 'deck-selector'].forEach(id => {
            document.querySelectorAll(`#${id} .setting-btn`).forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll(`#${id} .setting-btn`).forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (Network.isOnline) {
                        const variant = document.querySelector('#variant-selector .setting-btn.active')?.dataset.val;
                        const deckSize = document.querySelector('#deck-selector .setting-btn.active')?.dataset.val;
                        Network.updateSettings({ settings: { variant, deckSize } });
                    }
                });
            });
        });
    },

    renderLobby() {
        const list = document.getElementById('lobby-player-list');
        list.innerHTML = '';
        const max = this.maxPlayers || 4;
        for (let i = 0; i < max; i++) {
            const p = this.lobbyPlayers[i];
            const slot = document.createElement('div');
            slot.className = `player-slot ${p ? 'occupied' : 'empty'}`;
            slot.innerHTML = p
                ? `<div class="player-avatar">${p.name[0].toUpperCase()}</div><span class="player-slot-name">${p.name}</span>${p.isHost ? '<span class="player-slot-badge">Chef</span>' : ''}`
                : `<div class="player-avatar">?</div><span class="player-slot-name">En attente...</span>`;
            list.appendChild(slot);
        }
        document.getElementById('player-count-display').textContent = `(${this.lobbyPlayers.length}/${max})`;
        document.getElementById('btn-start-game').disabled = this.lobbyPlayers.length < 2;
    },

    // ===== LOCAL CONFIG =====
    bindLocalConfigEvents() {
        document.getElementById('btn-back-mode-local').addEventListener('click', () => this.showScreen('screen-mode'));
        document.querySelectorAll('#local-player-count .setting-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#local-player-count .setting-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateLocalPlayerInputs(parseInt(btn.dataset.val));
            });
        });
        ['local-variant-selector', 'local-deck-selector', 'local-hand-selector', 'local-order-selector'].forEach(id => {
            document.querySelectorAll(`#${id} .setting-btn`).forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll(`#${id} .setting-btn`).forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.updateOptionsSummary();
                });
            });
        });
        document.getElementById('btn-options-toggle').addEventListener('click', () => {
            document.getElementById('modal-options').classList.add('active');
        });
        document.getElementById('btn-close-options').addEventListener('click', () => {
            document.getElementById('modal-options').classList.remove('active');
        });
        document.getElementById('btn-start-local').addEventListener('click', () => this.startLocalGame());
    },

    updateLocalPlayerInputs(count) {
        const container = document.getElementById('local-player-names');
        container.innerHTML = '';
        const emojis = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'];
        for (let i = 0; i < count; i++) {
            const div = document.createElement('div');
            div.className = 'input-group';
            div.innerHTML = `<label>${emojis[i]} Joueur ${i + 1}</label><input type="text" class="input-fancy" data-player="${i}" placeholder="Joueur ${i + 1}" maxlength="15">`;
            container.appendChild(div);
        }
    },

    getLocalOptions() {
        return {
            variant: document.querySelector('#local-variant-selector .setting-btn.active')?.dataset.val || 'classique',
            deckSize: document.querySelector('#local-deck-selector .setting-btn.active')?.dataset.val || 'complet',
            handSize: parseInt(document.querySelector('#local-hand-selector .setting-btn.active')?.dataset.val || '5'),
            turnOrder: document.querySelector('#local-order-selector .setting-btn.active')?.dataset.val || 'random',
        };
    },

    updateOptionsSummary() {
        const o = this.getLocalOptions();
        const labels = {
            variant: o.variant === 'classique' ? 'Classique' : 'Rivière',
            deck: o.deckSize === 'complet' ? 'Deck complet' : 'Demi-deck',
            hand: `${o.handSize} cartes`,
            order: o.turnOrder === 'random' ? 'Aléatoire' : 'Dans l\'ordre',
        };
        document.getElementById('options-summary').textContent =
            `${labels.variant} · ${labels.deck} · ${labels.hand} · ${labels.order}`;
    },

    startLocalGame() {
        const inputs = document.querySelectorAll('#local-player-names input');
        const names = [];
        inputs.forEach((input, i) => names.push(input.value.trim() || `Joueur ${i + 1}`));
        if (names.length < 2) { this.showToast('Il faut au moins 2 joueurs !', 'error'); return; }
        const options = this.getLocalOptions();
        this.game.init(names, options);
        this.showTransition();
    },

    // ===== TRANSITION =====
    showTransition() {
        if (this.game.isGameOver()) { this.showGameOver(); return; }
        const player = this.game.currentPlayer();
        if (player.skipTurns > 0) {
            document.getElementById('transition-emoji').textContent = '💤';
            document.getElementById('transition-text').textContent = `${player.name} passe son tour !`;
            document.getElementById('transition-hint').textContent = player.skipTurns > 1 ? `Encore ${player.skipTurns} tour(s) à passer` : '';
        } else {
            document.getElementById('transition-emoji').textContent = '🎯';
            document.getElementById('transition-text').textContent = `C'est au tour de ${player.name} !`;
            document.getElementById('transition-hint').textContent = 'Passe l\'écran au joueur concerné';
        }
        this.showScreen('screen-transition');
        document.getElementById('btn-ready').onclick = () => {
            if (player.skipTurns > 0) {
                this.game.drawCard();
                this.showTransition();
            } else {
                this.viewedPlayerIndex = this.game.currentPlayerIndex;
                this.selectedCardUid = null;
                this.closePreview();
                this.showScreen('screen-game');
                this.renderGame();
            }
        };
    },

    // ===== GLOBAL DISMISS =====
    bindGlobalDismiss() {
        document.addEventListener('click', (e) => {
            if (!this.selectedCardUid) return;
            const panel = document.getElementById('card-preview-panel');
            const hand = document.getElementById('player-hand');
            if (panel.contains(e.target) || hand.contains(e.target)) return;
            this.selectedCardUid = null;
            this.closePreview();
            if (this.game.players.length > 0) {
                this.renderFanHand(this.game.currentPlayer());
            }
        });
    },

    // ===== BOARD NAVIGATION =====
    bindBoardNav() {
        document.getElementById('btn-board-prev').addEventListener('click', () => {
            this.viewedPlayerIndex = (this.viewedPlayerIndex - 1 + this.game.players.length) % this.game.players.length;
            this.renderBoardNav();
            this.renderPlayerBoard(this.game.players[this.viewedPlayerIndex]);
        });
        document.getElementById('btn-board-next').addEventListener('click', () => {
            this.viewedPlayerIndex = (this.viewedPlayerIndex + 1) % this.game.players.length;
            this.renderBoardNav();
            this.renderPlayerBoard(this.game.players[this.viewedPlayerIndex]);
        });
    },

    renderBoardNav() {
        const tabs = document.getElementById('board-nav-tabs');
        tabs.innerHTML = '';
        this.game.players.forEach((p, i) => {
            const btn = document.createElement('button');
            btn.className = 'board-nav-tab';
            if (i === this.viewedPlayerIndex) btn.classList.add('active');
            if (i === this.game.currentPlayerIndex) btn.classList.add('is-current');
            btn.innerHTML = `${p.name} <span class="tab-score">${p.getScore()}😊</span>`;
            btn.addEventListener('click', () => {
                this.viewedPlayerIndex = i;
                this.renderBoardNav();
                this.renderPlayerBoard(this.game.players[i]);
            });
            tabs.appendChild(btn);
        });
    },

    // ===== CARD PREVIEW PANEL =====
    openPreview(card, infoOnly) {
        const panel = document.getElementById('card-preview-panel');
        const visual = document.getElementById('card-preview-visual');
        const info = document.getElementById('card-preview-info');
        const actions = document.getElementById('card-preview-actions');
        const catInfo = CATEGORIES[card.category] || {};

        visual.style.background = `linear-gradient(145deg, ${catInfo.color || '#666'}, ${this.darken(catInfo.color || '#666')})`;
        let badgeHtml = '';
        if (card.salaryLevel) badgeHtml = `<span class="preview-badge">Nv.${card.salaryLevel}</span>`;
        else if (card.price) badgeHtml = `<span class="preview-badge">💰${card.price}</span>`;

        visual.innerHTML = `
            <span class="preview-emoji">${card.emoji || '?'}</span>
            <span class="preview-name">${card.name}</span>
            <span class="preview-category">${catInfo.name || card.category}</span>
            ${card.smiles > 0 ? `<span class="preview-smiles">+${card.smiles} 😊</span>` : ''}
            ${badgeHtml}
        `;

        info.textContent = card.description || '';

        actions.innerHTML = '';
        const isPlay = this.game.phase === GamePhase.PLAY || this.game.phase === GamePhase.ARC_EN_CIEL || this.game.phase === GamePhase.PISTON_PICK;
        if (isPlay && !infoOnly) {
            const canPlay = this.game.canPlayCard(card) || (this.game.phase === GamePhase.PISTON_PICK && card.category === 'metier');
            const playBtn = document.createElement('button');
            playBtn.className = 'btn-preview-play';
            playBtn.textContent = canPlay ? '▶ Jouer cette carte' : '✗ Non jouable';
            playBtn.disabled = !canPlay;
            playBtn.addEventListener('click', () => { this.closePreview(); this.handlePlayCard(card); });
            actions.appendChild(playBtn);

            const discardBtn = document.createElement('button');
            discardBtn.className = 'btn-preview-discard';
            discardBtn.textContent = '🗑 Défausser';
            discardBtn.addEventListener('click', () => {
                this.closePreview();
                if (this.game.discardCard(card)) {
                    this.selectedCardUid = null;
                    this.showToast('Carte défaussée', 'info', 1000);
                    this.showTransition();
                }
            });
            actions.appendChild(discardBtn);
        }

        panel.classList.add('open');
    },

    closePreview() {
        document.getElementById('card-preview-panel').classList.remove('open');
    },

    // ===== GAME EVENTS =====
    bindGameEvents() {
        document.getElementById('btn-draw').addEventListener('click', () => this.handleDraw());
        document.getElementById('btn-take-discard').addEventListener('click', () => this.handleTakeDiscard());
        document.getElementById('btn-discard').addEventListener('click', () => this.handleDiscard());
        document.getElementById('btn-resign').addEventListener('click', () => this.handleResign());
        document.getElementById('btn-divorce').addEventListener('click', () => this.handleDivorce());
        document.getElementById('btn-discard-adultery').addEventListener('click', () => this.handleDiscardAdultery());
        document.getElementById('btn-medium').addEventListener('click', () => this.showMediumModal());
        document.getElementById('btn-close-medium').addEventListener('click', () => this.hideModal('modal-medium'));
        document.getElementById('btn-buy-discard').addEventListener('click', () => this.showBuyDiscardModal());
        document.getElementById('btn-close-buy-discard').addEventListener('click', () => this.hideModal('modal-buy-discard'));
        document.getElementById('btn-pick-salaire').addEventListener('click', () => this.showPickSalaireModal());
        document.getElementById('btn-close-pick-salaire').addEventListener('click', () => this.hideModal('modal-pick-salaire'));
        document.getElementById('btn-see-hands').addEventListener('click', () => this.showSeeHandsModal());
        document.getElementById('btn-close-see-hands').addEventListener('click', () => this.hideModal('modal-see-hands'));
        document.getElementById('btn-skip-free-maison').addEventListener('click', () => {
            this.game.resolveFreeMaison(null);
            this.hideModal('modal-free-maison');
            this.showTransition();
        });
        document.getElementById('btn-skip-pick-discard').addEventListener('click', () => {
            this.game.resolvePickDiscard(null);
            this.hideModal('modal-pick-discard');
            this.showTransition();
        });
    },

    handleDraw() {
        if (Network.isOnline) { Network.draw(); return; }
        const result = this.game.drawCard();
        if (result === 'skipped') { this.showTransition(); return; }
        if (result === 'game_over') { this.showGameOver(); return; }
        if (result === 'no_draw') { this.showToast('Pioche vide ! Joue ou défausse', 'warning'); this.renderGame(); return; }
        if (result) { this.renderGame(); }
    },

    handleTakeDiscard() {
        if (Network.isOnline) { Network.takeDiscard(); return; }
        const result = this.game.takeFromDiscard();
        if (result === 'skipped') { this.showTransition(); return; }
        if (result) {
            this.showToast(`${result.name} joué depuis la défausse !`, 'success');
            this.selectedCardUid = null;
            this.showTransition();
        } else {
            this.showToast('Impossible de jouer cette carte', 'error');
        }
    },

    handleDiscard() {
        if (!this.selectedCardUid) { this.showToast('Sélectionne une carte', 'warning'); return; }
        if (Network.isOnline) { Network.discardCard(this.selectedCardUid); this.selectedCardUid = null; this.closePreview(); return; }
        const player = this.game.currentPlayer();
        const card = player.hand.find(c => c.uid === this.selectedCardUid);
        if (!card) return;
        if (this.game.discardCard(card)) {
            this.selectedCardUid = null;
            this.closePreview();
            this.showToast('Carte défaussée', 'info', 1000);
            this.showTransition();
        }
    },

    handleResign() {
        if (Network.isOnline) { Network.resign(); return; }
        const result = this.game.resign();
        if (result === 'resign_interimaire') {
            this.showToast('Démission (intérimaire) — tu peux jouer !', 'info');
            this.renderGame();
        } else if (result) {
            this.showToast('Démission — tour passé', 'info');
            this.showTransition();
        }
    },

    handleDivorce() {
        if (Network.isOnline) { Network.divorceAction(); return; }
        if (this.game.divorce()) { this.showToast('Divorce — tour passé', 'info'); this.showTransition(); }
    },

    handleDiscardAdultery() {
        if (Network.isOnline) { Network.discardAdultery(); return; }
        if (this.game.discardAdultery()) { this.showToast('Adultère stoppé', 'info'); this.renderGame(); }
    },

    handlePlayCard(card) {
        if (this.game.phase !== GamePhase.PLAY && this.game.phase !== GamePhase.ARC_EN_CIEL) return;

        if (this.game.phase === GamePhase.ARC_EN_CIEL) {
            const result = this.game.resolveArcEnCiel(card);
            if (result === 'done') { this.selectedCardUid = null; this.showTransition(); return; }
            this.renderGame();
            return;
        }

        if (!this.game.canPlayCard(card)) {
            this.showToast(this.getRequirementText(card), 'error', 3000);
            return;
        }

        const result = this.game.playCard(card);
        if (result === 'choose_target') { this.showTargetModal(); return; }
        if (result === 'chance_pick') { this.showChanceModal(); return; }
        if (result === 'etoile_pick') { this.showEtoileModal(); return; }
        if (result === 'arc_en_ciel') { this.showToast('Arc-en-ciel ! Joue jusqu\'à 3 cartes', 'info', 3000); this.renderGame(); return; }
        if (result === 'anniversary_collect') { this.showToast('Anniversaire !', 'info'); this.handleAnniversary(); return; }
        if (result === 'vengeance_pick') { this.showVengeanceModal(); return; }
        if (result === 'troc_pick') { this.showTrocModal(); return; }
        if (result === 'piston_pick') { this.showPistonModal(); return; }
        if (result === 'choose_salary') { this.showSalaryPaymentModal(); return; }
        if (result === 'choose_free_maison') { this.showFreeMaisonModal(); return; }
        if (result === 'pick_discard') { this.showPickDiscardModal(); return; }
        if (result === 'casino_bet') { this.showToast('Casino posé !', 'info'); this.showTransition(); return; }

        if (result) {
            this.selectedCardUid = null;
            this.showToast(`${card.emoji} ${card.name} joué !`, 'success', 1500);
            this.showTransition();
        }
    },

    handleAnniversary() {
        this.showToast('Anniversaire résolu !', 'success');
        this.game.phase = GamePhase.DRAW;
        this.game.nextTurn();
        this.showTransition();
    },

    getRequirementText(card) {
        if (card.category === 'etudes') {
            const p = this.game.currentPlayer();
            if (p.hasMetier()) return 'Impossible d\'étudier avec un métier';
            if (p.board.etudes.length >= 6) return 'Maximum 6 études';
            if (card.requires?.studyLevel) return `Nécessite ${card.requires.studyLevel} études`;
        }
        if (card.category === 'metier') {
            if (this.game.currentPlayer().hasMetier()) return 'Tu as déjà un métier';
            if (card.requires?.studyLevel) return `Nécessite ${card.requires.studyLevel} études`;
        }
        if (card.category === 'salaire') return 'Métier/salaire insuffisant';
        if (card.category === 'flirt') return 'Impossible de flirter';
        if (card.category === 'mariage') return 'Nécessite un flirt, pas déjà marié';
        if (card.category === 'adultere') return 'Nécessite d\'être marié';
        if (card.category === 'enfant') return 'Nécessite un mariage';
        if (card.category === 'voyage' || card.category === 'maison') return 'Salaires insuffisants';
        if (card.category === 'distinction') return 'Conditions non remplies';
        return 'Conditions non remplies';
    },

    // ===== SPECIAL MODALS =====
    showTargetModal() {
        const card = this.game.pendingAction?.card;
        const validTargets = this.game.getValidMalusTargets(card);
        const validIds = new Set(validTargets.map(t => t.index));
        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = `${card.emoji} ${card.name} — Choisir une cible`;
        this.game.players.forEach((p, i) => {
            if (i === this.game.currentPlayerIndex) return;
            const isValid = validIds.has(i);
            const btn = document.createElement('button');
            btn.className = 'target-item' + (isValid ? '' : ' target-disabled');
            btn.innerHTML = `<span class="target-name">${p.name}</span><span class="target-score">${p.getScore()} smiles</span>`;
            if (isValid) {
                btn.addEventListener('click', () => {
                    this.hideModal('modal-target');
                    this.game.selectMalusTarget(p.index);
                    this.showToast(`${card.name} infligé à ${p.name} !`, 'warning');
                    this.showTransition();
                });
            }
            list.appendChild(btn);
        });
        document.getElementById('btn-cancel-target').onclick = () => {
            this.hideModal('modal-target');
            this.game.currentPlayer().hand.push(this.game.pendingAction.card);
            this.game.pendingAction = null;
            this.game.phase = GamePhase.PLAY;
            this.renderGame();
        };
        this.showModal('modal-target');
    },

    showPistonModal() {
        const metiers = this.game.getValidPistonMetiers();
        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = '🔧 Piston — Choisir un métier';
        metiers.forEach(card => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${card.emoji} ${card.name}</span><span class="target-score">${card.description || ''}</span>`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-target');
                this.game.resolvePiston(card);
                this.showToast(`${card.emoji} ${card.name} posé via piston !`, 'success');
                this.selectedCardUid = null;
                this.showTransition();
            });
            list.appendChild(btn);
        });
        document.getElementById('btn-cancel-target').onclick = () => {
            this.hideModal('modal-target');
            const player = this.game.currentPlayer();
            const pistonIdx = player.board.speciales.findIndex(c => c.id === 'piston');
            if (pistonIdx !== -1) {
                const pistonCard = player.board.speciales.splice(pistonIdx, 1)[0];
                delete pistonCard.flipped;
                player.hand.push(pistonCard);
            }
            player.usedPiston = false;
            this.game.phase = GamePhase.PLAY;
            this.renderGame();
        };
        this.showModal('modal-target');
    },

    showSalaryPaymentModal() {
        const { card, price } = this.game.pendingAction;
        const player = this.game.currentPlayer();
        const salaries = player.board.salaires.filter(s => !s.invested);
        const selected = new Set();

        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = `${card.emoji} ${card.name} — Payer ${price} salaire${price > 1 ? 's' : ''}`;

        const totalLine = document.createElement('div');
        totalLine.className = 'salary-payment-total';
        totalLine.style.cssText = 'text-align:center; padding:8px 0; font-size:1.1em; color:var(--text-muted, #aaa);';
        list.appendChild(totalLine);

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn-primary';
        confirmBtn.style.cssText = 'width:100%; margin-top:8px; padding:12px; font-size:1.05em;';
        confirmBtn.textContent = 'Confirmer le paiement';
        confirmBtn.disabled = true;

        const updateTotal = () => {
            let total = 0;
            for (const uid of selected) {
                const s = salaries.find(x => x.uid === uid);
                if (s) total += s.salaireLevel || s.level || 1;
            }
            totalLine.textContent = `Sélectionné : ${total} / ${price}`;
            totalLine.style.color = total >= price ? 'var(--accent-green, #2ecc71)' : 'var(--text-muted, #aaa)';
            confirmBtn.disabled = total < price;
            confirmBtn.style.opacity = total < price ? '0.4' : '1';
        };

        salaries.forEach(sal => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            const salLevel = sal.salaireLevel || sal.level || 1;
            btn.innerHTML = `<span class="target-name">${sal.emoji} ${sal.name}</span><span class="target-score">= ${salLevel} salaire${salLevel > 1 ? 's' : ''}</span>`;
            btn.addEventListener('click', () => {
                if (selected.has(sal.uid)) {
                    selected.delete(sal.uid);
                    btn.style.outline = '';
                    btn.style.background = '';
                } else {
                    selected.add(sal.uid);
                    btn.style.outline = '2px solid var(--accent-green, #2ecc71)';
                    btn.style.background = 'rgba(46, 204, 113, 0.15)';
                }
                updateTotal();
            });
            list.appendChild(btn);
        });

        list.appendChild(confirmBtn);
        updateTotal();

        confirmBtn.addEventListener('click', () => {
            if (confirmBtn.disabled) return;
            this.hideModal('modal-target');
            this.game.resolveSalaryPayment([...selected]);
            this.showToast(`${card.emoji} ${card.name} acheté !`, 'success');
            this.selectedCardUid = null;
            this.showTransition();
        });

        document.getElementById('btn-cancel-target').onclick = () => {
            this.hideModal('modal-target');
            player.hand.push(card);
            this.game.pendingAction = null;
            this.game.phase = GamePhase.PLAY;
            this.renderGame();
        };
        this.showModal('modal-target');
    },

    showFreeMaisonModal() {
        const player = this.game.pendingAction.player;
        const maisons = player.hand.filter(c => c.category === 'maison');
        const container = document.getElementById('free-maison-cards');
        container.innerHTML = '';

        maisons.forEach(maison => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${maison.emoji} ${maison.name}</span><span class="target-score">+${maison.smiles} 😊</span>`;
            btn.addEventListener('click', () => {
                this.game.resolveFreeMaison(maison.uid);
                this.hideModal('modal-free-maison');
                this.showToast(`${maison.emoji} ${maison.name} posée gratuitement !`, 'success', 2000);
                this.showTransition();
            });
            container.appendChild(btn);
        });

        this.showModal('modal-free-maison');
    },

    showPickDiscardModal() {
        const player = this.game.pendingAction.player;
        const playable = this.game.discard.filter(c => this.game.canPlayCard(c, player));
        const container = document.getElementById('pick-discard-cards');
        container.innerHTML = '';

        playable.forEach(card => {
            const catInfo = CATEGORIES[card.category] || {};
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${card.emoji} ${card.name}</span><span class="target-score">${catInfo.name || card.category}</span>`;
            btn.addEventListener('click', () => {
                this.game.resolvePickDiscard(card.uid);
                this.hideModal('modal-pick-discard');
                this.showToast(`${card.emoji} ${card.name} récupéré de la défausse !`, 'success', 2000);
                this.showTransition();
            });
            container.appendChild(btn);
        });

        if (playable.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Aucune carte posable dans la défausse.</p>';
        }

        this.showModal('modal-pick-discard');
    },

    showSeeHandsModal() {
        if (Network.isOnline) { this.showOnlineSeeHandsModal(); return; }
        const currentPlayer = this.game.currentPlayer();
        const container = document.getElementById('see-hands-content');
        container.innerHTML = '';

        this.game.players.forEach(p => {
            if (p.index === currentPlayer.index) return;
            const section = document.createElement('div');
            section.style.marginBottom = '1rem';
            section.innerHTML = `<h4 style="color:var(--text-muted);margin-bottom:0.5rem">${p.name} (${p.hand.length} cartes)</h4>`;
            const list = document.createElement('div');
            list.className = 'modal-cards';
            if (p.hand.length === 0) {
                list.innerHTML = '<p style="color:var(--text-muted);text-align:center">Main vide</p>';
            } else {
                p.hand.forEach(card => {
                    const btn = document.createElement('button');
                    btn.className = 'target-item';
                    btn.style.cursor = 'default';
                    const catInfo = CATEGORIES[card.category] || {};
                    btn.innerHTML = `<span class="target-name">${card.emoji} ${card.name}</span><span class="target-score">${catInfo.name || card.category}</span>`;
                    list.appendChild(btn);
                });
            }
            section.appendChild(list);
            container.appendChild(section);
        });

        this.showModal('modal-see-hands');
    },

    showPickSalaireModal() {
        if (Network.isOnline) { this.showOnlinePickSalaireModal(); return; }
        const player = this.game.currentPlayer();
        const salaires = this.game.discard.filter(c => c.category === 'salaire' && this.game.canPlayCard(c, player));
        const container = document.getElementById('pick-salaire-cards');
        container.innerHTML = '';

        salaires.forEach(sal => {
            const salLevel = sal.salaireLevel || sal.level || 1;
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${sal.emoji} ${sal.name}</span><span class="target-score">= ${salLevel} salaire${salLevel > 1 ? 's' : ''}</span>`;
            btn.addEventListener('click', () => {
                const idx = this.game.discard.findIndex(c => c.uid === sal.uid);
                if (idx === -1) return;
                const card = this.game.discard.splice(idx, 1)[0];
                this.game.placeCard(card, player);
                this.hideModal('modal-pick-salaire');
                this.showToast(`${sal.emoji} ${sal.name} récupéré de la défausse !`, 'success', 2000);
                this.renderGame();
            });
            container.appendChild(btn);
        });

        if (salaires.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Aucun salaire posable dans la défausse.</p>';
        }

        this.showModal('modal-pick-salaire');
    },

    showBuyDiscardModal() {
        if (Network.isOnline) { this.showOnlineBuyDiscardModal(); return; }
        const player = this.game.currentPlayer();
        const acquisitions = this.game.discard.filter(c => c.category === 'voyage' || c.category === 'maison');
        const container = document.getElementById('buy-discard-cards');
        container.innerHTML = '';

        acquisitions.forEach(card => {
            let price = card.price || 0;
            if (card.category === 'maison' && player.isMarried()) price = Math.ceil(price / 2);
            const canAfford = this.game.canAfford(player, price);
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.disabled = !canAfford;
            btn.innerHTML = `<span class="target-name">${card.emoji} ${card.name}</span><span class="target-score">💰 ${price}</span>`;
            btn.addEventListener('click', () => {
                if (!canAfford) return;
                const idx = this.game.discard.findIndex(c => c.uid === card.uid);
                if (idx === -1) return;
                const removed = this.game.discard.splice(idx, 1)[0];
                this.hideModal('modal-buy-discard');
                this.game.pendingAction = { type: 'salary_payment', card: removed, price };
                this.game.phase = GamePhase.CHOOSE_SALARY_INVEST;
                this.showSalaryPaymentModal();
            });
            container.appendChild(btn);
        });

        if (acquisitions.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Aucune acquisition dans la défausse.</p>';
        }

        this.showModal('modal-buy-discard');
    },

    showMediumModal() {
        if (Network.isOnline) { this.showOnlineMediumModal(); return; }
        const deck = this.game.deck;
        const cards = deck.slice(0, 13);
        const container = document.getElementById('medium-cards');
        container.innerHTML = '';
        const infoPanel = document.getElementById('medium-info');
        infoPanel.innerHTML = '<p class="medium-info-hint">Clique sur une carte pour voir ses infos</p>';

        cards.forEach((card, i) => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${card.emoji} ${card.name}</span><span class="target-score">${CATEGORIES[card.category]?.name || card.category}</span>`;
            btn.addEventListener('click', () => {
                container.querySelectorAll('.target-item').forEach(b => b.classList.remove('medium-selected'));
                btn.classList.add('medium-selected');
                const catInfo = CATEGORIES[card.category] || {};
                infoPanel.innerHTML = `
                    <div class="medium-info-card" style="background:linear-gradient(145deg, ${catInfo.color || '#666'}, #222)">
                        <span class="medium-info-emoji">${card.emoji}</span>
                        <span class="medium-info-name">${card.name}</span>
                        <span class="medium-info-cat">${catInfo.name || card.category}</span>
                        ${card.smiles > 0 ? `<span class="medium-info-smiles">+${card.smiles} 😊</span>` : ''}
                        ${card.price ? `<span class="medium-info-price">💰 ${card.price}</span>` : ''}
                    </div>
                    <p class="medium-info-desc">${card.description || ''}</p>
                `;
            });
            container.appendChild(btn);
        });

        if (cards.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted)">La pioche est vide.</p>';
        }

        this.showModal('modal-medium');
    },

    showChanceModal() {
        const cards = this.game.pendingAction?.cards || [];
        const container = document.getElementById('chance-cards');
        container.innerHTML = '';
        cards.forEach((card, i) => {
            const el = this.createModalCardElement(card);
            el.addEventListener('click', () => {
                this.hideModal('modal-chance');
                this.game.resolveChance(i);
                this.showToast(`${card.emoji} ${card.name} gardé !`, 'success');
                this.renderGame();
            });
            container.appendChild(el);
        });
        this.showModal('modal-chance');
    },

    showEtoileModal() {
        const container = document.getElementById('etoile-cards');
        container.innerHTML = '';
        const playable = this.game.discard.filter(c => this.game.canPlayCard(c, this.game.currentPlayer()));
        if (playable.length === 0) {
            this.showToast('Aucune carte jouable dans la défausse', 'warning');
            this.game.nextTurn();
            this.showTransition();
            return;
        }
        playable.forEach(card => {
            const el = this.createModalCardElement(card);
            el.addEventListener('click', () => {
                this.hideModal('modal-etoile');
                this.game.resolveEtoile(card.uid);
                this.showToast(`${card.emoji} ${card.name} récupéré !`, 'success');
                this.showTransition();
            });
            container.appendChild(el);
        });
        document.getElementById('btn-cancel-etoile').onclick = () => {
            this.hideModal('modal-etoile');
            this.game.nextTurn();
            this.showTransition();
        };
        this.showModal('modal-etoile');
    },

    showVengeanceModal() {
        const player = this.game.currentPlayer();
        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = 'Vengeance — Choisis un malus';
        player.malusRecus.forEach(malus => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.textContent = `${malus.emoji} ${malus.name}`;
            btn.addEventListener('click', () => { this.hideModal('modal-target'); this.showVengeanceTargetModal(malus); });
            list.appendChild(btn);
        });
        document.getElementById('btn-cancel-target').onclick = () => { this.hideModal('modal-target'); this.game.nextTurn(); this.showTransition(); };
        this.showModal('modal-target');
    },

    showVengeanceTargetModal(malus) {
        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = `Infliger ${malus.name} à...`;
        this.game.players.forEach((p, i) => {
            if (i === this.game.currentPlayerIndex) return;
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.textContent = `${p.name} (${p.getScore()} smiles)`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-target');
                this.game.resolveVengeance(malus.uid, i);
                this.showToast(`Vengeance ! ${malus.name} → ${p.name}`, 'warning');
                this.showTransition();
            });
            list.appendChild(btn);
        });
        this.showModal('modal-target');
    },

    showTrocModal() {
        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = 'Troc — Échange avec...';
        this.game.players.forEach((p, i) => {
            if (i === this.game.currentPlayerIndex || p.hand.length === 0) return;
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.textContent = `${p.name} (${p.hand.length} cartes)`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-target');
                this.game.resolveTroc(i);
                this.showToast(`Troc avec ${p.name} !`, 'info');
                this.showTransition();
            });
            list.appendChild(btn);
        });
        document.getElementById('btn-cancel-target').onclick = () => { this.hideModal('modal-target'); this.game.nextTurn(); this.showTransition(); };
        this.showModal('modal-target');
    },

    // ===== MODAL EVENTS =====
    bindModalEvents() {
        document.getElementById('btn-close-rules').addEventListener('click', () => this.hideModal('modal-rules'));
        document.getElementById('btn-close-detail').addEventListener('click', () => this.hideModal('modal-card-detail'));
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
        });
        document.getElementById('btn-new-game-end').addEventListener('click', () => {
            if (Network.isOnline) { Network.leaveRoom(); } else { this.showScreen('screen-local-config'); }
        });
        document.getElementById('btn-menu-end').addEventListener('click', () => {
            if (Network.isOnline) { Network.leaveRoom(); } else { this.showScreen('screen-home'); }
        });
    },

    // ===== RENDER GAME =====
    renderGame() {
        const game = this.game;
        const player = game.currentPlayer();

        document.getElementById('current-player-name').textContent = player.name;
        document.getElementById('player-score').textContent = `${player.getScore()} smiles`;
        document.getElementById('deck-count').textContent = game.deck.length;
        document.getElementById('discard-count').textContent = game.discard.length;

        const phaseTexts = {
            [GamePhase.DRAW]: 'Pioche une carte',
            [GamePhase.PLAY]: 'Pose ou défausse',
            [GamePhase.ARC_EN_CIEL]: `Arc-en-ciel (${game.arcEnCielRemaining})`,
            [GamePhase.PISTON_PICK]: 'Piston — choisis un métier',
        };
        document.getElementById('game-phase').textContent = phaseTexts[game.phase] || '';

        const isDraw = game.phase === GamePhase.DRAW;
        const isPlay = game.phase === GamePhase.PLAY || game.phase === GamePhase.ARC_EN_CIEL || game.phase === GamePhase.PISTON_PICK;

        document.getElementById('btn-draw').disabled = !isDraw || game.deck.length === 0;
        document.getElementById('btn-take-discard').disabled = !isDraw || game.discard.length === 0;
        document.getElementById('btn-discard').disabled = !isPlay || !this.selectedCardUid;
        document.getElementById('btn-resign').style.display = isDraw && game.canResign(player) ? '' : 'none';
        document.getElementById('btn-divorce').style.display = isDraw && game.canDivorce(player) ? '' : 'none';
        document.getElementById('btn-discard-adultery').style.display = player.isInAdultery() ? '' : 'none';
        const hasMedium = player.board.metier && player.board.metier.advantage === 'medium';
        document.getElementById('btn-medium').style.display = hasMedium ? '' : 'none';
        const hasBuyDiscard = player.board.metier && player.board.metier.advantage === 'buyDiscard';
        document.getElementById('btn-buy-discard').style.display = hasBuyDiscard ? '' : 'none';
        const hasPickSalaire = player.board.metier && player.board.metier.advantage === 'pickSalaire';
        document.getElementById('btn-pick-salaire').style.display = hasPickSalaire ? '' : 'none';
        const hasSeeHands = player.board.metier && player.board.metier.advantage === 'seeHands';
        document.getElementById('btn-see-hands').style.display = hasSeeHands ? '' : 'none';

        const anyoneHasCards = game.players.some(p => p.hand.length > 0);
        if (isDraw && game.deck.length === 0 && game.discard.length === 0 && !anyoneHasCards) {
            game.phase = GamePhase.GAME_OVER;
            this.showGameOver();
            return;
        }

        this.renderBoardNav();
        this.renderPlayerBoard(this.game.players[this.viewedPlayerIndex]);
        this.renderFanHand(player);
    },

    // ===== RENDER BOARD =====
    renderPlayerBoard(player) {
        const boardData = {
            etudes: player.board.etudes,
            metier: player.board.metier ? [player.board.metier] : [],
            salaires: player.board.salaires,
            flirts: [...player.board.flirts, ...(player.board.flirtsAdultere || [])],
            mariage: [
                ...(player.board.mariage ? [player.board.mariage] : []),
                ...(player.board.adultere ? [player.board.adultere] : [])
            ],
            enfants: player.board.enfants,
            animaux: player.board.animaux,
            voyages: player.board.voyages,
            maisons: player.board.maisons,
            distinctions: [...player.board.distinctions, ...player.board.speciales]
        };

        for (const [key, cards] of Object.entries(boardData)) {
            const section = document.querySelector(`.board-section[data-category="${key}"]`);
            if (!section) continue;
            const container = section.querySelector('.board-cards');
            container.innerHTML = '';
            for (const card of cards) {
                const cat = CATEGORIES[card.category] || {};
                const chip = document.createElement('span');
                chip.className = 'board-card';
                if (card.invested) chip.classList.add('invested');
                chip.style.background = cat.color || '#666';
                chip.textContent = card.emoji || '?';
                chip.title = `${card.name}${card.description ? ' — ' + card.description : ''}`;
                chip.addEventListener('click', () => this.showCardDetail(card));
                container.appendChild(chip);
            }
        }

        if (player.malusRecus && player.malusRecus.length > 0) {
            const sec = document.querySelector('.board-section[data-category="distinctions"]');
            if (sec) {
                const c = sec.querySelector('.board-cards');
                for (const malus of player.malusRecus) {
                    const chip = document.createElement('span');
                    chip.className = 'board-card';
                    chip.style.background = CATEGORIES.malus.color;
                    chip.textContent = malus.emoji || '💥';
                    chip.title = malus.name;
                    c.appendChild(chip);
                }
            }
        }
    },

    // ===== FAN HAND =====
    renderFanHand(player) {
        const hand = document.getElementById('player-hand');
        hand.innerHTML = '';
        const cards = player.hand;
        const n = cards.length;
        if (n === 0) return;

        const isPlay = this.game.phase === GamePhase.PLAY || this.game.phase === GamePhase.ARC_EN_CIEL || this.game.phase === GamePhase.PISTON_PICK;

        const arcRadius = 380;
        const totalAngle = Math.min(40, n * 7);
        const angleStep = n > 1 ? totalAngle / (n - 1) : 0;
        const startAngle = -totalAngle / 2;

        cards.forEach((card, i) => {
            const catInfo = CATEGORIES[card.category] || {};
            const el = document.createElement('div');
            el.className = 'fan-card';
            el.style.background = `linear-gradient(145deg, ${catInfo.color || '#666'}, ${this.darken(catInfo.color || '#666')})`;

            const angle = n > 1 ? startAngle + i * angleStep : 0;
            const radians = angle * Math.PI / 180;
            const xOffset = Math.sin(radians) * arcRadius;
            const yOffset = arcRadius - Math.cos(radians) * arcRadius;

            el.style.left = `calc(50% - 39px + ${xOffset}px)`;
            el.style.bottom = `${10 - yOffset}px`;
            el.style.zIndex = i + 1;

            const isSelected = card.uid === this.selectedCardUid;
            const baseTransform = `rotate(${angle}deg)`;
            el.style.transform = isSelected ? `rotate(${angle}deg) translateY(-30px) scale(1.08)` : baseTransform;

            el.addEventListener('mouseenter', () => {
                if (!el.classList.contains('selected')) {
                    el.style.transform = `rotate(${angle}deg) translateY(-18px) scale(1.05)`;
                    el.style.zIndex = 50;
                }
            });
            el.addEventListener('mouseleave', () => {
                if (!el.classList.contains('selected')) {
                    el.style.transform = baseTransform;
                    el.style.zIndex = i + 1;
                }
            });

            const isPlayable = isPlay && (this.game.canPlayCard(card) || (this.game.phase === GamePhase.PISTON_PICK && card.category === 'metier'));
            if (isPlay) {
                if (isPlayable) el.classList.add('playable');
                else el.classList.add('unplayable');
            }
            if (isSelected) el.classList.add('selected');

            let badgeHtml = '';
            if (card.salaryLevel) badgeHtml = `<span class="card-badge">Nv.${card.salaryLevel}</span>`;
            else if (card.price) badgeHtml = `<span class="card-badge">💰${card.price}</span>`;

            el.innerHTML = `
                <span class="card-emoji">${card.emoji || '?'}</span>
                <span class="card-name">${card.name}</span>
                <span class="card-smiles">${card.smiles > 0 ? '+' + card.smiles + ' 😊' : ''}</span>
                ${badgeHtml}
            `;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedCardUid === card.uid) {
                    if (isPlay && isPlayable) {
                        this.closePreview();
                        this.handlePlayCard(card);
                    }
                    return;
                }
                this.selectedCardUid = card.uid;
                this.openPreview(card);
                this.renderFanHand(player);
            });

            hand.appendChild(el);
        });

        document.getElementById('btn-discard').disabled = !isPlay || !this.selectedCardUid;
    },

    // ===== CARD ELEMENTS FOR MODALS =====
    createModalCardElement(card) {
        const catInfo = CATEGORIES[card.category] || {};
        const div = document.createElement('div');
        div.className = 'fan-card';
        div.style.position = 'relative';
        div.style.background = `linear-gradient(145deg, ${catInfo.color || '#666'}, ${this.darken(catInfo.color || '#666')})`;
        let badgeHtml = '';
        if (card.salaryLevel) badgeHtml = `<span class="card-badge">Nv.${card.salaryLevel}</span>`;
        else if (card.price) badgeHtml = `<span class="card-badge">💰${card.price}</span>`;
        div.innerHTML = `
            <span class="card-emoji">${card.emoji || '?'}</span>
            <span class="card-name">${card.name}</span>
            <span class="card-smiles">${card.smiles > 0 ? '+' + card.smiles + ' 😊' : ''}</span>
            ${badgeHtml}
        `;
        return div;
    },

    darken(hex) {
        const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
        const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
        const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
        return `rgb(${r},${g},${b})`;
    },

    showCardDetail(card) {
        const container = document.getElementById('card-detail-display');
        const catInfo = CATEGORIES[card.category] || {};
        container.style.background = `linear-gradient(145deg, ${catInfo.color || '#666'}, ${this.darken(catInfo.color || '#666')})`;
        container.innerHTML = `
            <div style="font-size:3rem;margin-bottom:0.5rem">${card.emoji || '?'}</div>
            <div style="font-size:1.2rem;font-weight:800">${card.name}</div>
            <div style="font-size:0.85rem;color:rgba(255,255,255,0.7);margin-top:0.3rem">${catInfo.name || card.category}</div>
            ${card.smiles > 0 ? `<div style="font-size:1rem;font-weight:800;color:var(--gold);margin-top:0.5rem">+${card.smiles} 😊</div>` : ''}
            ${card.description ? `<div style="font-size:0.85rem;color:rgba(255,255,255,0.9);margin-top:0.8rem;line-height:1.4">${card.description}</div>` : ''}
        `;
        this.showModal('modal-card-detail');
    },

    // ===== GAME OVER =====
    showGameOver() {
        const rankings = Network.isOnline ? this.getOnlineRankings() : this.game.getRankings();
        const container = document.getElementById('final-scores');
        container.innerHTML = '';
        const medals = ['🥇', '🥈', '🥉'];
        rankings.forEach((entry, i) => {
            const row = document.createElement('div');
            row.className = `final-score-row ${i === 0 ? 'winner' : ''}`;
            row.innerHTML = `
                <span class="final-score-name">${medals[i] || `${i + 1}.`} ${entry.player?.name || entry.name}</span>
                <span class="final-score-smiles">${entry.score} 😊</span>
            `;
            container.appendChild(row);
        });
        this.showScreen('screen-gameover');
    },

    getOnlineRankings() {
        if (!this.onlineState) return [];
        return [...this.onlineState.players]
            .map(p => ({ name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score);
    },

    // ===== ONLINE GAME RENDERING =====

    renderOnlineGame(state, myIndex) {
        if (state.phase === 'game_over') {
            this.showGameOver();
            return;
        }

        const me = state.players[myIndex];
        const currentPlayer = state.players[state.currentPlayerIndex];
        const isMyTurn = state.currentPlayerIndex === myIndex;

        document.getElementById('current-player-name').textContent =
            isMyTurn ? `${me.name} (toi)` : currentPlayer.name;
        document.getElementById('player-score').textContent = `${me.score} smiles`;
        document.getElementById('deck-count').textContent = state.deckCount;
        document.getElementById('discard-count').textContent = state.discardCount;

        const phaseTexts = {
            'draw': isMyTurn ? 'Pioche une carte' : `${currentPlayer.name} pioche...`,
            'play': isMyTurn ? 'Pose ou défausse' : `${currentPlayer.name} joue...`,
            'arc_en_ciel': isMyTurn ? `Arc-en-ciel (${state.arcEnCielRemaining})` : `${currentPlayer.name} joue Arc-en-ciel`,
            'piston_pick': isMyTurn ? 'Piston — choisis un métier' : `${currentPlayer.name} choisit un métier`,
            'choose_target': isMyTurn ? 'Choisis une cible' : `${currentPlayer.name} choisit...`,
            'choose_salary': isMyTurn ? 'Paie avec tes salaires' : `${currentPlayer.name} paie...`,
            'chance_pick': isMyTurn ? 'Choisis une carte' : `${currentPlayer.name} choisit...`,
            'etoile_pick': isMyTurn ? 'Étoile — choisis une carte' : `${currentPlayer.name} choisit...`,
            'troc_pick': isMyTurn ? 'Troc — choisis un joueur' : `${currentPlayer.name} choisit...`,
            'vengeance_pick': isMyTurn ? 'Vengeance — choisis un malus' : `${currentPlayer.name} choisit...`,
        };
        document.getElementById('game-phase').textContent = phaseTexts[state.phase] || '';

        const isDraw = state.phase === 'draw' && isMyTurn;
        const isPlay = isMyTurn && (state.phase === 'play' || state.phase === 'arc_en_ciel' || state.phase === 'piston_pick');

        document.getElementById('btn-draw').disabled = !isDraw || state.deckCount === 0;
        document.getElementById('btn-take-discard').disabled = !isDraw || state.discardCount === 0;
        document.getElementById('btn-discard').disabled = !isPlay || !this.selectedCardUid;
        document.getElementById('btn-resign').style.display = isDraw && me.board.metier ? '' : 'none';
        document.getElementById('btn-divorce').style.display = isDraw && me.board.mariage && !(me.board.metier && me.board.metier.advantage === 'cantDivorce') ? '' : 'none';
        document.getElementById('btn-discard-adultery').style.display = me.board.adultere ? '' : 'none';

        const hasMedium = me.board.metier && me.board.metier.advantage === 'medium';
        document.getElementById('btn-medium').style.display = hasMedium ? '' : 'none';
        const hasBuyDiscard = me.board.metier && me.board.metier.advantage === 'buyDiscard';
        document.getElementById('btn-buy-discard').style.display = hasBuyDiscard ? '' : 'none';
        const hasPickSalaire = me.board.metier && me.board.metier.advantage === 'pickSalaire';
        document.getElementById('btn-pick-salaire').style.display = hasPickSalaire ? '' : 'none';
        const hasSeeHands = me.board.metier && me.board.metier.advantage === 'seeHands';
        document.getElementById('btn-see-hands').style.display = hasSeeHands ? '' : 'none';

        this.renderOnlineBoardNav(state, myIndex);
        this.renderOnlinePlayerBoard(state.players[this.viewedPlayerIndex]);
        this.renderOnlineFanHand(me, state, isPlay);

        // Auto-show modals for pending actions
        if (isMyTurn && state.pendingAction) {
            if (state.phase === 'choose_target' && state.pendingAction.type === 'malus') {
                const targets = getValidMalusTargetsFromState(state);
                if (targets.length > 0 && !document.getElementById('modal-target').classList.contains('active')) {
                    this.showOnlineTargetModal(targets);
                }
            }
            if (state.phase === 'choose_salary') {
                if (!document.getElementById('modal-target').classList.contains('active')) {
                    this.showOnlineSalaryModal(state.pendingAction.price);
                }
            }
            if (state.pendingAction.type === 'freeMaison') {
                if (!document.getElementById('modal-free-maison').classList.contains('active')) {
                    this.showOnlineFreeMaisonModal(me);
                }
            }
            if (state.pendingAction.type === 'pickDiscard') {
                if (!document.getElementById('modal-pick-discard').classList.contains('active')) {
                    this.showOnlinePickDiscardModal(state);
                }
            }
        }
        if (isMyTurn && state.phase === 'etoile_pick') {
            if (!document.getElementById('modal-etoile').classList.contains('active')) {
                this.showOnlineEtoileModal(state);
            }
        }
        if (isMyTurn && state.phase === 'troc_pick') {
            if (!document.getElementById('modal-target').classList.contains('active')) {
                this.showOnlineTrocModal(state, myIndex);
            }
        }
        if (isMyTurn && state.phase === 'vengeance_pick') {
            if (!document.getElementById('modal-target').classList.contains('active')) {
                this.showOnlineVengeanceModal(state, myIndex);
            }
        }
    },

    renderOnlineBoardNav(state, myIndex) {
        const tabs = document.getElementById('board-nav-tabs');
        tabs.innerHTML = '';
        state.players.forEach((p, i) => {
            const btn = document.createElement('button');
            btn.className = 'board-nav-tab';
            if (i === this.viewedPlayerIndex) btn.classList.add('active');
            if (i === state.currentPlayerIndex) btn.classList.add('is-current');
            const label = i === myIndex ? `${p.name} (moi)` : p.name;
            btn.innerHTML = `${label} <span class="tab-score">${p.score}😊</span>`;
            btn.addEventListener('click', () => {
                this.viewedPlayerIndex = i;
                this.renderOnlineBoardNav(state, myIndex);
                this.renderOnlinePlayerBoard(state.players[i]);
            });
            tabs.appendChild(btn);
        });
    },

    renderOnlinePlayerBoard(player) {
        const boardData = {
            etudes: player.board.etudes,
            metier: player.board.metier ? [player.board.metier] : [],
            salaires: player.board.salaires,
            flirts: [...player.board.flirts, ...(player.board.flirtsAdultere || [])],
            mariage: [
                ...(player.board.mariage ? [player.board.mariage] : []),
                ...(player.board.adultere ? [player.board.adultere] : [])
            ],
            enfants: player.board.enfants,
            animaux: player.board.animaux,
            voyages: player.board.voyages,
            maisons: player.board.maisons,
            distinctions: [...player.board.distinctions, ...player.board.speciales]
        };

        for (const [key, cards] of Object.entries(boardData)) {
            const section = document.querySelector(`.board-section[data-category="${key}"]`);
            if (!section) continue;
            const container = section.querySelector('.board-cards');
            container.innerHTML = '';
            for (const card of cards) {
                const cat = CATEGORIES[card.category] || {};
                const chip = document.createElement('span');
                chip.className = 'board-card';
                if (card.invested) chip.classList.add('invested');
                chip.style.background = cat.color || '#666';
                chip.textContent = card.emoji || '?';
                chip.title = `${card.name}${card.description ? ' — ' + card.description : ''}`;
                chip.addEventListener('click', () => this.showCardDetail(card));
                container.appendChild(chip);
            }
        }
    },

    renderOnlineFanHand(me, state, isPlay) {
        const hand = document.getElementById('player-hand');
        hand.innerHTML = '';
        const cards = me.hand || [];
        const n = cards.length;
        if (n === 0) {
            hand.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px">Main vide</div>';
            return;
        }

        const arcRadius = 380;
        const totalAngle = Math.min(40, n * 7);
        const angleStep = n > 1 ? totalAngle / (n - 1) : 0;
        const startAngle = -totalAngle / 2;

        cards.forEach((card, i) => {
            const catInfo = CATEGORIES[card.category] || {};
            const el = document.createElement('div');
            el.className = 'fan-card';
            el.style.background = `linear-gradient(145deg, ${catInfo.color || '#666'}, ${this.darken(catInfo.color || '#666')})`;

            const angle = n > 1 ? startAngle + i * angleStep : 0;
            const radians = angle * Math.PI / 180;
            const xOffset = Math.sin(radians) * arcRadius;
            const yOffset = arcRadius - Math.cos(radians) * arcRadius;

            el.style.left = `calc(50% - 39px + ${xOffset}px)`;
            el.style.bottom = `${10 - yOffset}px`;
            el.style.zIndex = i + 1;

            const isSelected = card.uid === this.selectedCardUid;
            const baseTransform = `rotate(${angle}deg)`;
            el.style.transform = isSelected ? `rotate(${angle}deg) translateY(-30px) scale(1.08)` : baseTransform;

            el.addEventListener('mouseenter', () => {
                if (!el.classList.contains('selected')) {
                    el.style.transform = `rotate(${angle}deg) translateY(-18px) scale(1.05)`;
                    el.style.zIndex = 50;
                }
            });
            el.addEventListener('mouseleave', () => {
                if (!el.classList.contains('selected')) {
                    el.style.transform = baseTransform;
                    el.style.zIndex = i + 1;
                }
            });

            if (isPlay) {
                el.classList.add('playable');
            }
            if (isSelected) el.classList.add('selected');

            let badgeHtml = '';
            if (card.salaryLevel) badgeHtml = `<span class="card-badge">Nv.${card.salaryLevel}</span>`;
            else if (card.price) badgeHtml = `<span class="card-badge">💰${card.price}</span>`;

            el.innerHTML = `
                <span class="card-emoji">${card.emoji || '?'}</span>
                <span class="card-name">${card.name}</span>
                <span class="card-smiles">${card.smiles > 0 ? '+' + card.smiles + ' 😊' : ''}</span>
                ${badgeHtml}
            `;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedCardUid === card.uid) {
                    if (isPlay) {
                        this.closePreview();
                        Network.playCard(card.uid);
                        this.selectedCardUid = null;
                    }
                    return;
                }
                this.selectedCardUid = card.uid;
                this.openPreview(card, !isPlay);
                this.renderOnlineFanHand(me, state, isPlay);
            });

            hand.appendChild(el);
        });

        document.getElementById('btn-discard').disabled = !isPlay || !this.selectedCardUid;
    },

    // ===== ONLINE MODALS =====

    showOnlineTargetModal(targets) {
        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = 'Choisir une cible';
        targets.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${t.name}</span>`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-target');
                Network.selectTarget(t.index);
            });
            list.appendChild(btn);
        });
        document.getElementById('btn-cancel-target').onclick = () => {
            this.hideModal('modal-target');
            Network.cancelAction();
        };
        this.showModal('modal-target');
    },

    showOnlineSalaryModal(price) {
        const me = this.onlineState.players[this.onlinePlayerIndex];
        const salaries = me.board.salaires.filter(s => !s.invested);
        const selected = new Set();

        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = `Payer ${price} salaire${price > 1 ? 's' : ''}`;

        const totalLine = document.createElement('div');
        totalLine.style.cssText = 'text-align:center; padding:8px 0; font-size:1.1em; color:var(--text-muted, #aaa);';
        list.appendChild(totalLine);

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn-primary';
        confirmBtn.style.cssText = 'width:100%; margin-top:8px; padding:12px; font-size:1.05em;';
        confirmBtn.textContent = 'Confirmer le paiement';
        confirmBtn.disabled = true;

        const updateTotal = () => {
            let total = 0;
            for (const uid of selected) {
                const s = salaries.find(x => x.uid === uid);
                if (s) total += s.salaireLevel || s.level || 1;
            }
            totalLine.textContent = `Sélectionné : ${total} / ${price}`;
            confirmBtn.disabled = total < price;
            confirmBtn.style.opacity = total < price ? '0.4' : '1';
        };

        salaries.forEach(sal => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            const salLevel = sal.salaireLevel || sal.level || 1;
            btn.innerHTML = `<span class="target-name">${sal.emoji} ${sal.name}</span><span class="target-score">= ${salLevel}</span>`;
            btn.addEventListener('click', () => {
                if (selected.has(sal.uid)) {
                    selected.delete(sal.uid);
                    btn.style.outline = '';
                    btn.style.background = '';
                } else {
                    selected.add(sal.uid);
                    btn.style.outline = '2px solid var(--accent-green, #2ecc71)';
                    btn.style.background = 'rgba(46, 204, 113, 0.15)';
                }
                updateTotal();
            });
            list.appendChild(btn);
        });

        list.appendChild(confirmBtn);
        updateTotal();

        confirmBtn.addEventListener('click', () => {
            if (confirmBtn.disabled) return;
            this.hideModal('modal-target');
            Network.salaryPayment([...selected]);
        });

        document.getElementById('btn-cancel-target').onclick = () => {
            this.hideModal('modal-target');
            Network.cancelAction();
        };
        this.showModal('modal-target');
    },

    showOnlineChanceModal(cards) {
        const container = document.getElementById('chance-cards');
        container.innerHTML = '';
        cards.forEach((card, i) => {
            const el = this.createModalCardElement(card);
            el.addEventListener('click', () => {
                this.hideModal('modal-chance');
                Network.chancePick(i);
            });
            container.appendChild(el);
        });
        this.showModal('modal-chance');
    },

    showOnlineFreeMaisonModal(me) {
        const maisons = (me.hand || []).filter(c => c.category === 'maison');
        const container = document.getElementById('free-maison-cards');
        container.innerHTML = '';
        maisons.forEach(maison => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${maison.emoji} ${maison.name}</span><span class="target-score">+${maison.smiles} 😊</span>`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-free-maison');
                Network.freeMaison(maison.uid);
            });
            container.appendChild(btn);
        });
        document.getElementById('btn-skip-free-maison').onclick = () => {
            this.hideModal('modal-free-maison');
            Network.freeMaison(null);
        };
        this.showModal('modal-free-maison');
    },

    showOnlinePickDiscardModal(state) {
        const container = document.getElementById('pick-discard-cards');
        container.innerHTML = '';
        const playable = (state.discard || []).filter(c => c.category !== 'malus');
        playable.forEach(card => {
            const catInfo = CATEGORIES[card.category] || {};
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${card.emoji} ${card.name}</span><span class="target-score">${catInfo.name || card.category}</span>`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-pick-discard');
                Network.pickDiscard(card.uid);
            });
            container.appendChild(btn);
        });
        document.getElementById('btn-skip-pick-discard').onclick = () => {
            this.hideModal('modal-pick-discard');
            Network.pickDiscard(null);
        };
        this.showModal('modal-pick-discard');
    },

    showOnlineEtoileModal(state) {
        const container = document.getElementById('etoile-cards');
        container.innerHTML = '';
        (state.discard || []).forEach(card => {
            const el = this.createModalCardElement(card);
            el.addEventListener('click', () => {
                this.hideModal('modal-etoile');
                Network.etoilePick(card.uid);
            });
            container.appendChild(el);
        });
        document.getElementById('btn-cancel-etoile').onclick = () => {
            this.hideModal('modal-etoile');
            Network.etoilePick(null);
        };
        this.showModal('modal-etoile');
    },

    showOnlineTrocModal(state, myIndex) {
        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = 'Troc — Échange avec...';
        state.players.forEach((p, i) => {
            if (i === myIndex || p.handCount === 0) return;
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.textContent = `${p.name} (${p.handCount} cartes)`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-target');
                Network.trocPick(i);
            });
            list.appendChild(btn);
        });
        document.getElementById('btn-cancel-target').onclick = () => {
            this.hideModal('modal-target');
        };
        this.showModal('modal-target');
    },

    showOnlineVengeanceModal(state, myIndex) {
        const me = state.players[myIndex];
        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = 'Vengeance — Choisis un malus';
        me.malusRecus.forEach(malus => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.textContent = `${malus.emoji} ${malus.name}`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-target');
                this.showOnlineVengeanceTargetModal(state, myIndex, malus);
            });
            list.appendChild(btn);
        });
        this.showModal('modal-target');
    },

    showOnlineVengeanceTargetModal(state, myIndex, malus) {
        const list = document.getElementById('target-list');
        list.innerHTML = '';
        document.getElementById('modal-target-title').textContent = `Infliger ${malus.name} à...`;
        state.players.forEach((p, i) => {
            if (i === myIndex) return;
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.textContent = `${p.name} (${p.score} smiles)`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-target');
                Network.vengeancePick(malus.uid, i);
            });
            list.appendChild(btn);
        });
        this.showModal('modal-target');
    },

    // ===== ONLINE ABILITY MODALS =====

    showOnlineSeeHandsModal() {
        const state = this.onlineState;
        const container = document.getElementById('see-hands-content');
        container.innerHTML = '';
        state.players.forEach((p, i) => {
            if (i === this.onlinePlayerIndex) return;
            const section = document.createElement('div');
            section.style.marginBottom = '1rem';
            const hand = p.hand || [];
            section.innerHTML = `<h4 style="color:var(--text-muted);margin-bottom:0.5rem">${p.name} (${hand.length || p.handCount || 0} cartes)</h4>`;
            const list = document.createElement('div');
            list.className = 'modal-cards';
            if (hand.length === 0) {
                list.innerHTML = '<p style="color:var(--text-muted);text-align:center">Main non visible</p>';
            } else {
                hand.forEach(card => {
                    const btn = document.createElement('button');
                    btn.className = 'target-item';
                    btn.style.cursor = 'default';
                    const catInfo = CATEGORIES[card.category] || {};
                    btn.innerHTML = `<span class="target-name">${card.emoji} ${card.name}</span><span class="target-score">${catInfo.name || card.category}</span>`;
                    list.appendChild(btn);
                });
            }
            section.appendChild(list);
            container.appendChild(section);
        });
        this.showModal('modal-see-hands');
    },

    showOnlinePickSalaireModal() {
        const state = this.onlineState;
        const discardCards = state.discard || [];
        const salaires = discardCards.filter(c => c.category === 'salaire');
        const container = document.getElementById('pick-salaire-cards');
        container.innerHTML = '';
        salaires.forEach(sal => {
            const salLevel = sal.salaireLevel || sal.level || 1;
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${sal.emoji} ${sal.name}</span><span class="target-score">= ${salLevel}</span>`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-pick-salaire');
                Network.pickSalaire(sal.uid);
            });
            container.appendChild(btn);
        });
        if (salaires.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Aucun salaire dans la défausse.</p>';
        }
        this.showModal('modal-pick-salaire');
    },

    showOnlineBuyDiscardModal() {
        const state = this.onlineState;
        const discardCards = state.discard || [];
        const acquisitions = discardCards.filter(c => c.category === 'voyage' || c.category === 'maison');
        const container = document.getElementById('buy-discard-cards');
        container.innerHTML = '';
        acquisitions.forEach(card => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${card.emoji} ${card.name}</span><span class="target-score">💰 ${card.price || 0}</span>`;
            btn.addEventListener('click', () => {
                this.hideModal('modal-buy-discard');
                Network.buyDiscard(card.uid);
            });
            container.appendChild(btn);
        });
        if (acquisitions.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Aucune acquisition dans la défausse.</p>';
        }
        this.showModal('modal-buy-discard');
    },

    showOnlineMediumModal() {
        const state = this.onlineState;
        const cards = state.deckTop13 || [];
        const container = document.getElementById('medium-cards');
        container.innerHTML = '';
        const infoPanel = document.getElementById('medium-info');
        infoPanel.innerHTML = '<p class="medium-info-hint">Clique sur une carte pour voir ses infos</p>';
        cards.forEach((card, i) => {
            const btn = document.createElement('button');
            btn.className = 'target-item';
            btn.innerHTML = `<span class="target-name">${card.emoji} ${card.name}</span><span class="target-score">${CATEGORIES[card.category]?.name || card.category}</span>`;
            btn.addEventListener('click', () => {
                container.querySelectorAll('.target-item').forEach(b => b.classList.remove('medium-selected'));
                btn.classList.add('medium-selected');
                const catInfo = CATEGORIES[card.category] || {};
                infoPanel.innerHTML = `
                    <div class="medium-info-card" style="background:linear-gradient(145deg, ${catInfo.color || '#666'}, #222)">
                        <span class="medium-info-emoji">${card.emoji}</span>
                        <span class="medium-info-name">${card.name}</span>
                        <span class="medium-info-cat">${catInfo.name || card.category}</span>
                        ${card.smiles > 0 ? `<span class="medium-info-smiles">+${card.smiles} 😊</span>` : ''}
                        ${card.price ? `<span class="medium-info-price">💰 ${card.price}</span>` : ''}
                    </div>
                    <p class="medium-info-desc">${card.description || ''}</p>
                `;
            });
            container.appendChild(btn);
        });
        if (cards.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Aucune carte visible.</p>';
        }
        this.showModal('modal-medium');
    }
};

function getValidMalusTargetsFromState(state) {
    return state.players.filter((p, i) => i !== state.currentPlayerIndex).map(p => ({ index: p.index, name: p.name }));
}

document.addEventListener('DOMContentLoaded', () => UI.init());
