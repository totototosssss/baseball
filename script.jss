document.addEventListener('DOMContentLoaded', () => {

    // --- DOM要素の取得 ---
    const elements = {
        ball: document.getElementById('ball'),
        batter: document.getElementById('batter'),
        pitcher: document.getElementById('pitcher'),
        messageBox: document.getElementById('message-box'),
        sboLights: {
            strikes: [document.getElementById('strike1'), document.getElementById('strike2')],
            balls: [document.getElementById('ball1'), document.getElementById('ball2'), document.getElementById('ball3')],
            outs: [document.getElementById('out1'), document.getElementById('out2')]
        },
        runners: [document.getElementById('runner1'), document.getElementById('runner2'), document.getElementById('runner3')],
        inningDisplay: document.getElementById('inning-display'),
        homeScoreDisplay: document.querySelector('#home-score span'),
        awayScoreDisplay: document.querySelector('#away-score span'),
        resetButton: document.getElementById('reset-button'),
        gameContainer: document.getElementById('game-container')
    };

    // --- ゲーム設定 ---
    const config = {
        totalInnings: 3,
        pitchSpeed: 800, // ms
        swingWindow: { good: 100, bad: 200 }, // ms from perfect timing
    };

    // --- ゲーム状態管理 ---
    let state = {};

    function initializeState() {
        state = {
            gameStatus: 'ready', // ready, pitching, swinging, result, gameOver
            score: { home: 0, away: 0 },
            inning: 1,
            isTopInning: true,
            outs: 0,
            strikes: 0,
            balls: 0,
            bases: [false, false, false], // 1塁, 2塁, 3塁
            pitchStartTime: 0,
            pitchTimeoutId: null,
        };
    }

    // --- UI更新関数 ---
    function updateUI() {
        // スコアボード
        elements.homeScoreDisplay.textContent = state.score.home;
        elements.awayScoreDisplay.textContent = state.score.away;
        elements.inningDisplay.textContent = `${state.inning}回${state.isTopInning ? '表' : '裏'}`;

        // SBOカウント
        updateSBO('strikes', state.strikes);
        updateSBO('balls', state.balls);
        updateSBO('outs', state.outs);

        // ランナー
        state.bases.forEach((hasRunner, i) => {
            elements.runners[i].classList.toggle('on', hasRunner);
        });
    }

    function updateSBO(type, count) {
        elements.sboLights[type].forEach((light, i) => {
            light.classList.toggle('on', i < count);
        });
    }

    function showMessage(msg, duration = 2000) {
        elements.messageBox.textContent = msg;
        if (msg.includes('ホームラン')) {
            elements.messageBox.classList.add('hit-effect');
            setTimeout(() => elements.messageBox.classList.remove('hit-effect'), 300);
        }
    }


    // --- ゲームフロー関数 ---
    function startGame() {
        initializeState();
        updateUI();
        elements.resetButton.classList.add('hidden');
        showMessage('プレイボール！');
        setTimeout(readyToPitch, 2000);
    }

    function readyToPitch() {
        state.gameStatus = 'pitching';
        elements.ball.style.transition = 'none';
        elements.ball.style.display = 'block';
        elements.ball.style.transform = `translate(235px, 240px) scale(0.8)`; // ピッチャーの位置

        setTimeout(pitch, 500);
    }

    function pitch() {
        showMessage('...');
        state.pitchStartTime = performance.now();
        elements.ball.style.transition = `transform ${config.pitchSpeed}ms cubic-bezier(0.5, 0, 1, 0.5)`;
        elements.ball.style.transform = `translate(235px, 420px) scale(1.2)`; // ホームベースへ

        state.pitchTimeoutId = setTimeout(() => judge('miss'), config.pitchSpeed);
    }

    function swing() {
        if (state.gameStatus !== 'pitching') return;
        
        clearTimeout(state.pitchTimeoutId);
        state.gameStatus = 'swinging';

        elements.batter.classList.add('swing');
        setTimeout(() => elements.batter.classList.remove('swing'), 150);

        const swingTime = performance.now();
        const pitchDuration = swingTime - state.pitchStartTime;
        const timingDiff = Math.abs(pitchDuration - (config.pitchSpeed - 100)); // -100msはインパクトのタイミング調整

        judge('swing', timingDiff);
    }

    function judge(action, timingDiff = null) {
        state.gameStatus = 'result';

        if (action === 'miss') {
            showMessage('ストライク！');
            handleStrike();
            return;
        }

        if (timingDiff <= config.swingWindow.good) {
            handleHit(4); // ホームラン
        } else if (timingDiff <= config.swingWindow.bad) {
            const hitType = Math.floor(Math.random() * 3) + 1; // 1:単打, 2:二塁打, 3:三塁打
            handleHit(hitType);
        } else {
            showMessage('空振り！');
            handleStrike();
        }
    }

    function handleHit(baseHit) {
        const hitMessages = ["", "ヒット！", "ツーベース！", "スリーベース！", "ホームラン！ 🚀"];
        showMessage(hitMessages[baseHit]);
        
        // 打球アニメーション
        const angle = (Math.random() - 0.5) * Math.PI / 2; // -45 to 45 degrees
        const distance = 300 + Math.random() * 100;
        const x = Math.sin(angle) * distance;
        const y = -Math.cos(angle) * distance;
        elements.ball.style.transition = `transform 1.5s ease-out`;
        elements.ball.style.transform = `translate(${235 + x}px, ${420 + y}px) scale(0)`;
        
        // 進塁処理
        let runnersScored = 0;
        let newBases = [...state.bases];
        
        // 打者走者
        let batterBase = baseHit;
        
        // 塁上の走者
        for (let i = 2; i >= 0; i--) {
            if (newBases[i]) {
                newBases[i] = false;
                if (i + baseHit >= 3) {
                    runnersScored++;
                } else {
                    newBases[i + baseHit] = true;
                }
            }
        }
        
        // 打者走者の最終塁
        if (batterBase === 4) {
            runnersScored++;
        } else {
            newBases[batterBase - 1] = true;
        }
        
        state.bases = newBases;
        state.score.home += runnersScored;

        resetCount();
        setTimeout(readyToPitch, 2000);
    }

    function handleStrike() {
        state.strikes++;
        if (state.strikes === 3) {
            showMessage('三振！バッターアウト！');
            handleOut();
        } else {
            setTimeout(readyToPitch, 2000);
        }
    }
    
    function handleWalk() {
        showMessage('フォアボール！');
        
        let newBases = [...state.bases];
        if(newBases[0] && newBases[1] && newBases[2]) { // 満塁
             state.score.home++;
        } else if (newBases[0] && newBases[1]) { // 1,2塁
            newBases[2] = true;
        } else if (newBases[0]) { // 1塁
            newBases[1] = true;
        }
        newBases[0] = true;
        state.bases = newBases;
        
        resetCount();
        setTimeout(readyToPitch, 2000);
    }

    function handleOut() {
        state.outs++;
        if (state.outs === 3) {
            changeSides();
        } else {
            resetCount();
            setTimeout(readyToPitch, 2000);
        }
    }

    function resetCount() {
        state.strikes = 0;
        state.balls = 0;
        updateUI();
    }

    function changeSides() {
        showMessage('チェンジ！');
        state.outs = 0;
        state.strikes = 0;
        state.balls = 0;
        state.bases = [false, false, false];

        if (!state.isTopInning) { // 裏が終わったら
            state.inning++;
        }
        state.isTopInning = !state.isTopInning;

        if (state.inning > config.totalInnings) {
            gameOver();
        } else {
            updateUI();
            setTimeout(readyToPitch, 2000);
        }
    }
    
    function gameOver() {
        state.gameStatus = 'gameOver';
        let finalMessage = "ゲームセット！";
        if (state.score.home > state.score.away) {
            finalMessage += ` ${state.score.home}対${state.score.away}であなたの勝ち！`;
        } else if (state.score.home < state.score.away) {
            finalMessage += ` ${state.score.home}対${state.score.away}であなたの負け...`;
        } else {
            finalMessage += ` ${state.score.home}対${state.score.away}、引き分けです。`;
        }
        showMessage(finalMessage);
        elements.resetButton.classList.remove('hidden');
    }


    // --- イベントリスナー ---
    elements.gameContainer.addEventListener('click', () => {
        if (state.gameStatus === 'pitching') {
            swing();
        } else if (state.gameStatus === 'ready') {
            startGame();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            if (state.gameStatus === 'pitching') {
                swing();
            } else if (state.gameStatus === 'ready') {
                startGame();
            }
        }
    });
    
    elements.resetButton.addEventListener('click', startGame);

    // --- 初期化 ---
    initializeState();
    updateUI();
});
