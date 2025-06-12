let gamepad = null; // 現在検出されているゲームパッドのオブジェクト
let animationFrameId = null; // requestAnimationFrame のID
let focusableElements = []; // 現在フォーカス可能なUI要素のリスト
let currentFocusIndex = -1; // 現在フォーカスされている要素のインデックス
let sliderAdjustmentInterval = null; // スライダー調整用のインターバルIDを保持
// これらの変数はファイル冒頭で一度だけ宣言されます

// ゲームパッド接続イベントリスナー
window.addEventListener("gamepadconnected", (e) => {
    console.log("ゲームパッドが接続されました:", e.gamepad.id);
    gamepad = e.gamepad; // 接続されたゲームパッドを保持
    if (!animationFrameId) {
        // まだポーリングが開始されていなければ開始
        pollGamepads();
    }
});

// ゲームパッド切断イベントリスナー
window.addEventListener("gamepaddisconnected", (e) => {
    console.log("ゲームパッドが切断されました:", e.gamepad.id);
    if (gamepad && gamepad.index === e.gamepad.index) {
        // 切断されたのが現在使用しているゲームパッドであれば、リセット
        gamepad = null;
        removeFocus(); // フォーカスを解除
        // 他のゲームパッドが接続されていないか確認し、再検出
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i].connected) {
                gamepad = gamepads[i];
                console.log("切断後、ゲームパッドを再検出:", gamepad.id);
                break;
            }
        }
        if (!gamepad && animationFrameId) {
            // 他にゲームパッドがなければポーリングを停止
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            console.log("全てのゲームパッドが切断されました。ポーリングを停止します。");
        }
    }
});

// ゲームパッドの状態を継続的にポーリングする関数
function pollGamepads() {
    if (!gamepad) {
        // ゲームパッドが検出されていない場合、再度アクティブなゲームパッドを探す
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i].connected) {
                gamepad = gamepads[i];
                console.log("切断後、ゲームパッドを再検出:", gamepad.id);
                break;
            }
        }
        if (!gamepad) {
            // ゲームパッドが見つからない場合、アニメーションフレームのループを停止
            animationFrameId = null;
            return;
        }
    }

    gamepad = navigator.getGamepads()[gamepad.index]; // 最新の状態を取得

    handleButtons(); // ボタン入力の処理
    handleAxes(); // アナログスティック入力の処理

    // 次のフレームで再度ポーリング
    animationFrameId = requestAnimationFrame(pollGamepads);
}

// ボタン入力処理
let lastButtonStates = {}; // 前回のボタンの状態を保持

function handleButtons() {
    if (!gamepad) return; // ゲームパッドがなければ処理しない

    gamepad.buttons.forEach((button, i) => {
        // ボタンが「押された瞬間」を検出 (前回の状態と比較)
        if (button.pressed && !lastButtonStates[i]) {
            // モーダルやパネルが開いている場合は、決定ボタン (0) と戻るボタン (1, 2) 以外は入力をブロック
            const activeModal = getActivePanelOrModal();
            if (activeModal && i !== 0 && i !== 1 && i !== 2) {
                return; // ブロック対象のボタンでなければ処理をスキップ
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
                // 他のボタンが必要ならここに追加
            }
        }
        lastButtonStates[i] = button.pressed; // 現在のボタンの状態を保存
    });
}

// アナログスティック入力処理
let lastAxesStates = {}; // 前回の軸の状態を保持

function handleAxes() {
    if (!gamepad) return; // ゲームパッドがなければ処理しない

    const deadZone = 0.1; // スティックの遊び（デッドゾーン）
    const sensitivity = 0.05; // 入力の感度

    const targetElement = focusableElements[currentFocusIndex]; // 現在フォーカスされている要素
    const isFocusedOnSlider = targetElement && targetElement.type === 'range'; // フォーカスがスライダーに当たっているか

    gamepad.axes.forEach((axisValue, i) => {
        // X軸 (左右) の入力 (左スティック: 0, 右スティック: 2)
        if (i === 0 || i === 2) {
            if (isFocusedOnSlider) { // フォーカスがスライダーに当たっている場合のみ
                if (Math.abs(axisValue) > deadZone) { // デッドゾーンを超えているか
                    // スティックの方向が変わったか、感度以上の変化があったか
                    if (Math.sign(axisValue) !== Math.sign(lastAxesStates[i] || 0) || Math.abs(axisValue - (lastAxesStates[i] || 0)) > sensitivity) {
                        handleSliderAdjustment(axisValue > 0 ? 'right' : 'left', axisValue); // スライダーを調整
                    }
                } else if (Math.abs(lastAxesStates[i] || 0) > deadZone) {
                    // デッドゾーンに戻った場合、スライダー調整を停止
                    handleSliderAdjustment('stop', axisValue);
                }
            } else { // スライダー以外にフォーカスがある場合は、スライダー調整を停止
                handleSliderAdjustment('stop', axisValue);
            }
        }
        // Y軸 (上下) の入力 (左スティック: 1, 右スティック: 3)
        if (i === 1 || i === 3) {
            if (Math.abs(axisValue) > deadZone) { // デッドゾーンを超えているか
                // スティックの方向が変わったか、感度以上の変化があったか
                if (Math.sign(axisValue) !== Math.sign(lastAxesStates[i] || 0) || Math.abs(axisValue - (lastAxesStates[i] || 0)) > sensitivity) {
                    handleDirectionalInput(axisValue > 0 ? 'down' : 'up'); // スティックの上下はフォーカス移動に使う
                }
            }
        }
        lastAxesStates[i] = axisValue; // 現在の軸の状態を保存
    });
}


// --- UIフォーカスと操作ロジック ---

// 現在開いている最前面のパネルまたはモーダルを取得する
function getActivePanelOrModal() {
    // 可能性のあるパネルとモーダルのリスト
    const panels = [
        document.getElementById('equalizerPanel'),
        document.getElementById('tonePanel'),
        document.getElementById('ambiencePanel'),
        document.getElementById('vocalCutPanel')
    ];
    const albumArtModal = document.getElementById('albumArtModal');
    const fileDetailsModal = document.getElementById('fileDetailsModal'); // ★追加: 詳細情報モーダル

    let activePanel = null;
    let maxZIndex = -1; // 最大z-indexを初期化

    // 各パネルをチェックし、非表示でなく、z-indexが最も高いものを探す
    panels.forEach(panel => {
        if (panel && !panel.classList.contains('hidden')) {
            const zIndex = parseFloat(window.getComputedStyle(panel).zIndex) || 0; // z-indexを取得
            if (zIndex >= maxZIndex) {
                maxZIndex = zIndex;
                activePanel = panel;
            }
        }
    });

    // アルバムアートモーダルが非表示でないかチェックし、z-indexを比較
    if (albumArtModal && !albumArtModal.classList.contains('hidden')) {
        const modalZIndex = parseFloat(window.getComputedStyle(albumArtModal).zIndex) || 0;
        if (modalZIndex >= maxZIndex) {
            maxZIndex = modalZIndex;
            activePanel = albumArtModal;
        }
    }
    // ★追加: ファイル詳細情報モーダルが最も手前にあるか確認
    if (fileDetailsModal && !fileDetailsModal.classList.contains('hidden')) {
        const detailsModalZIndex = parseFloat(window.getComputedStyle(fileDetailsModal).zIndex) || 0;
        if (detailsModalZIndex >= maxZIndex) {
            activePanel = fileDetailsModal; // 最も手前であればこれをアクティブパネルとする
        }
    }
    return activePanel; // アクティブなパネルまたはモーダルを返す
}


// フォーカス可能な要素を更新する関数
export function updateFocusableElements() {
    removeFocus(); // いったん現在のフォーカスを解除

    const activeContainer = getActivePanelOrModal(); // 現在アクティブなパネルまたはモーダルを取得
    let querySelectorBase = '';

    if (activeContainer) {
        querySelectorBase = `#${activeContainer.id} `; // アクティブなコンテナ内を検索
    } else {
        querySelectorBase = '#player-container '; // メインのプレーヤーコンテナ内を検索
    }

    // フォーカス可能なすべての要素の候補をCSSセレクタで取得
    const allCandidates = document.querySelectorAll(
        querySelectorBase + 'button:not([disabled]):not(.hidden), ' + // 有効で非表示でないボタン
        querySelectorBase + 'input[type="range"]:not([disabled]):not(.hidden), ' + // 有効で非表示でないスライダー
        querySelectorBase + 'input[type="file"]:not([disabled]):not(.hidden), ' + // 有効で非表示でないファイル入力
        querySelectorBase + 'input[type="checkbox"]:not([disabled]):not(.hidden), ' + // 有効で非表示でないチェックボックス
        querySelectorBase + 'select:not([disabled]):not(.hidden), ' + // 有効で非表示でないセレクトボックス
        querySelectorBase + '#albumArt.cursor-pointer:not(.hidden), ' + // カーソルポインターが有効なアルバムアート（クリック可能）
        querySelectorBase + '#fileInfoDisplay div span' // ★fileInfoDisplay内の各span要素をフォーカス可能にする
    );

    // 実際に表示されている要素のみにフィルター
    focusableElements = Array.from(allCandidates).filter(el => {
        // offsetParentがnullでない（DOMツリー内にあり）、hiddenクラスがなく、幅と高さが0より大きい要素
        return el.offsetParent !== null && !el.classList.contains('hidden') && el.clientWidth > 0 && el.clientHeight > 0;
    });

    // 要素を画面上の位置に基づいてソート (上から下、次に左から右の順)
    focusableElements.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        if (rectA.top !== rectB.top) {
            return rectA.top - rectB.top; // 上にあるものが優先
        }
        return rectA.left - rectB.left; // 同じ高さなら左にあるものが優先
    });

    if (focusableElements.length > 0) {
        // 以前フォーカスされていた要素があればそのインデックスを探す
        let reFocusIndex = focusableElements.findIndex(el => el.classList.contains('gamepad-focused'));
        if (reFocusIndex === -1) {
            reFocusIndex = 0; // なければ最初の要素にフォーカス
        }
        setFocus(reFocusIndex); // フォーカスを設定
    } else {
        currentFocusIndex = -1; // フォーカス可能な要素がなければインデックスをリセット
    }
}

// フォーカスを設定する関数
function setFocus(index) {
    if (currentFocusIndex !== -1 && focusableElements[currentFocusIndex]) {
        removeFocus(); // 既にフォーカスがある場合は解除
    }

    if (index >= 0 && index < focusableElements.length) {
        currentFocusIndex = index; // 新しいフォーカスインデックスを設定
        const targetElement = focusableElements[currentFocusIndex]; // 対象の要素を取得
        targetElement.classList.add('gamepad-focused'); // フォーカススタイルを追加
        targetElement.focus(); // 要素にブラウザのフォーカスを設定

        // 要素がビューポート内に入るようにスクロール
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        currentFocusIndex = -1; // 無効なインデックスの場合はリセット
    }
}

// フォーカスを解除する関数
function removeFocus() {
    if (currentFocusIndex !== -1 && focusableElements[currentFocusIndex]) {
        focusableElements[currentFocusIndex].classList.remove('gamepad-focused'); // フォーカススタイルを削除
        if (focusableElements[currentFocusIndex].classList.contains('gamepad-slider-active')) {
            focusableElements[currentFocusIndex].classList.remove('gamepad-slider-active'); // スライダーのアクティブ状態も解除
        }
        focusableElements[currentFocusIndex].blur(); // 要素からブラウザのフォーカスを外す
    }
    currentFocusIndex = -1; // インデックスをリセット
}

// 方向入力のハンドラ (十字キーやスティック)
function handleDirectionalInput(direction) {
    updateFocusableElements(); // 最新の要素リストに更新

    if (focusableElements.length === 0) return; // フォーカス可能な要素がなければ処理しない

    let nextIndex = currentFocusIndex; // 次のフォーカスインデックスの初期値
    const currentElement = focusableElements[currentFocusIndex]; // 現在フォーカスされている要素

    if (currentFocusIndex === -1 || !currentElement) {
        setFocus(0); // フォーカスがなければ最初の要素に設定
        return;
    }

    const currentRect = currentElement.getBoundingClientRect(); // 現在の要素のDCMRect
    let bestCandidate = null; // 最適な候補要素
    let minScore = Infinity; // 最適な候補のスコア

    focusableElements.forEach((el, index) => {
        if (index === currentFocusIndex) return; // 現在の要素はスキップ

        const rect = el.getBoundingClientRect(); // 候補要素のDCMRect
        let isViableCandidate = false; // 有効な候補であるか

        const tolerance = 5; // 方向判定の許容誤差

        // 各方向に対して有効な候補であるかを判定
        switch (direction) {
            case 'up':
                // 候補が現在の要素より上にあり、かつ縦方向の許容誤差内にある
                if (rect.bottom < currentRect.top + tolerance) {
                    isViableCandidate = true;
                }
                break;
            case 'down':
                // 候補が現在の要素より下にあり、かつ縦方向の許容誤差内にある
                if (rect.top > currentRect.bottom - tolerance) {
                    isViableCandidate = true;
                }
                break;
            case 'left':
                // 候補が現在の要素より左にあり、かつ横方向の許容誤差内にある
                if (rect.right < currentRect.left + tolerance) {
                    isViableCandidate = true;
                }
                break;
            case 'right':
                // 候補が現在の要素より右にあり、かつ横方向の許容誤差内にある
                if (rect.left > currentRect.right - tolerance) {
                    isViableCandidate = true;
                }
                break;
        }

        if (isViableCandidate) {
            let primaryDistance = 0; // 主方向の距離 (上下または左右)
            let secondaryMisalignment = 0; // 副方向のずれ (水平または垂直)
            let overlap = 0; // 重なり具合

            const centerCurrentX = currentRect.left + currentRect.width / 2;
            const centerCurrentY = currentRect.top + currentRect.height / 2;
            const centerCandidateX = rect.left + rect.width / 2;
            const centerCandidateY = rect.top + rect.height / 2;

            if (direction === 'up' || direction === 'down') {
                primaryDistance = Math.abs(centerCurrentY - centerCandidateY); // Y軸方向の距離
                secondaryMisalignment = Math.abs(centerCurrentX - centerCandidateX); // X軸方向のずれ
                // 左右の重なりを計算
                overlap = Math.max(0, Math.min(currentRect.right, rect.right) - Math.max(currentRect.left, rect.left));
            } else { // left || right
                primaryDistance = Math.abs(centerCurrentX - centerCandidateX); // X軸方向の距離
                secondaryMisalignment = Math.abs(centerCurrentY - centerCandidateY); // Y軸方向のずれ
                // 上下の重なりを計算
                overlap = Math.max(0, Math.min(currentRect.bottom, rect.bottom) - Math.max(currentRect.top, rect.top));
            }

            // スコアを計算: 主方向の距離を優先し、副方向のずれは軽めに考慮
            let score = primaryDistance + secondaryMisalignment * 0.5;

            const MIN_OVERLAP_FOR_ALIGNMENT = 5; // 重なりがこれ以上あればアラインメントが良好とみなす
            const MAX_MISALIGNMENT_FOR_NO_OVERLAP_PENALTY = 20; // 重なりがない場合にペナルティを与えない許容ずれ

            // 重なりが少なく、ずれが大きい場合にペナルティを加算
            if (overlap < MIN_OVERLAP_FOR_ALIGNMENT && secondaryMisalignment > MAX_MISALIGNMENT_FOR_NO_OVERLAP_PENALTY) {
                score += 500; // 大きなペナルティ
            } else if (overlap < MIN_OVERLAP_FOR_ALIGNMENT && secondaryMisalignment > 0) {
                score += 50; // 中程度のペナルティ
            }

            // より良い候補が見つかった場合、更新
            if (score < minScore) {
                minScore = score;
                bestCandidate = el;
            }
        }
    });

    if (bestCandidate) {
        nextIndex = focusableElements.indexOf(bestCandidate); // 最適な候補のインデックスを取得
    } else {
        nextIndex = currentFocusIndex; // 候補が見つからない場合は現在のフォーカスを維持
    }

    if (nextIndex !== currentFocusIndex) {
        setFocus(nextIndex); // フォーカスを移動
    }
}


// 選択ボタンが押されたときの処理
function handleSelectButton() {
    if (currentFocusIndex !== -1 && focusableElements[currentFocusIndex]) {
        const targetElement = focusableElements[currentFocusIndex];

        if (targetElement.type === 'range') { // スライダーの場合
            targetElement.classList.toggle('gamepad-slider-active'); // スライダーのアクティブ状態をトグル
            if (!targetElement.classList.contains('gamepad-slider-active')) {
                // スライダーが非アクティブになった場合、調整インターバルをクリア
                if (sliderAdjustmentInterval) {
                    clearInterval(sliderAdjustmentInterval);
                    sliderAdjustmentInterval = null;
                }
            }
        } else if (targetElement.type === 'checkbox') { // チェックボックスの場合
            targetElement.checked = !targetElement.checked; // チェック状態を反転
            const event = new Event('change', { bubbles: true }); // changeイベントを発火
            targetElement.dispatchEvent(event);
        } else if (targetElement.tagName === 'SELECT') { // セレクトボックスの場合
            targetElement.click(); // クリックイベントを発火してドロップダウンを開く
            setTimeout(() => {
                // ドロップダウンが開いたら、フォーカス可能な要素リストを更新
                updateFocusableElements();
            }, 100);
        } else {
            targetElement.click(); // その他の要素はクリックイベントを発火
        }

        // パネルを開くボタンが押された場合、新しいパネル内の最初の要素にフォーカスを移動
        const panelsToggleIds = ['toggleEqBtn', 'toggleToneBtn', 'toggleAmbienceBtn', 'toggleVocalCutBtn', 'openDetailsModalBtn']; // ★openDetailsModalBtnを追加
        if (panelsToggleIds.includes(targetElement.id)) {
            setTimeout(() => {
                updateFocusableElements(); // UIが更新された後にフォーカス可能な要素を再取得
                const openedPanelIdMap = {
                    'toggleEqBtn': 'equalizerPanel',
                    'toggleToneBtn': 'tonePanel',
                    'toggleAmbienceBtn': 'ambiencePanel',
                    'toggleVocalCutBtn': 'vocalCutPanel',
                    'openDetailsModalBtn': 'fileDetailsModal' // ★対応するパネルIDを追加
                };
                const openedPanelId = openedPanelIdMap[targetElement.id];
                const openedPanel = document.getElementById(openedPanelId);
                if (openedPanel) {
                    // 開かれたパネル内の最初のフォーカス可能な要素にフォーカスを移動
                    const firstFocusableInPanel = openedPanel.querySelector('button:not([disabled]):not(.hidden), input:not([disabled]):not(.hidden), select:not([disabled]):not(.hidden)');
                    if (firstFocusableInPanel) {
                        setFocus(focusableElements.indexOf(firstFocusableInPanel));
                    }
                }
            }, 300); // パネルが開くのを少し待つ
        }
    }
}


// スライダー調整のハンドラ
function handleSliderAdjustment(direction, axisValue) {
    const targetElement = focusableElements[currentFocusIndex];

    // 対象がスライダーでなく、フォーカスされておらず、アクティブでない場合は処理しない
    if (!targetElement || targetElement.type !== 'range' || !targetElement.classList.contains('gamepad-focused') || !targetElement.classList.contains('gamepad-slider-active')) {
        if (sliderAdjustmentInterval) {
            clearInterval(sliderAdjustmentInterval); // 調整インターバルをクリア
            sliderAdjustmentInterval = null;
        }
        return;
    }

    if (direction === 'stop') { // 'stop'信号の場合
        if (sliderAdjustmentInterval) {
            clearInterval(sliderAdjustmentInterval); // 調整インターバルをクリア
            sliderAdjustmentInterval = null;
        }
        return;
    }

    const step = parseFloat(targetElement.step || '1'); // スライダーのステップ値を取得
    const min = parseFloat(targetElement.min || '0'); // スライダーの最小値を取得
    const max = parseFloat(targetElement.max || '100'); // スライダーの最大値を取得

    let increment = 0;
    if (direction === 'right') {
        increment = step; // 右方向ならステップ値を加算
    } else if (direction === 'left') {
        increment = -step; // 左方向ならステップ値を減算
    }

    if (!sliderAdjustmentInterval) {
        // インターバルが設定されていなければ、新たに設定
        sliderAdjustmentInterval = setInterval(() => {
            let newValue = parseFloat(targetElement.value) + increment; // 現在値にインクリメント値を加算
            newValue = Math.max(min, Math.min(max, newValue)); // 最小値と最大値の間に収める
            targetElement.value = newValue; // スライダーの値を更新

            const event = new Event('input', { bubbles: true }); // inputイベントを発火
            targetElement.dispatchEvent(event);

        }, 50); // 50ミリ秒ごとに更新
    }
}


// 「戻る/閉じる」ボタンのハンドラ (例: Bボタン / ✕ボタン)
function handleBackButton() {
    // 最初に拡大アルバムアートモーダルが開いているか確認し、開いていれば閉じる
    const albumArtModal = document.getElementById('albumArtModal');
    if (albumArtModal && !albumArtModal.classList.contains('hidden')) {
        albumArtModal.classList.add('hidden'); // モーダルを非表示にする
        updateFocusableElements(); // フォーカス可能な要素を更新
        console.log("アルバムアートモーダルを閉じました。");
        return; // 他の処理はせず終了
    }

    // ★ファイル詳細情報モーダルが開いているか確認し、開いていれば閉じる
    const fileDetailsModal = document.getElementById('fileDetailsModal');
    if (fileDetailsModal && !fileDetailsModal.classList.contains('hidden')) {
        fileDetailsModal.classList.add('hidden'); // モーダルを非表示にする
        updateFocusableElements(); // フォーカス可能な要素を更新
        console.log("ファイル詳細情報モーダルを閉じました。");
        return; // 他の処理はせず終了
    }

    // 次に、パネルが開いているか確認し、最も前面にあるものを閉じる
    const panels = [
        document.getElementById('equalizerPanel'),
        document.getElementById('tonePanel'),
        document.getElementById('ambiencePanel'),
        document.getElementById('vocalCutPanel')
    ];

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

    if (activePanel) {
        activePanel.classList.add('hidden'); // アクティブなパネルを非表示にする
        updateFocusableElements(); // フォーカス可能な要素を更新
        console.log(`パネル #${activePanel.id} を閉じました。`);
        return; // 他の処理はせず終了
    }

    console.log("戻る操作: 開いているパネルやモーダルはありません。"); // 閉じるものが何もない場合
}

// 初期化関数
export function initializeGamepadHandler() {
    // 初期ゲームパッド検出を試みる
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
            gamepad = gamepads[i];
            console.log("初期ゲームパッド検出:", gamepad.id);
            break;
        }
    }
    // ゲームパッドが検出されたらポーリングを開始
    if (gamepad) {
        pollGamepads();
    }
    // 初期状態でフォーカス可能な要素を更新
    updateFocusableElements();
}
