document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        mainTitle: document.getElementById('main-title'),
        settingsArea: document.getElementById('settings-area'),
        menuArea: document.querySelector('.menu-area'),
        difficultyBtns: document.querySelectorAll('#difficulty button'),
        reverseModeBtn: document.getElementById('reverse-mode'),
        colorModeBtn: document.getElementById('color-mode'),
        oneByOneModeBtn: document.getElementById('one-by-one-mode'),
        fullscreenBtn: document.getElementById('fullscreen-btn'),
        startBtn: document.getElementById('start-btn'),
        gameArea: document.querySelector('.game-area'),
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
        actionsContainer: document.querySelector('.actions-container'),
        replayBtn: document.getElementById('replay-btn'),
        hintBtn: document.getElementById('hint-btn'),
        restartBtn: document.getElementById('restart-btn'),
    };

    const HIGH_SCORE_KEY = 'numericMemoryHighScore';
    
    let sounds = {};
    let oneByOneInterval = null;

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
        hard: { length: 10, time: 10000, inputTime: 15000 },
        expert: { length: 15, time: 12000, inputTime: 30000 },
    };
    
    function updateToggleButtonVisuals(button, isActive) {
        button.textContent = isActive ? 'ON' : 'OFF';
        button.classList.remove('on', 'off');
        button.classList.add(isActive ? 'on' : 'off');
    }

    function setupEventListeners() {
        elements.difficultyBtns.forEach(btn => btn.addEventListener('click', () => {
            if (gameState.gameInProgress) return;
            elements.difficultyBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.difficulty = btn.dataset.value;
        }));

        const setupToggleButton = (button, key) => {
            button.addEventListener('click', () => {
                if (gameState.gameInProgress) return;
                gameState[key] = !gameState[key];
                updateToggleButtonVisuals(button, gameState[key]);
            });
        };

        setupToggleButton(elements.reverseModeBtn, 'reverseMode');
        setupToggleButton(elements.colorModeBtn, 'colorMode');
        setupToggleButton(elements.oneByOneModeBtn, 'oneByOneMode');
        
        elements.startBtn.addEventListener('click', async () => {
            if (gameState.gameInProgress) return;
            
            gameState.lives = gameState.initialLives;
            gameState.streak = 0;
            gameState.hints = 0;
            updateStats();

            await startGame();
        });

        elements.keypad.addEventListener('click', handleKeypadClick);
        elements.hintBtn.addEventListener('click', useHint);
        elements.replayBtn.addEventListener('click', handleReplayRequest);
        elements.restartBtn.addEventListener('click', resetToPreGame);
        
        elements.sequenceDisplay.addEventListener('click', () => {
            if (!gameState.gameInProgress && elements.gameArea.classList.contains('game-over')) {
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
            }
            elements.keypad.appendChild(btn);
        });
    }
    
    function showView(view) {
        elements.menuArea.style.display = 'none';
        elements.gameArea.style.display = 'none';

        if (view === 'pre-game') {
            elements.menuArea.style.display = 'block';
        } else if (view === 'game') {
            elements.gameArea.style.display = 'flex';
        }
    }

    function resetToPreGame() {
        clearTimeout(gameState.inputTimerId);
        clearInterval(oneByOneInterval);
        gameState.gameInProgress = false; 
        showView('pre-game');
        elements.gameArea.classList.remove('game-over');
        elements.sequenceDisplay.innerHTML = '';
        
        gameState.lives = gameState.initialLives;
        gameState.streak = 0;
        gameState.hints = 0;
        updateStats();
    }

    async function startGame() {
        await Tone.start();
        
        sounds = {
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

        gameState.gameInProgress = true;
        sounds.start();
        
        showView('game');
        elements.gameArea.classList.remove('game-over');
        elements.sequenceDisplay.style.display = 'flex';
        elements.timerContainer.style.display = 'block';
        elements.statsContainer.style.display = 'flex';
        elements.feedbackEl.style.display = 'block';
        
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
        clearInterval(oneByOneInterval);
        elements.inputArea.style.display = 'none';
        elements.sequenceDisplay.style.display = 'flex';
        elements.sequenceDisplay.innerHTML = '';
        elements.feedbackEl.textContent = 'Memoriza...';
        elements.feedbackEl.className = 'feedback info';
        
        if (gameState.oneByOneMode) displayOneByOne();
        else displayAllAtOnce();
        
        startTimer(gameState.displayTime);
        setTimeout(hideSequence, gameState.displayTime);
    }
    
    function hideSequence() {
        if (!gameState.gameInProgress) return;

        elements.sequenceDisplay.style.display = 'none';
        elements.inputArea.style.display = 'block';
        elements.feedbackEl.textContent = gameState.reverseMode ? 'Introduce la secuencia en orden INVERSO.' : 'Introduce la secuencia.';
        elements.feedbackEl.className = 'feedback info';

        const inputTime = difficultySettings[gameState.difficulty].inputTime;
        startTimer(inputTime);
        clearTimeout(gameState.inputTimerId);
        gameState.inputTimerId = setTimeout(() => handleWrongAnswer(true), inputTime);
    }

    function handleKeypadClick(e) {
        const button = e.target.closest('button');
        if (!button || !gameState.gameInProgress) return;

        const key = button.dataset.key;
        const action = button.dataset.action;

        if (key) {
            const num = parseInt(key, 10);
            if (sounds.keypad) sounds.keypad(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'][num]);
            gameState.playerSequence.push(num);
            updatePlayerSequenceDisplay();
        } else if (action === 'backspace') {
            if (sounds.backspace) sounds.backspace();
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
        if (sounds.success) sounds.success();
        gameState.streak++;
        if (gameState.streak > gameState.maxScore) {
            gameState.maxScore = gameState.streak;
            saveMaxScore();
        }
        if (gameState.streak > 0 && gameState.streak % 5 === 0) {
            gameState.hints++;
            if(sounds.gainHint) sounds.gainHint();
        }
        updateStats();
        elements.feedbackEl.textContent = '¡Correcto!';
        elements.feedbackEl.className = 'feedback success';
        elements.playerSequenceDisplay.style.backgroundColor = 'var(--success-color)';
        
        setTimeout(() => {
            if (!gameState.gameInProgress) return;
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
            if (sounds.loseLife) sounds.loseLife();
            const livesText = gameState.lives === 1 ? '1 vida' : `${gameState.lives} vidas`;
            elements.feedbackEl.textContent = isTimeout 
                ? `¡Se acabó el tiempo! Te quedan ${livesText}.`
                : `Incorrecto. Te quedan ${livesText}. ¡Inténtalo de nuevo!`;
            elements.feedbackEl.className = 'feedback error';
            
            setTimeout(() => {
                if (!gameState.gameInProgress) return;
                gameState.playerSequence = [];
                updatePlayerSequenceDisplay();
                elements.playerSequenceDisplay.style.backgroundColor = 'var(--bg-color)';
                hideSequence();
            }, 1500);

        } else {
            if (sounds.error) sounds.error();
            const correctSequence = (gameState.reverseMode ? [...gameState.currentSequence].reverse() : gameState.currentSequence).join(' ');
            
            gameState.gameInProgress = false;
            
            elements.sequenceDisplay.style.display = 'flex';
            elements.inputArea.style.display = 'none';
            elements.timerContainer.style.display = 'none';
            elements.statsContainer.style.display = 'none';
            elements.feedbackEl.style.display = 'none';
            elements.gameArea.classList.add('game-over');
            
            elements.sequenceDisplay.innerHTML = `
                <div class="game-over-text">
                    <div class="game-over-title">Game Over</div>
                    <div class="game-over-subtitle">Secuencia correcta:</div>
                    <div class="game-over-sequence">${correctSequence}</div>
                    <div class="game-over-restart">Reiniciar</div>
                </div>
            `;
        }
    }
    
    function useHint() {
        if(gameState.hints <= 0 || !gameState.gameInProgress || gameState.playerSequence.length >= gameState.currentSequence.length) return;
        
        if (sounds.useHint) sounds.useHint();
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
        if (sounds.replay) sounds.replay();

        elements.inputArea.style.display = 'none';
        elements.sequenceDisplay.style.display = 'flex';
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
        updateToggleButtonVisuals(elements.fullscreenBtn, isFullscreen);
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
    
    function updatePlayerSequenceDisplay() { 
        if (gameState.playerSequence.length > 0) {
            elements.playerSequenceDisplay.textContent = gameState.playerSequence.join(' ');
        } else {
            elements.playerSequenceDisplay.textContent = '...';
        }
    }
   
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
        const sequenceHTML = gameState.currentSequence.map(num => {
            const color = getRandomColor();
            const numberColor = gameState.colorMode ? color : 'var(--text-color)';
            return `
                <div class="number-box">
                    <span style="color: ${numberColor};">${num}</span>
                </div>
            `;
        }).join('');
        elements.sequenceDisplay.innerHTML = sequenceHTML;
    }

    function displayOneByOne() {
        const sequenceHTML = gameState.currentSequence.map(num => {
            const color = getRandomColor();
            const numberColor = gameState.colorMode ? color : 'var(--text-color)';
            return `
                <div class="number-box" style="visibility: hidden;">
                    <span style="color: ${numberColor};">${num}</span>
                </div>
            `;
        }).join('');
        elements.sequenceDisplay.innerHTML = sequenceHTML;

        const boxes = elements.sequenceDisplay.querySelectorAll('.number-box');
        let i = 0;
        const intervalTime = Math.min(800, gameState.displayTime / gameState.sequenceLength);
        
        oneByOneInterval = setInterval(() => {
            if (i < boxes.length) {
                boxes[i].style.visibility = 'visible';
                i++;
            } else {
                clearInterval(oneByOneInterval);
            }
        }, intervalTime);
    }

    function getRandomColor() {
        const colors = ['#42a8f8', '#ffc800', '#ff004d', '#00e436'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function initializeGame() {
        createKeypad();
        setupEventListeners();
        loadMaxScore(); 
        resetToPreGame();

        updateToggleButtonVisuals(elements.reverseModeBtn, gameState.reverseMode);
        updateToggleButtonVisuals(elements.colorModeBtn, gameState.colorMode);
        updateToggleButtonVisuals(elements.oneByOneModeBtn, gameState.oneByOneMode);
        updateFullscreenButton();
    }

    initializeGame();
});
