// js/inputHandler.js

let gamepad = null; // 現在検出されているゲームパッドのオブジェクト
let animationFrameId = null; // requestAnimationFrame のID

// フォーカス可能なUI要素を管理する変数
let focusableElements = [];
let currentFocusIndex = -1; // 現在フォーカスされている要素のインデックス

// ゲームパッド接続/切断イベントリスナー
window.addEventListener("gamepadconnected", (e) => {
    console.log("ゲームパッドが接続されました:", e.gamepad.id);
    gamepad = e.gamepad;
    // 接続されたらポーリング開始
    if (!animationFrameId) {
        pollGamepads();
    }
    // 接続時にUI要素リストを更新し、最初の要素にフォーカス
    updateFocusableElements();
    if (focusableElements.length > 0) {
        setFocus(0);
    }
});

window.addEventListener("gamepaddisconnected", (e) => {
    console.log("ゲームパッドが切断されました:", e.gamepad.id);
    gamepad = null;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    // フォーカスを解除
    removeFocus();
});

// ゲームパッドの状態を継続的にポーリングする関数
function pollGamepads() {
    if (!gamepad) {
        // ゲームパッドが切断された場合は、新しいゲームパッドを検出するために getGamepads を呼ぶ
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i].connected) {
                gamepad = gamepads[i];
                console.log("切断後、ゲームパッドを再検出:", gamepad.id);
                break;
            }
        }
        if (!gamepad) {
            animationFrameId = null;
            return; // 接続されたゲームパッドがなければポーリング停止
        }
    }

    // ゲームパッドの状態を更新 (重要！)
    gamepad = navigator.getGamepads()[gamepad.index]; // 最新の状態を取得

    // ボタンの処理
    handleButtons();

    // スティックの処理 (スライダー調整用)
    handleAxes();

    animationFrameId = requestAnimationFrame(pollGamepads);
}

// ボタン入力処理
let lastButtonStates = {}; // 前回のボタン状態を保存

function handleButtons() {
    if (!gamepad) return;

    gamepad.buttons.forEach((button, i) => {
        // ボタンが「押された瞬間」を検出 (前回の状態と比較)
        if (button.pressed && !lastButtonStates[i]) {
            // ここでどのボタンが押されたかに応じて処理を分岐
            switch (i) {
                // 例: ゲームパッドのAボタン (XInputなら0番、DualShockならXまたは○)
                case 0: // Aボタン/〇ボタン (決定ボタンとして使用)
                    handleSelectButton();
                    break;
                // 例: ゲームパッドのBボタン (XInputなら1番、DualShockなら〇または△)
                case 1: // Bボタン/✕ボタン (戻る/閉じるボタンとして使用)
                case 2: // Xボタン/□ボタン (別の戻るボタンとして使用することも)
                    handleBackButton();
                    break;
                // 十字キー上: 12, 十字キー下: 13, 十字キー左: 14, 十字キー右: 15
                case 12: // 十字キー上
                    handleDirectionalInput('up');
                    break;
                case 13: // 十字キー下
                    handleDirectionalInput('down');
                    break;
                case 14: // 十字キー左
                    handleDirectionalInput('left');
                    break;
                case 15: // 十字キー右
                    handleDirectionalInput('right');
                    break;
                // 他のボタンも必要に応じて追加
                // case 9: // Startボタン (例: 再生/一時停止)
                //     // audioHandler.togglePlayPauseAudio(); // main.jsから渡された参照があれば呼び出し
                //     break;
            }
        }
        lastButtonStates[i] = button.pressed; // 現在の状態を保存
    });
}

// アナログスティック入力処理 (スライダー調整にも使える)
let lastAxesStates = {}; // 前回の軸の状態を保存

function handleAxes() {
    if (!gamepad) return;

    gamepad.axes.forEach((axisValue, i) => {
        // スティックのデッドゾーンを設定 (わずかな傾きを無視)
        const deadZone = 0.1;
        const sensitivity = 0.05; // 軸の移動を検出する感度

        // X軸 (左右) の入力 (左スティック: 0, 右スティック: 2)
        if (i === 0 || i === 2) {
            if (Math.abs(axisValue) > deadZone) {
                // 軸が一定量以上動いた、または方向が変わった
                if (Math.sign(axisValue) !== Math.sign(lastAxesStates[i] || 0) || Math.abs(axisValue - (lastAxesStates[i] || 0)) > sensitivity) {
                    handleSliderAdjustment(axisValue > 0 ? 'right' : 'left', axisValue);
                }
            } else if (Math.abs(lastAxesStates[i] || 0) > deadZone) { // スティックがデッドゾーンに戻った
                 handleSliderAdjustment('stop', axisValue); // スライダー調整を停止
            }
        }
        // Y軸 (上下) の入力 (左スティック: 1, 右スティック: 3)
        if (i === 1 || i === 3) {
            if (Math.abs(axisValue) > deadZone) {
                // 軸が一定量以上動いた、または方向が変わった
                if (Math.sign(axisValue) !== Math.sign(lastAxesStates[i] || 0) || Math.abs(axisValue - (lastAxesStates[i] || 0)) > sensitivity) {
                    handleSliderAdjustment(axisValue > 0 ? 'down' : 'up', axisValue);
                }
            } else if (Math.abs(lastAxesStates[i] || 0) > deadZone) {
                 handleSliderAdjustment('stop', axisValue);
            }
        }
        lastAxesStates[i] = axisValue;
    });
}


// --- UIフォーカスと操作ロジック ---

// フォーカス可能な要素を更新する関数
// プレイヤーのUIが動的に変化する場合（例：パネルの表示/非表示）は、適宜呼び出す必要があります。
export function updateFocusableElements() { // export して main.js などから呼び出せるようにする
    // プレイヤー内のすべてのボタン、入力フィールド、スライダーなどを選択
    // 注意: hiddenな要素は含めないようにする
    const allCandidates = document.querySelectorAll(
        '.player-container button:not([disabled]):not(.hidden), ' +
        '.player-container input:not([disabled]):not(.hidden), ' +
        '#equalizerPanel button:not([disabled]):not(.hidden), ' +
        '#equalizerPanel input:not([disabled]):not(.hidden), ' +
        '#tonePanel button:not([disabled]):not(.hidden), ' +
        '#tonePanel input:not([disabled]):not(.hidden), ' +
        '#ambiencePanel button:not([disabled]):not(.hidden), ' +
        '#ambiencePanel input:not([disabled]):not(.hidden), ' +
        '#vocalCutPanel button:not([disabled]):not(.hidden), ' +
        '#vocalCutPanel input[type="checkbox"]:not([disabled]):not(.hidden), ' + // チェックボックスを明示
        '#albumArt.cursor-pointer:not(.hidden)' // アルバムアートもフォーカス可能にする
    );

    // 現在表示されている要素のみをフィルタリング
    focusableElements = Array.from(allCandidates).filter(el => {
        // offsetParent が null でない = 要素が描画されている
        // CSSのdisplay:none や visibility:hidden の要素は offsetParent が null になる
        return el.offsetParent !== null;
    });

    // ソート (例: 上から下、左から右の順にソート)
    focusableElements.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        // まずY座標でソート (上にあるものが先)
        if (rectA.top !== rectB.top) {
            return rectA.top - rectB.top;
        }
        // Y座標がほぼ同じならX座標でソート (左にあるものが先)
        return rectA.left - rectB.left;
    });

    // 現在フォーカスしている要素がまだリストにあるか確認し、あればインデックスを更新
    if (currentFocusIndex !== -1 && focusableElements[currentFocusIndex] && !focusableElements.includes(focusableElements[currentFocusIndex])) {
        removeFocus(); // 以前の要素が非表示になったらフォーカス解除
        currentFocusIndex = -1;
    }
}

// フォーカスを設定する関数
function setFocus(index) {
    if (currentFocusIndex !== -1 && focusableElements[currentFocusIndex]) {
        removeFocus();
    }

    if (index >= 0 && index < focusableElements.length) {
        currentFocusIndex = index;
        const targetElement = focusableElements[currentFocusIndex];
        targetElement.classList.add('gamepad-focused'); // CSSでハイライト
        targetElement.focus(); // キーボードフォーカスも設定 (アクセシビリティのため)

        // 必要に応じて、フォーカスされた要素が画面内に収まるようにスクロール
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        currentFocusIndex = -1; // フォーカスなし
    }
}

// フォーカスを解除する関数
function removeFocus() {
    if (currentFocusIndex !== -1 && focusableElements[currentFocusIndex]) {
        focusableElements[currentFocusIndex].classList.remove('gamepad-focused');
        focusableElements[currentFocusIndex].blur(); // キーボードフォーカスを解除
    }
    currentFocusIndex = -1;
}

// 方向入力のハンドラ (十字キーやスティック)
function handleDirectionalInput(direction) {
    // まず、フォーカス可能な要素リストが最新であることを確認
    updateFocusableElements();

    if (focusableElements.length === 0) return; // 操作できる要素がない

    let nextIndex = currentFocusIndex;
    let currentElement = focusableElements[currentFocusIndex];

    if (currentFocusIndex === -1 || !currentElement) { // まだフォーカスされていない場合
        setFocus(0); // 最初の要素にフォーカス
        return;
    }

    const currentRect = currentElement.getBoundingClientRect();
    let bestCandidate = null;
    let minDistance = Infinity;

    // フォーカス移動のロジック（隣接要素を幾何学的に計算する）
    focusableElements.forEach((el, index) => {
        if (index === currentFocusIndex) return; // 自分自身は候補から除外

        const rect = el.getBoundingClientRect();
        let isCandidate = false;
        let distance = Infinity;

        switch (direction) {
            case 'up':
                // 上方向にある要素
                if (rect.bottom <= currentRect.top) { // 完全に上にあるか、わずかに重なる
                    isCandidate = true;
                    distance = currentRect.top - rect.bottom; // 上からの距離
                }
                break;
            case 'down':
                // 下方向にある要素
                if (rect.top >= currentRect.bottom) { // 完全に下にあるか、わずかに重なる
                    isCandidate = true;
                    distance = rect.top - currentRect.bottom; // 下からの距離
                }
                break;
            case 'left':
                // 左方向にある要素
                if (rect.right <= currentRect.left) { // 完全に左にあるか、わずかに重なる
                    isCandidate = true;
                    distance = currentRect.left - rect.right; // 左からの距離
                }
                break;
            case 'right':
                // 右方向にある要素
                if (rect.left >= currentRect.right) { // 完全に右にあるか、わずかに重なる
                    isCandidate = true;
                    distance = rect.left - currentRect.right; // 右からの距離
                }
                break;
        }

        if (isCandidate) {
            // X軸またはY軸の重なりを考慮 (重要: 同じ行/列にいるかを判断)
            const overlapX = Math.max(0, Math.min(currentRect.right, rect.right) - Math.max(currentRect.left, rect.left));
            const overlapY = Math.max(0, Math.min(currentRect.bottom, rect.bottom) - Math.max(currentRect.top, rect.top));

            // 重なりが全くない場合はスコアを低くする
            if (direction === 'up' || direction === 'down') {
                if (overlapX <= 0) distance += 1000; // X軸の重なりがないと遠くなる
            } else { // left || right
                if (overlapY <= 0) distance += 1000; // Y軸の重なりがないと遠くなる
            }

            if (distance < minDistance) {
                minDistance = distance;
                bestCandidate = el;
            }
        }
    });

    if (bestCandidate) {
        nextIndex = focusableElements.indexOf(bestCandidate);
    } else {
        // 最適な候補が見つからない場合（行/列の端など）は、単純なインデックス移動をフォールバックとして使用
        // これはあくまでフォールバックなので、UIレイアウトによっては完璧ではない
        if (direction === 'up') nextIndex = (currentFocusIndex === 0) ? focusableElements.length - 1 : currentFocusIndex - 1;
        if (direction === 'down') nextIndex = (currentFocusIndex === focusableElements.length - 1) ? 0 : currentFocusIndex + 1;
        // 左右のフォールバックは、このレイアウトでは上下と同じになる可能性が高い
        // 複雑なUIの場合、左右移動のフォールバックは慎重に設計する必要がある
    }

    if (nextIndex !== currentFocusIndex) {
        setFocus(nextIndex);
    }
}


// 選択ボタンが押されたときの処理
function handleSelectButton() {
    if (currentFocusIndex !== -1 && focusableElements[currentFocusIndex]) {
        const targetElement = focusableElements[currentFocusIndex];
        
        // スライダーの場合はクリックではなく、値調整をアクティブにする
        if (targetElement.type === 'range') {
            // スライダーの「つまみ」にフォーカスを当てたかのような視覚効果
            targetElement.classList.add('gamepad-slider-active'); 
            // スライダーにフォーカスがある状態で決定ボタンを押した場合は、
            // その後の左右入力でスライダーを調整できるよう、特別なモードに入るなど考慮が必要だが、
            // ここではクリック処理のみ。
            // 必要に応じて、ここではスライダー調整を開始するフラグを立てるなど、
            // さらに複雑なロジックを実装できる
        } else if (targetElement.type === 'checkbox') { // チェックボックスの場合
            targetElement.checked = !targetElement.checked; // チェックを切り替える
            const event = new Event('change', { bubbles: true }); // changeイベントを発火
            targetElement.dispatchEvent(event);
        }
        else {
            // 通常のボタンやinput[type="file"]の場合はクリックイベントを発生させる
            targetElement.click();
        }

        // 特別な要素の処理 (例: パネルが開閉されたらフォーカス要素を再更新)
        // パネルを開くボタンが押された場合
        if (targetElement.id === 'toggleEqBtn' || targetElement.id === 'toggleToneBtn' ||
            targetElement.id === 'toggleAmbienceBtn' || targetElement.id === 'toggleVocalCutBtn') {
            // パネルが開いた後、少し待ってからフォーカス可能な要素を再取得
            // 新しいパネル内の要素にフォーカスを移すことも検討
            setTimeout(() => {
                updateFocusableElements();
                // 開いたパネル内の最初の要素にフォーカスを移すロジック
                // 例: document.getElementById('equalizerPanel')がhiddenでないか確認し、その中の最初のinputなどに移す
                const openedPanel = document.getElementById(targetElement.dataset.panelId || '').classList.contains('hidden') ? null : document.getElementById(targetElement.dataset.panelId);
                if (openedPanel) {
                    const firstFocusableInPanel = openedPanel.querySelector('button:not([disabled]):not(.hidden), input:not([disabled]):not(.hidden)');
                    if (firstFocusableInPanel) {
                        setFocus(focusableElements.indexOf(firstFocusableInPanel));
                    }
                }
            }, 300); // UIアニメーションを考慮して少し遅延
        }
    }
}

// スライダー調整のハンドラ
let sliderAdjustmentInterval = null; // スライダー連続調整用インターバルID
let currentSlider = null; // 現在調整中のスライダー

function handleSliderAdjustment(direction, axisValue) {
    if (currentFocusIndex === -1 || !focusableElements[currentFocusIndex]) return;

    const targetElement = focusableElements[currentFocusIndex];

    if (targetElement.type === 'range') { // フォーカスがスライダーである場合
        if (targetElement !== currentSlider) { // スライダーが変わったら以前のインターバルをクリア
            if (sliderAdjustmentInterval) clearInterval(sliderAdjustmentInterval);
            sliderAdjustmentInterval = null;
            currentSlider = targetElement;
        }

        if (direction === 'stop') {
            if (sliderAdjustmentInterval) {
                clearInterval(sliderAdjustmentInterval);
                sliderAdjustmentInterval = null;
                currentSlider = null;
            }
            return;
        }

        const step = parseFloat(targetElement.step || '1');
        const min = parseFloat(targetElement.min || '0');
        const max = parseFloat(targetElement.max || '100');

        let increment = 0;
        if (direction === 'right') { // 右方向で増加
            increment = step;
        } else if (direction === 'left') { // 左方向で減少
            increment = -step;
        } else if (direction === 'up' || direction === 'down') { // 上下方向もスライダー調整に使う場合
            // スライダーの種類やUIレイアウトに応じて調整
            // 例えば、垂直スライダーの場合は上下で増減
            increment = (direction === 'up' ? step : -step);
        }

        // スティックの傾きに応じて調整速度を変える (オプション)
        // increment *= (axisValue ? Math.abs(axisValue) : 1);

        // 連続調整のインターバル設定
        if (!sliderAdjustmentInterval) {
            sliderAdjustmentInterval = setInterval(() => {
                let newValue = parseFloat(targetElement.value) + increment;
                newValue = Math.max(min, Math.min(max, newValue)); // 最小値・最大値でクランプ
                targetElement.value = newValue;

                // inputイベントを発生させて、既存のイベントリスナー（main.jsなど）をトリガー
                const event = new Event('input', { bubbles: true });
                targetElement.dispatchEvent(event);

            }, 50); // 50msごとに値を更新（調整可能）
        }
    } else {
        // フォーカスがスライダーでない場合は、スライダー調整を停止
        if (sliderAdjustmentInterval) {
            clearInterval(sliderAdjustmentInterval);
            sliderAdjustmentInterval = null;
            currentSlider = null;
        }
    }
}


// 「戻る/閉じる」ボタンのハンドラ (例: Bボタン)
function handleBackButton() {
    // 開いているパネルを閉じるロジック
    const panels = [
        document.getElementById('equalizerPanel'),
        document.getElementById('tonePanel'),
        document.getElementById('ambiencePanel'),
        document.getElementById('vocalCutPanel')
    ];
    const albumArtModal = document.getElementById('albumArtModal');

    // 開いているパネルが複数ある場合、奥にあるものから閉じる（Z-indexや表示順を考慮）
    // 通常は、最も手前にあるものが閉じる
    let panelClosed = false;
    for (let i = panels.length - 1; i >= 0; i--) {
        if (panels[i] && !panels[i].classList.contains('hidden')) {
            panels[i].classList.add('hidden');
            panelClosed = true;
            setTimeout(updateFocusableElements, 300); // 閉じた後、要素リストを更新
            break; // 1つ閉じたら終了
        }
    }

    // モーダルが開いていたら閉じる (パネルより優先)
    if (!panelClosed && albumArtModal && !albumArtModal.classList.contains('hidden')) {
        albumArtModal.classList.add('hidden');
        document.body.style.overflow = ''; // スクロール禁止を解除
        document.getElementById('modalAlbumArt').src = ''; // 安全のためにsrcをクリア
        panelClosed = true;
        setTimeout(updateFocusableElements, 300); // 閉じた後、要素リストを更新
    }

    if (panelClosed) {
        // 何か閉じた場合は、閉じた後のメインUIの要素にフォーカスを戻す
        // ここでは一旦、Play/Pauseボタンにフォーカスを戻す例
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            setFocus(focusableElements.indexOf(playPauseBtn));
        }
    } else {
        // 何も閉じなかった場合、別の戻る動作 (例: ブラウザの履歴を戻る、はWeb Audio APIでは推奨されないが...)
        // 現状では、何も開いていない場合は何もしないのが安全
        console.log("戻る操作: 開いているパネルやモーダルはありません。");
    }
}


// 初期化関数
export function initializeGamepadInput() {
    // ページロード時に既に接続されているゲームパッドがないか確認し、ポーリングを開始
    const gamepads = navigator.getGamepads();
    if (gamepads.length > 0 && gamepads[0]) {
        gamepad = gamepads[0];
        console.log("初期ゲームパッド検出:", gamepad.id);
        pollGamepads();
    }

    // 初回ロード時にフォーカス可能な要素を更新
    // DOMContentLoaded後、またはUIが完全にロードされた後に呼び出すのが安全
    // main.js の initializePlayer 関数から呼び出す
    updateFocusableElements();
    if (focusableElements.length > 0) {
        setFocus(0); // 最初の要素にフォーカス
    }
    // UIのパネル開閉時にも updateFocusableElements を呼び出すように main.js 側で調整が必要
}
