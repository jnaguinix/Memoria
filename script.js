document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        mainTitle: document.getElementById('main-title'),
        settingsArea: document.getElementById('settings-area'),
        difficultyBtns: document.querySelectorAll('#difficulty button'),
        reverseModeBtn: document.getElementById('reverse-mode'),
        colorModeBtn: document.getElementById('color-mode'),
        oneByOneModeBtn: document.getElementById('one-by-one-mode'),
        fullscreenBtn: document.getElementById('fullscreen-btn'),
        startBtn: document.getElementById('start-btn'),
        gameInfo: document.querySelector('.game-info'),
        displayArea: document.getElementById('display-area'),
        sequenceDisplay: document.getElementById('sequence-display'),
        timerContainer: document.getElementById('timer-container'),
        timerBar: document.getElementById('timer-bar'),
        inputArea: document.getElementById('input-area'),
        keypad: document.getElementById('keypad'),
        playerSequenceDisplay: document.getElementById('player-sequence-display'),
        feedbackEl: document.getElementById('feedback'),
        statsContainer: document.getElementById('stats-container'),
        streakCounter: document.getElementById('streak-counter'),
        maxScoreCounter: document.getElementById('max-score-counter'),
        livesContainer: document.getElementById('lives-container'),
        replayBtn: document.getElementById('replay-btn'),
        hintBtn: document.getElementById('hint-btn'),
        hintCounter: document.getElementById('hint-counter'),
    };

    const HIGH_SCORE_KEY = 'numericMemoryHighScore';

    const gameState = {
        difficulty: 'easy',
        reverseMode: false,
        colorMode: false,
        oneByOneMode: false,
        currentSequence: [],
        playerSequence: [],
        sequenceLength: 6,
        displayTime: 5000,
        inputTimerId: null,
        streak: 0,
        maxScore: 0,
        gameInProgress: false,
        initialLives: 4,
        lives: 4,
        hints: 0,
    };

    const difficultySettings = {
        easy: { length: 6, time: 5000, inputTime: 10000 },
        hard: { length: 10, time: 5000, inputTime: 15000 },
        expert: { length: 15, time: 5000, inputTime: 30000 },
    };
    
    const sounds = {
        mainSynth: new Tone.Synth().toDestination(),
        keypadSynth: new Tone.Synth().toDestination(),
        hintSynth: new Tone.PolySynth(Tone.Synth).toDestination(),

        success: () => sounds.mainSynth.triggerAttackRelease("C5", "8n", Tone.now()),
        error: () => sounds.mainSynth.triggerAttackRelease("C3", "8n", Tone.now()),
        start: () => {
            const now = Tone.now();
            sounds.mainSynth.triggerAttackRelease("C4", "8n", now);
            sounds.mainSynth.triggerAttackRelease("G4", "8n", now + 0.2);
        },
        keypad: (note) => sounds.keypadSynth.triggerAttackRelease(note, "16n"),
        backspace: () => sounds.keypadSynth.triggerAttackRelease("C3", "16n"),
        loseLife: () => sounds.mainSynth.triggerAttackRelease("E3", "8n", Tone.now()),
        gainHint: () => {
            const now = Tone.now();
            sounds.hintSynth.triggerAttackRelease("A5", "16n", now);
            sounds.hintSynth.triggerAttackRelease("E6", "16n", now + 0.1);
        },
        useHint: () => sounds.mainSynth.triggerAttackRelease("G5", "8n", Tone.now()),
        replay: () => sounds.mainSynth.triggerAttackRelease("A3", "8n", Tone.now()),
    };

    function setupEventListeners() {
        elements.difficultyBtns.forEach(btn => btn.addEventListener('click', () => {
            if (gameState.gameInProgress) return;
            elements.difficultyBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.difficulty = btn.dataset.value;
        }));

        const setupToggleButton = (button, key) => button.addEventListener('click', () => {
            if (gameState.gameInProgress) return;
            gameState[key] = !gameState[key];
            button.textContent = gameState[key] ? 'Activado' : 'Desactivado';
            button.classList.toggle('active', gameState[key]);
        });

        setupToggleButton(elements.reverseModeBtn, 'reverseMode');
        setupToggleButton(elements.colorModeBtn, 'colorMode');
        setupToggleButton(elements.oneByOneModeBtn, 'oneByOneMode');
        
        elements.startBtn.addEventListener('click', () => {
            if (gameState.gameInProgress) return;
            
            gameState.lives = gameState.initialLives;
            gameState.streak = 0;
            gameState.hints = 0;
            updateStats();

            startGame();
        });

        elements.keypad.addEventListener('click', handleKeypadClick);
        elements.hintBtn.addEventListener('click', useHint);
        elements.replayBtn.addEventListener('click', handleReplayRequest);
        
        elements.displayArea.addEventListener('click', () => {
            if (!gameState.gameInProgress && elements.displayArea.classList.contains('game-over')) {
                resetToPreGame();
            }
        });

        elements.fullscreenBtn.addEventListener('click', toggleFullScreen);
        document.addEventListener('fullscreenchange', updateFullscreenButton);
        document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
        document.addEventListener('mozfullscreenchange', updateFullscreenButton);
        document.addEventListener('MSFullscreenChange', updateFullscreenButton);
    }
    
    function createKeypad() {
        elements.keypad.innerHTML = '';
        const keypadLayout = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'backspace', 0];
        
        keypadLayout.forEach(key => {
            const btn = document.createElement('button');
            if (typeof key === 'number') {
                btn.textContent = key;
                btn.dataset.key = key;
            } else if (key === 'backspace') {
                btn.innerHTML = '&#9003;';
                btn.dataset.action = 'backspace';
                btn.classList.add('action-btn');
            }
            elements.keypad.appendChild(btn);
        });
    }
    
    function showView(view) {
        elements.mainTitle.style.display = 'none';
        elements.settingsArea.style.display = 'none';
        elements.startBtn.style.display = 'none';
        elements.gameInfo.style.display = 'none';
        elements.displayArea.style.display = 'none';
        elements.timerContainer.style.display = 'none';
        elements.inputArea.style.display = 'none';
        elements.feedbackEl.style.display = 'none';
        elements.statsContainer.style.display = 'none';

        if (view === 'pre-game') {
            elements.mainTitle.style.display = 'block';
            elements.settingsArea.style.display = 'block';
            elements.startBtn.style.display = 'block';
        } else if (view === 'game') {
            elements.gameInfo.style.display = 'flex';
            elements.statsContainer.style.display = 'flex';
            elements.feedbackEl.style.display = 'block';
        }
    }

    function resetToPreGame() {
        showView('pre-game');
        elements.displayArea.classList.remove('game-over');
        
        gameState.lives = gameState.initialLives;
        gameState.streak = 0;
        gameState.hints = 0;
        updateStats();
    }

    function startGame() {
        gameState.gameInProgress = true;
        sounds.start();
        
        showView('game');
        elements.displayArea.style.display = 'flex'; 
        elements.displayArea.classList.remove('game-over');
        
        gameState.playerSequence = [];
        updatePlayerSequenceDisplay();
        elements.feedbackEl.className = 'feedback';
        elements.feedbackEl.textContent = '';
        
        gameState.sequenceLength = difficultySettings[gameState.difficulty].length + Math.floor(gameState.streak / 3);
        gameState.displayTime = Math.max(1500, difficultySettings[gameState.difficulty].time - (gameState.streak * 100));

        generateSequence();
        displaySequence();
    }

    function generateSequence() {
        gameState.currentSequence = Array.from({ length: gameState.sequenceLength }, () => Math.floor(Math.random() * 10));
    }

    function displaySequence() {
        elements.inputArea.style.display = 'none';
        elements.displayArea.style.display = 'flex';
        elements.sequenceDisplay.innerHTML = '';
        elements.feedbackEl.textContent = 'Memoriza...';
        elements.feedbackEl.className = 'feedback info';
        
        if (gameState.oneByOneMode) displayOneByOne();
        else displayAllAtOnce();
        
        startTimer(gameState.displayTime);
        setTimeout(hideSequence, gameState.displayTime);
    }
    
    function hideSequence() {
        elements.displayArea.style.display = 'none';
        elements.inputArea.style.display = 'block';
        elements.feedbackEl.textContent = gameState.reverseMode ? 'Introduce la secuencia en orden INVERSO.' : 'Introduce la secuencia.';
        elements.feedbackEl.className = 'feedback info';

        const inputTime = difficultySettings[gameState.difficulty].inputTime;
        startTimer(inputTime);
        clearTimeout(gameState.inputTimerId);
        gameState.inputTimerId = setTimeout(() => handleWrongAnswer(true), inputTime);
    }

    function handleKeypadClick(e) {
        if (!e.target.matches('button') || !gameState.gameInProgress) return;

        const key = e.target.dataset.key;
        const action = e.target.dataset.action;

        if (key) {
            const num = parseInt(key, 10);
            sounds.keypad(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'][num]);
            gameState.playerSequence.push(num);
            updatePlayerSequenceDisplay();
        } else if (action === 'backspace') {
            sounds.backspace();
            gameState.playerSequence.pop();
            updatePlayerSequenceDisplay();
        }

        if (gameState.playerSequence.length === gameState.currentSequence.length) {
            checkAnswer();
        }
    }
    
    function checkAnswer() {
        clearTimeout(gameState.inputTimerId);
        const expected = gameState.reverseMode ? [...gameState.currentSequence].reverse() : gameState.currentSequence;
        const correct = gameState.playerSequence.every((val, index) => val === expected[index]);
        
        if (correct) handleCorrectAnswer();
        else handleWrongAnswer(false);
    }

    function handleCorrectAnswer() {
        sounds.success();
        gameState.streak++;
        if (gameState.streak > gameState.maxScore) {
            gameState.maxScore = gameState.streak;
            saveMaxScore();
        }
        if (gameState.streak > 0 && gameState.streak % 5 === 0) {
            gameState.hints++;
        }
        updateStats();
        elements.feedbackEl.textContent = '¡Correcto!';
        elements.feedbackEl.className = 'feedback success';
        elements.playerSequenceDisplay.style.backgroundColor = 'var(--success-color)';
        
        setTimeout(() => {
            elements.playerSequenceDisplay.style.backgroundColor = 'var(--bg-color)';
            startGame();
        }, 1200);
    }

    function handleWrongAnswer(isTimeout = false) {
        clearTimeout(gameState.inputTimerId);
        gameState.lives--;
        updateLivesDisplay();
        elements.playerSequenceDisplay.style.backgroundColor = 'var(--error-color)';
        elements.playerSequenceDisplay.classList.add('shake');
        setTimeout(() => elements.playerSequenceDisplay.classList.remove('shake'), 500);

        if (gameState.lives > 0) {
            sounds.loseLife();
            const livesText = gameState.lives === 1 ? '1 vida' : `${gameState.lives} vidas`;
            elements.feedbackEl.textContent = isTimeout 
                ? `¡Se acabó el tiempo! Te quedan ${livesText}.`
                : `Incorrecto. Te quedan ${livesText}. ¡Inténtalo de nuevo!`;
            elements.feedbackEl.className = 'feedback error';
            setTimeout(() => {
                gameState.playerSequence = [];
                updatePlayerSequenceDisplay();
                elements.playerSequenceDisplay.style.backgroundColor = 'var(--bg-color)';
            }, 1200);
        } else {
            sounds.error();
            const correctSequence = (gameState.reverseMode ? [...gameState.currentSequence].reverse() : gameState.currentSequence).join(' ');
            
            gameState.gameInProgress = false;
            
            showView('game-over');
            elements.displayArea.style.display = 'flex';
            elements.displayArea.classList.add('game-over');
            const reason = isTimeout ? 'Se acabó el tiempo' : 'Fin del juego';
            elements.sequenceDisplay.innerHTML = `${reason} <br><small style="font-size: 1rem;">La secuencia era: ${correctSequence}</small><br><small style="font-size: 0.8rem; opacity: 0.7;">Haz clic para reiniciar</small>`;
        }
    }
    
    function useHint() {
        if(gameState.hints <= 0 || !gameState.gameInProgress || gameState.playerSequence.length >= gameState.currentSequence.length) return;
        
        sounds.useHint();
        gameState.hints--;
        updateStats();
        
        const expected = gameState.reverseMode ? [...gameState.currentSequence].reverse() : gameState.currentSequence;
        const nextNumber = expected[gameState.playerSequence.length];
        
        gameState.playerSequence.push(nextNumber);
        updatePlayerSequenceDisplay();

        if (gameState.playerSequence.length === gameState.currentSequence.length) {
            checkAnswer();
        }
    }

    function handleReplayRequest() {
        if (!gameState.gameInProgress || gameState.lives <= 1) return;

        clearTimeout(gameState.inputTimerId);
        gameState.lives--;
        updateLivesDisplay();
        sounds.replay();

        elements.inputArea.style.display = 'none';
        elements.displayArea.style.display = 'flex';
        displaySequence();
    }

    function toggleFullScreen() {
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.msRequestFullscreen) {
                document.documentElement.msRequestFullscreen();
            } else if (document.documentElement.mozRequestFullScreen) {
                document.documentElement.mozRequestFullScreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    function updateFullscreenButton() {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        elements.fullscreenBtn.textContent = isFullscreen ? 'Salir' : 'Activar';
        elements.fullscreenBtn.classList.toggle('active', isFullscreen);
    }

    function saveMaxScore() {
        localStorage.setItem(HIGH_SCORE_KEY, gameState.maxScore);
    }

    function loadMaxScore() {
        const storedScore = localStorage.getItem(HIGH_SCORE_KEY);
        if (storedScore) {
            gameState.maxScore = parseInt(storedScore, 10);
        }
    }

    function updateStats() {
        elements.streakCounter.textContent = gameState.streak;
        elements.maxScoreCounter.textContent = gameState.maxScore;
        elements.hintBtn.textContent = `Pista (x${gameState.hints})`;
        updateLivesDisplay();
    }
    function updateLivesDisplay() {
        elements.livesContainer.innerHTML = '';
        for(let i = 0; i < gameState.initialLives; i++) {
            const heart = document.createElement('span');
            heart.textContent = '♥';
            if (i >= gameState.lives) heart.style.opacity = '0.2';
            elements.livesContainer.appendChild(heart);
        }
    }
    
    function updatePlayerSequenceDisplay() { elements.playerSequenceDisplay.textContent = gameState.playerSequence.join(' ') || '...'; }
   
    function startTimer(duration) {
        elements.timerContainer.style.display = 'block';
        elements.timerContainer.classList.add('visible');
        elements.timerBar.style.transition = 'none';
        elements.timerBar.style.transform = 'scaleX(1)';
        elements.timerBar.offsetHeight; 
        elements.timerBar.style.transition = `transform ${duration / 1000}s linear`;
        elements.timerBar.style.transform = 'scaleX(0)';
    }
    function displayAllAtOnce() {
        const sequenceHTML = gameState.currentSequence.map(num => `<span style="color: ${gameState.colorMode ? getRandomColor() : 'var(--text-color)'};">${num}</span>`).join('');
        elements.sequenceDisplay.innerHTML = sequenceHTML;
    }
    function displayOneByOne() {
        let i = 0;
        const intervalTime = Math.min(800, gameState.displayTime / gameState.sequenceLength);
        const interval = setInterval(() => {
            if (i < gameState.currentSequence.length) {
                const num = gameState.currentSequence[i];
                elements.sequenceDisplay.innerHTML = `<span style="color: ${gameState.colorMode ? getRandomColor() : 'var(--text-color)'};">${num}</span>`;
                i++;
            } else {
                clearInterval(interval);
            }
        }, intervalTime);
    }
    function getRandomColor() {
        const colors = ['#38BDF8', '#FBBF24', '#EC4899', '#818CF8', '#34D399'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function initializeGame() {
        createKeypad();
        setupEventListeners();
        loadMaxScore(); 
        resetToPreGame();
    }

    initializeGame();
});