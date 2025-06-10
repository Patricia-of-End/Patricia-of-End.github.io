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
            return;
        }
    }

    gamepad = navigator.getGamepads()[gamepad.index]; // 最新の状態を取得

    handleButtons();
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
            // モーダルやパネルが開いている場合は、決定ボタン (0) と戻るボタン (1, 2) 以外はブロック
            const activeModal = getActivePanelOrModal();
            if (activeModal && i !== 0 && i !== 1 && i !== 2) { 
                // console.log("モーダル表示中のため、このボタン操作はブロックされました。", i); // デバッグ用
                return;
            }

            switch (i) {
                case 0: // Aボタン/〇ボタン (決定ボタン)
                    handleSelectButton();
                    break;
                case 1: // Bボタン/✕ボタン (戻る/閉じるボタン)
                case 2: // Xボタン/□ボタン (もう一つの戻るボタンとして)
                    handleBackButton();
                    break;
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
            }
        }
        lastButtonStates[i] = button.pressed;
    });
}

// アナログスティック入力処理
let lastAxesStates = {};
let sliderAdjustmentInterval = null; 

function handleAxes() {
    if (!gamepad) return;

    const deadZone = 0.1;
    const sensitivity = 0.05; 

    const targetElement = focusableElements[currentFocusIndex];
    const isFocusedOnSlider = targetElement && targetElement.type === 'range';

    gamepad.axes.forEach((axisValue, i) => {
        // X軸 (左右) の入力 (左スティック: 0, 右スティック: 2)
        if (i === 0 || i === 2) {
            if (isFocusedOnSlider) { // フォーカスがスライダーに当たっている場合のみ
                if (Math.abs(axisValue) > deadZone) {
                    if (Math.sign(axisValue) !== Math.sign(lastAxesStates[i] || 0) || Math.abs(axisValue - (lastAxesStates[i] || 0)) > sensitivity) {
                        handleSliderAdjustment(axisValue > 0 ? 'right' : 'left', axisValue);
                    }
                } else if (Math.abs(lastAxesStates[i] || 0) > deadZone) {
                    handleSliderAdjustment('stop', axisValue);
                }
            } else { // スライダー以外にフォーカスがある場合は、スライダー調整を停止
                handleSliderAdjustment('stop', axisValue);
            }
        }
        // Y軸 (上下) の入力 (左スティック: 1, 右スティック: 3)
        if (i === 1 || i === 3) {
            if (Math.abs(axisValue) > deadZone) {
                if (Math.sign(axisValue) !== Math.sign(lastAxesStates[i] || 0) || Math.abs(axisValue - (lastAxesStates[i] || 0)) > sensitivity) {
                    handleDirectionalInput(axisValue > 0 ? 'down' : 'up'); // スティックの上下はフォーカス移動に使う
                }
            }
            // else if (Math.abs(lastAxesStates[i] || 0) > deadZone) { // スティックがデッドゾーンに戻っても、上下移動は連続ではないのでstopは不要
            //     // handleDirectionalInput('stop', axisValue); // コメントアウト: 上下移動には 'stop' は不要
            // }
        }
        lastAxesStates[i] = axisValue;
    });
}


// --- UIフォーカスと操作ロジック ---

// 現在開いている最前面のパネルまたはモーダルを取得する
function getActivePanelOrModal() {
    const panels = [
        document.getElementById('equalizerPanel'),
        document.getElementById('tonePanel'),
        document.getElementById('ambiencePanel'),
        document.getElementById('vocalCutPanel')
    ];
    const albumArtModal = document.getElementById('albumArtModal');

    let activePanel = null;
    let maxZIndex = -1;

    panels.forEach(panel => {
        if (panel && !panel.classList.contains('hidden')) {
            const zIndex = parseFloat(window.getComputedStyle(panel).zIndex) || 0;
            if (zIndex >= maxZIndex) {
                maxZIndex = zIndex;
                activePanel = panel;
            }
        }
    });

    if (albumArtModal && !albumArtModal.classList.contains('hidden')) {
        const modalZIndex = parseFloat(window.getComputedStyle(albumArtModal).zIndex) || 0;
        if (modalZIndex >= maxZIndex) {
            activePanel = albumArtModal;
        }
    }
    return activePanel;
}


// フォーカス可能な要素を更新する関数
export function updateFocusableElements() {
    removeFocus(); // いったんフォーカスを解除

    const activeContainer = getActivePanelOrModal();
    let querySelectorBase = '';

    if (activeContainer) {
        // モーダルやパネルが開いている場合は、その中の要素のみを対象にする
        querySelectorBase = `#${activeContainer.id} `;
    } else {
        // 何も開いていない場合は、メインのプレイヤー部分の要素を対象にする
        querySelectorBase = '.player-container ';
    }

    // ★フォーカス可能な要素のセレクタを修正（以前の提案からselectなどを追加済み）
    const allCandidates = document.querySelectorAll(
        querySelectorBase + 'button:not([disabled]):not(.hidden), ' +
        querySelectorBase + 'input[type="range"]:not([disabled]):not(.hidden), ' +
        querySelectorBase + 'input[type="file"]:not([disabled]):not(.hidden), ' +
        querySelectorBase + 'input[type="checkbox"]:not([disabled]):not(.hidden), ' +
        querySelectorBase + 'select:not([disabled]):not(.hidden), ' +
        querySelectorBase + '#albumArt.cursor-pointer:not(.hidden)'
    );

    focusableElements = Array.from(allCandidates).filter(el => {
        return el.offsetParent !== null && !el.classList.contains('hidden'); // offsetParentとhiddenクラスで再度フィルタリング
    });

    // ソート (上から下、左から右の順にソート)
    focusableElements.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        if (rectA.top !== rectB.top) {
            return rectA.top - rectB.top;
        }
        return rectA.left - rectB.left;
    });

    if (focusableElements.length > 0) {
        let reFocusIndex = focusableElements.findIndex(el => el.classList.contains('gamepad-focused'));
        if (reFocusIndex === -1) {
             reFocusIndex = 0;
        }
        setFocus(reFocusIndex);
    } else {
        currentFocusIndex = -1;
    }
    // console.log("Focusable elements updated:", focusableElements.map(el => el.id || el.tagName)); // デバッグ用
}

// フォーカスを設定する関数
function setFocus(index) {
    if (currentFocusIndex !== -1 && focusableElements[currentFocusIndex]) {
        removeFocus(); // 既存のフォーカスを解除
    }

    if (index >= 0 && index < focusableElements.length) {
        currentFocusIndex = index;
        const targetElement = focusableElements[currentFocusIndex];
        targetElement.classList.add('gamepad-focused'); // CSSでハイライト
        targetElement.focus(); // キーボードフォーカスも設定 (アクセシビリティのため)

        // 必要に応じて、フォーカスされた要素が画面内に収まるようにスクロール
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        currentFocusIndex = -1;
    }
}

// フォーカスを解除する関数
function removeFocus() {
    if (currentFocusIndex !== -1 && focusableElements[currentFocusIndex]) {
        focusableElements[currentFocusIndex].classList.remove('gamepad-focused');
        // スライダーのアクティブクラスもここで解除
        if (focusableElements[currentFocusIndex].classList.contains('gamepad-slider-active')) {
             focusableElements[currentFocusIndex].classList.remove('gamepad-slider-active');
        }
        focusableElements[currentFocusIndex].blur(); // キーボードフォーカスを解除
    }
    currentFocusIndex = -1;
}

// 方向入力のハンドラ (十字キーやスティック)
function handleDirectionalInput(direction) {
    updateFocusableElements(); // 最新の要素リストに更新

    if (focusableElements.length === 0) return;

    let nextIndex = currentFocusIndex;
    const currentElement = focusableElements[currentFocusIndex];

    if (currentFocusIndex === -1 || !currentElement) {
        setFocus(0);
        return;
    }

    const currentRect = currentElement.getBoundingClientRect();
    let bestCandidate = null;
    let minScore = Infinity;

    // ★デバッグ用ログ: 現在の要素情報
    // console.log(`--- Moving ${direction} from: ${currentElement.id || currentElement.tagName} (Index: ${currentFocusIndex}) ---`);
    // console.log(`Current Rect: Left=${currentRect.left.toFixed(0)}, Top=${currentRect.top.toFixed(0)}, Right=${currentRect.right.toFixed(0)}, Bottom=${currentRect.bottom.toFixed(0)}`);

    focusableElements.forEach((el, index) => {
        if (index === currentFocusIndex) return;

        const rect = el.getBoundingClientRect();
        let isViableCandidate = false;

        // 候補が正しい方向にあるかチェック（許容度を少し広げる）
        const tolerance = 5; // 5ピクセルの重なり/ずれを許容

        switch (direction) {
            case 'up':
                // 候補の上端が現在の要素の下端より上にある
                if (rect.bottom < currentRect.top + tolerance) {
                    isViableCandidate = true;
                }
                break;
            case 'down':
                // 候補の下端が現在の要素の上端より下にある
                if (rect.top > currentRect.bottom - tolerance) {
                    isViableCandidate = true;
                }
                break;
            case 'left':
                // 候補の右端が現在の要素の左端より左にある
                if (rect.right < currentRect.left + tolerance) {
                    isViableCandidate = true;
                }
                break;
            case 'right':
                // 候補の左端が現在の要素の右端より右にある
                if (rect.left > currentRect.right - tolerance) {
                    isViableCandidate = true;
                }
                break;
        }

        if (isViableCandidate) {
            // スコアリング
            let primaryDistance = 0; // 主軸方向の距離 (移動したい方向の距離)
            let secondaryMisalignment = 0; // 副軸方向のずれ (横方向のずれ)
            let overlap = 0; // 副軸方向の重なり

            // 中心座標
            const centerCurrentX = currentRect.left + currentRect.width / 2;
            const centerCurrentY = currentRect.top + currentRect.height / 2;
            const centerCandidateX = rect.left + rect.width / 2;
            const centerCandidateY = rect.top + rect.height / 2;

            if (direction === 'up' || direction === 'down') {
                primaryDistance = Math.abs(centerCurrentY - centerCandidateY); // Y軸の中心間の距離
                secondaryMisalignment = Math.abs(centerCurrentX - centerCandidateX); // X軸の中心間のずれ
                overlap = Math.max(0, Math.min(currentRect.right, rect.right) - Math.max(currentRect.left, rect.left)); // X軸の重なり
            } else { // left || right
                primaryDistance = Math.abs(centerCurrentX - centerCandidateX); // X軸の中心間の距離
                secondaryMisalignment = Math.abs(centerCurrentY - centerCandidateY); // Y軸の中心間のずれ
                overlap = Math.max(0, Math.min(currentRect.bottom, rect.bottom) - Math.max(currentRect.top, rect.top)); // Y軸の重なり
            }

            // スコア計算
            score = primaryDistance + secondaryMisalignment * 0.5; // 副軸のずれは距離の半分でペナルティを強く

            // 重なりがほとんどない場合の大きなペナルティ (ただし、直線上にいる場合を除く)
            const MIN_OVERLAP_FOR_ALIGNMENT = 5; // これ以下の重なりだと「ずれている」とみなす閾値
            const MAX_MISALIGNMENT_FOR_NO_OVERLAP_PENALTY = 20; // このずれ以内なら、重なりがなくても大きなペナルティはつけない

            if (overlap < MIN_OVERLAP_FOR_ALIGNMENT && secondaryMisalignment > MAX_MISALIGNMENT_FOR_NO_OVERLAP_PENALTY) {
                score += 500; // 重なりがほとんどなく、大きくずれている場合は大きなペナルティ
            } else if (overlap < MIN_OVERLAP_FOR_ALIGNMENT && secondaryMisalignment > 0) { // わずかにずれているのに重なりがない
                score += 50; // 中程度のペナルティ
            }

            // ★デバッグ用ログ: 各候補のスコアと情報 (有効化すると詳細ログが見れます)
            // console.log(`  Candidate: ${el.id || el.tagName} (Index: ${index})`);
            // console.log(`    Rect: L=${rect.left.toFixed(0)}, T=${rect.top.toFixed(0)}, R=${rect.right.toFixed(0)}, B=${rect.bottom.toFixed(0)}`);
            // console.log(`    Primary Dist: ${primaryDistance.toFixed(1)}, Secondary Misalign: ${secondaryMisalignment.toFixed(1)}, Overlap: ${overlap.toFixed(1)}`);
            // console.log(`    Score: ${score.toFixed(1)}`);


            if (score < minScore) {
                minScore = score;
                bestCandidate = el;
            }
        }
    });

    if (bestCandidate) {
        // console.log(`Moving ${direction} from ${currentElement.id || currentElement.tagName} to ${bestCandidate.id || bestCandidate.tagName} (Score: ${minScore.toFixed(1)})`); // デバッグ用
        nextIndex = focusableElements.indexOf(bestCandidate);
    } else {
        // 候補が見つからない場合は、現在のフォーカスを維持
        // console.log(`No ideal candidate found for ${direction} from ${currentElement.id || currentElement.tagName}. Keeping current focus.`); // デバッグ用
        nextIndex = currentFocusIndex; 
    }

    if (nextIndex !== currentFocusIndex) {
        setFocus(nextIndex);
    }
}


// 選択ボタンが押されたときの処理
function handleSelectButton() {
    if (currentFocusIndex !== -1 && focusableElements[currentFocusIndex]) {
        const targetElement = focusableElements[currentFocusIndex];
        
        if (targetElement.type === 'range') { // スライダーの場合
            targetElement.classList.toggle('gamepad-slider-active');
            if (!targetElement.classList.contains('gamepad-slider-active')) {
                if (sliderAdjustmentInterval) {
                    clearInterval(sliderAdjustmentInterval);
                    sliderAdjustmentInterval = null;
                }
            }
        } else if (targetElement.type === 'checkbox') { // チェックボックスの場合
            targetElement.checked = !targetElement.checked;
            const event = new Event('change', { bubbles: true });
            targetElement.dispatchEvent(event);
        } else if (targetElement.tagName === 'SELECT') { // select要素の場合
            targetElement.click();
            setTimeout(() => {
                updateFocusableElements();
            }, 100);
        } else {
            targetElement.click();
        }

        // パネルを開くボタンが押された場合
        const panelsToggleIds = ['toggleEqBtn', 'toggleToneBtn', 'toggleAmbienceBtn', 'toggleVocalCutBtn'];
        if (panelsToggleIds.includes(targetElement.id)) {
            setTimeout(() => {
                updateFocusableElements();
                const openedPanelId = targetElement.id.replace('toggle', '').replace('Btn', 'Panel');
                const openedPanel = document.getElementById(openedPanelId); // ★修正済み: dataset.panelIdの代わりにIDから取得
                if (openedPanel) {
                    const firstFocusableInPanel = openedPanel.querySelector('button:not([disabled]):not(.hidden), input:not([disabled]):not(.hidden), select:not([disabled]):not(.hidden)');
                    if (firstFocusableInPanel) {
                        setFocus(focusableElements.indexOf(firstFocusableInPanel));
                    }
                }
            }, 300);
        }
    }
}


// スライダー調整のハンドラ
function handleSliderAdjustment(direction, axisValue) {
    const targetElement = focusableElements[currentFocusIndex];

    // フォーカスがスライダーであり、かつ gamepad-focused クラスと gamepad-slider-active クラスを持っている場合のみ動作
    if (!targetElement || targetElement.type !== 'range' || !targetElement.classList.contains('gamepad-focused') || !targetElement.classList.contains('gamepad-slider-active')) {
        if (sliderAdjustmentInterval) {
            clearInterval(sliderAdjustmentInterval);
            sliderAdjustmentInterval = null;
        }
        return;
    }

    if (direction === 'stop') {
        if (sliderAdjustmentInterval) {
            clearInterval(sliderAdjustmentInterval);
            sliderAdjustmentInterval = null;
        }
        return;
    }

    const step = parseFloat(targetElement.step || '1');
    const min = parseFloat(targetElement.min || '0');
    const max = parseFloat(targetElement.max || '100');

    let increment = 0;
    if (direction === 'right') {
        increment = step;
    } else if (direction === 'left') {
        increment = -step;
    }

    // スティックの傾きで調整速度を変える (オプション)
    // increment *= (axisValue ? Math.abs(axisValue) : 1);

    if (!sliderAdjustmentInterval) {
        sliderAdjustmentInterval = setInterval(() => {
            let newValue = parseFloat(targetElement.value) + increment;
            newValue = Math.max(min, Math.min(max, newValue));
            targetElement.value = newValue;

            const event = new Event('input', { bubbles: true });
            targetElement.dispatchEvent(event);

        }, 50);
    }
}


// 「戻る/閉じる」ボタンのハンドラ (例: Bボタン / ✕ボタン)
function handleBackButton() {
    const albumArtModal = document.getElementById('albumArtModal');
    if (albumArtModal && !albumArtModal.classList.contains('hidden')) {
        albumArtModal.classList.add('hidden');
        document.body.style.overflow = '';
        document.getElementById('modalAlbumArt').src = '';
        console.log("アルバムアートモーダルを閉じました。");
        setTimeout(updateFocusableElements, 100);
        return;
    }

    const panels = [
        document.getElementById('vocalCutPanel'),
        document.getElementById('ambiencePanel'),
        document.getElementById('tonePanel'),
        document.getElementById('equalizerPanel')
    ];

    for (let i = 0; i < panels.length; i++) {
        if (panels[i] && !panels[i].classList.contains('hidden')) {
            panels[i].classList.add('hidden');
            console.log(`パネル #${panels[i].id} を閉じました。`);
            setTimeout(() => {
                updateFocusableElements();
                const toggleButtonId = `toggle${panels[i].id.replace('Panel', 'Btn')}`;
                const toggleButton = document.getElementById(toggleButtonId);
                if (toggleButton) {
                    setFocus(focusableElements.indexOf(toggleButton));
                } else {
                    setFocus(0);
                }
            }, 300);
            return;
        }
    }

    console.log("戻る操作: 開いているパネルやモーダルはありません。");
}


// 初期化関数
export function initializeGamepadInput() {
    const gamepads = navigator.getGamepads();
    if (gamepads.length > 0 && gamepads[0]) {
        gamepad = gamepads[0];
        console.log("初期ゲームパッド検出:", gamepad.id);
        pollGamepads();
    }

    updateFocusableElements();
    if (focusableElements.length > 0) {
        setFocus(0);
    }
}
