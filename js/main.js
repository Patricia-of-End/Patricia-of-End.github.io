// js/main.js

import * as dom from './domElements.js'; // DOM要素を扱うモジュールをインポート
import * as utils from './utils.js'; // ユーティリティ関数をインポート
import * as ui from './ui.js'; // UI関連の処理を扱うモジュールをインポート
import * as audioHandler from './audioHandler.js'; // オーディオファイルの読み込みと再生を扱うモジュールをインポート
import * as lyrics from './lyricsHandler.js'; // 歌詞の表示と同期を扱うモジュールをインポート
import * as visualizer from './visualizer.js'; // オーディオビジュアライザーを扱うモジュールをインポート
import * as mediaSession from './mediaSessionHandler.js'; // Media Session APIを扱うモジュールをインポート
import { PRESETS } from './eq-presets.js'; // イコライザープリセットをインポート
import { AMBIENCE_PRESETS } from './ambience-presets.js'; // アンビエンスプリセットをインポート
import * as inputHandler from './inputHandler.js'; // ゲームパッド入力などを扱うモジュールをインポート

// 他のモジュールから参照される可能性のあるメインモジュールの機能
export const mainModule = {
    setupAudioPlayerEventListeners,
    updateMediaSessionTarget
};

// --- デバイス情報取得のヘルパー関数 ---
/**
 * ユーザーのデバイスタイプを判定します。
 * @returns {string} - 判定されたデバイスのタイプ。
 */
function getDeviceType() {
    const ua = navigator.userAgent; // ユーザーエージェント文字列を取得
    if (/iPad|iPhone|iPod/.test(ua)) return 'iOS デバイス';
    if (/Android/.test(ua)) return 'Android デバイス';
    if (/Windows/.test(ua)) return 'Windows PC';
    if (/Macintosh|MacIntel/.test(ua)) return 'Mac';
    if (/Linux/.test(ua)) return 'Linux PC';
    return '不明なデバイス'; // どのデバイスにも一致しない場合
}

/**
 * 指定されたオーディオプレーヤー要素にすべての必要なイベントリスナーを設定します。
 * @param {HTMLAudioElement} playerElement - イベントリスナーをアタッチするオーディオ要素。
 */
function setupAudioPlayerEventListeners(playerElement) {
    if (!playerElement) {
        console.error("[Main] setupAudioPlayerEventListeners: playerElement is null or undefined!");
        return; // 要素がなければ処理しない
    }
    console.log("[Main] Attempting to attach event listeners to audioPlayer:", playerElement);

    // オーディオ再生関連のイベントリスナーをaudioHandlerに委譲
    playerElement.addEventListener('play', audioHandler.handleAudioPlay);
    playerElement.addEventListener('pause', audioHandler.handleAudioPause);
    playerElement.addEventListener('ended', audioHandler.handleAudioEnded);
    playerElement.addEventListener('loadedmetadata', audioHandler.handleAudioLoadedMetadata);
    playerElement.addEventListener('timeupdate', audioHandler.handleAudioTimeUpdate);
    playerElement.addEventListener('canplay', audioHandler.handleAudioCanPlay);

    // エラーイベントリスナー
    playerElement.addEventListener('error', (e) => {
        console.error('[Main] audioPlayer Error Event on element:', playerElement, 'Error object:', e);
        const currentAudioPlayerInScope = playerElement; // エラーが発生したオーディオ要素
        if (currentAudioPlayerInScope && currentAudioPlayerInScope.error) {
            console.error('[Main] audioPlayer.error details:', currentAudioPlayerInScope.error);
            let message = '音声ファイルの再生中にエラーが発生しました。';

            // MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED (Code 4) の場合はUIメッセージを抑制
            // これは、ブラウザがMIMEタイプを認識できない場合でも、実際のデコードは可能である場合に起こり得るため。
            if (currentAudioPlayerInScope.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                console.warn('[Main] Suppressing UI message for MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED (Code 4). Playback may still work.');
                return; // UIメッセージを表示せず終了
            }

            // エラーコードに基づいてメッセージを分岐
            switch (currentAudioPlayerInScope.error.code) {
                case MediaError.MEDIA_ERR_ABORTED: message = '音声の再生が中止されました。'; break;
                case MediaError.MEDIA_ERR_NETWORK: message = 'ネットワークエラーにより音声のダウンロードに失敗しました。'; break;
                case MediaError.MEDIA_ERR_DECODE: message = '音声のデコード中にエラーが発生しました。'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: message = '音声ソースの形式がサポートされていません。'; break;
                default: message = '不明なエラーにより音声の再生に失敗しました。'; break;
            }
            utils.setErrorMessage(dom.messageArea, message + ` (Code: ${currentAudioPlayerInScope.error.code})`); // エラーメッセージをUIに表示
        } else {
            utils.setErrorMessage(dom.messageArea, '音声ファイルの再生中に不明なエラーが発生しました。'); // 詳細不明なエラー
        }
    });
    // その他のオーディオイベントのログ
    playerElement.addEventListener('stalled', (e) => { console.warn('[Main] audioPlayer Stalled Event:', e); });
    playerElement.addEventListener('emptied', (e) => { console.log('[Main] audioPlayer Emptied Event:', e); });
    console.log('[Main] AudioPlayer event listeners (re-)attached to:', playerElement);
}

/**
 * Media Session APIのターゲットとなるオーディオプレーヤー要素を更新します。
 * @param {HTMLAudioElement} [playerElement=dom.audioPlayer] - 新しいオーディオ要素。
 */
function updateMediaSessionTarget(playerElement = dom.audioPlayer) {
    // mediaSessionHandlerモジュールを使ってMedia Sessionを設定
    mediaSession.setupMediaSession(playerElement, audioHandler.togglePlayPauseAudio);
    console.log('[Main] MediaSession target updated to:', playerElement);
}

/**
 * イコライザーUIのセットアップを行います。プリセットオプションと各バンドのスライダーを生成します。
 */
function setupEqualizerUI() {
    const eqContainer = document.getElementById('equalizerContainer'); // イコライザーコンテナ要素
    const presetSelect = document.getElementById('eqPresetSelect'); // プリセット選択ドロップダウン
    if (!eqContainer || !presetSelect) return; // 要素がなければ処理しない

    presetSelect.innerHTML = ''; // 既存のオプションをクリア
    // プリセットをドロップダウンに追加
    PRESETS.forEach((p, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = p.name;
        presetSelect.appendChild(o);
    });

    eqContainer.innerHTML = ''; // 既存のスライダーをクリア
    // イコライザーバンドの周波数リスト
    const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
    const maxGain = 15; // 最大ゲイン値

    // 各周波数バンドのスライダーとラベルを生成
    frequencies.forEach((freq, i) => {
        const bandContainer = document.createElement('div');
        bandContainer.className = 'equalizer-band'; // スタイル用のクラス
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = -maxGain; // 最小ゲイン
        slider.max = maxGain; // 最大ゲイン
        slider.step = 0.5; // ステップ値
        slider.value = 0; // 初期値
        slider.dataset.bandIndex = i; // バンドのインデックスをデータ属性として保持
        const label = document.createElement('label');
        label.textContent = freq >= 1000 ? `${freq / 1000}k` : `${freq}`; // 周波数ラベル（例: 1k, 60）
        bandContainer.appendChild(slider);
        bandContainer.appendChild(label);
        eqContainer.appendChild(bandContainer);
    });
}

/**
 * イコライザーのUIスライダーを、指定されたゲイン値で更新します。
 * @param {number[]} gains - 各バンドのゲイン値の配列。
 */
function updateEqUISliders(gains) {
    const sliders = document.querySelectorAll('#equalizerContainer input[type="range"]'); // すべてのスライダーを取得
    if (sliders.length === gains.length) {
        sliders.forEach((slider, index) => { slider.value = gains[index]; }); // スライダーの値を更新
    }
}

/**
 * アプリケーション全体の主要なイベントリスナーを設定します。
 */
function attachEventListeners() {
    // メインコントロールのイベントリスナー
    if (dom.audioFileEl) dom.audioFileEl.addEventListener('change', audioHandler.handleAudioFileChange); // オーディオファイル選択時の処理
    if (dom.lrcFileEl) dom.lrcFileEl.addEventListener('change', (event) => lyrics.handleLrcFileChange(event, audioHandler.audioLoaded, dom.audioPlayer)); // LRCファイル選択時の処理
    if (dom.clearLrcBtn) dom.clearLrcBtn.addEventListener('click', lyrics.clearExternalLyrics); // LRCクリアボタンの処理
    if (dom.playPauseBtn) dom.playPauseBtn.addEventListener('click', audioHandler.togglePlayPauseAudio); // 再生/一時停止ボタンの処理

    if (dom.seekBar) {
        dom.seekBar.addEventListener('input', () => { if (audioHandler.audioLoaded && dom.audioPlayer) dom.audioPlayer.currentTime = dom.seekBar.value; }); // シークバー操作で再生位置変更
        // シーク開始/終了のフラグ設定（タッチイベントにも対応）
        dom.seekBar.addEventListener('mousedown', () => { if(audioHandler.audioLoaded) audioHandler.setIsSeeking(true); });
        dom.seekBar.addEventListener('mouseup', () => { if(audioHandler.audioLoaded) audioHandler.setIsSeeking(false); });
        dom.seekBar.addEventListener('touchstart', () => { if(audioHandler.audioLoaded) audioHandler.setIsSeeking(true); });
        dom.seekBar.addEventListener('touchend', () => { if(audioHandler.audioLoaded) audioHandler.setIsSeeking(false); });
    }
    if (dom.volumeBar) dom.volumeBar.addEventListener('input', (event) => { if (dom.audioPlayer) dom.audioPlayer.volume = event.target.value; }); // 音量バー操作で音量変更

    // イコライザーパネルのイベントリスナー
    const eqContainer = document.getElementById('equalizerContainer');
    const presetSelect = document.getElementById('eqPresetSelect');
    const resetEqBtn = document.getElementById('resetEqBtn');
    if (eqContainer && presetSelect && resetEqBtn) {
        // スライダー操作でイコライザーのゲインを設定
        eqContainer.addEventListener('input', e => {
            if (e.target.type === 'range') {
                const i = parseInt(e.target.dataset.bandIndex, 10);
                const v = parseFloat(e.target.value);
                visualizer.setEqBandGain(i, v); // ビジュアライザーのイコライザーバンドゲインを更新
                presetSelect.value = ''; // プリセット選択をカスタム状態にリセット
            }
        });
        // スライダーのダブルクリックでゲインを0にリセット
        eqContainer.addEventListener('dblclick', e => {
            if (e.target.type === 'range') {
                e.target.value = 0;
                const i = parseInt(e.target.dataset.bandIndex, 10);
                visualizer.setEqBandGain(i, 0);
                presetSelect.value = 0; // プリセット選択も「フラット」にリセット
            }
        });
        // リセットボタンクリックでイコライザーをリセット
        resetEqBtn.addEventListener('click', () => {
            if (visualizer.resetEqGains()) {
                updateEqUISliders(PRESETS[0].gains); // UIスライダーをプリセット0（フラット）に更新
                presetSelect.value = 0;
            }
        });
        // プリセット選択変更でイコライザー設定を適用
        presetSelect.addEventListener('change', e => {
            const i = e.target.value;
            if (i === "") return; // 空選択の場合は何もしない
            const p = PRESETS[i]; // 選択されたプリセットを取得
            if (p && visualizer.applyEqPreset(p)) {
                updateEqUISliders(p.gains); // UIスライダーをプリセット値に更新
            }
        });
    }

    // 音質・音場パネルのイベントリスナー (Bass, Treble, Stereo Width)
    const bassSlider = document.getElementById('bassSlider');
    const trebleSlider = document.getElementById('trebleSlider');
    const stereoSlider = document.getElementById('stereoSlider');
    const resetToneBtn = document.getElementById('resetToneBtn');
    if(stereoSlider) stereoSlider.value = 0; // 初期ステレオ幅を0に設定

    // スライダー操作とダブルクリックでのリセット
    if (bassSlider) {
        bassSlider.addEventListener('input', (e) => visualizer.setBassGain(parseFloat(e.target.value)));
        bassSlider.addEventListener('dblclick', (e) => { e.target.value = 0; visualizer.setBassGain(0); });
    }
    if (trebleSlider) {
        trebleSlider.addEventListener('input', (e) => visualizer.setTrebleGain(parseFloat(e.target.value)));
        trebleSlider.addEventListener('dblclick', (e) => { e.target.value = 0; visualizer.setTrebleGain(0); });
    }
    if (stereoSlider) {
        stereoSlider.addEventListener('input', (e) => visualizer.setStereoWidth(parseFloat(e.target.value)));
        stereoSlider.addEventListener('dblclick', (e) => { e.target.value = 0; visualizer.setStereoWidth(0); });
    }
    // リセットボタンクリック
    if (resetToneBtn) {
        resetToneBtn.addEventListener('click', () => {
            if (visualizer.resetToneControls()) {
                if(bassSlider) bassSlider.value = 0;
                if(trebleSlider) trebleSlider.value = 0;
                if(stereoSlider) stereoSlider.value = 0;
            }
        });
    }

    // アンビエンスパネルのイベントリスナー (リバーブ)
    const mixSlider = document.getElementById('reverbMixSlider');
    const preDelaySlider = document.getElementById('preDelaySlider');
    const dampSlider = document.getElementById('dampSlider');
    const ambiencePresetSelect = document.getElementById('ambiencePresetSelect');
    const resetAmbienceBtn = document.getElementById('resetAmbienceBtn');

    // スライダー操作とダブルクリックでのリセット
    if (mixSlider) {
        mixSlider.addEventListener('input', e => visualizer.setReverbMix(parseFloat(e.target.value)));
        mixSlider.addEventListener('dblclick', e => { e.target.value = 0; visualizer.setReverbMix(0); });
    }
    if (preDelaySlider) {
        preDelaySlider.addEventListener('input', e => visualizer.setReverbPreDelay(parseFloat(e.target.value)));
        preDelaySlider.addEventListener('dblclick', e => { e.target.value = 0; visualizer.setReverbPreDelay(0); });
    }
    if (dampSlider) {
        dampSlider.addEventListener('input', e => visualizer.setReverbDamp(parseFloat(e.target.value)));
        dampSlider.addEventListener('dblclick', e => { e.target.value = 22050; visualizer.setReverbDamp(22050); }); // 初期値22050
    }
    // リセットボタンクリック
    if (resetAmbienceBtn) {
        resetAmbienceBtn.addEventListener('click', () => {
            if (visualizer.resetAmbienceControls()) {
                if (mixSlider) mixSlider.value = 0;
                if (preDelaySlider) preDelaySlider.value = 0;
                if (dampSlider) dampSlider.value = 22050; // 初期値に戻す
                if (ambiencePresetSelect) ambiencePresetSelect.value = 0; // プリセット選択もリセット
            }
        });
    }
    // アンビエンスプリセット選択変更
    if (ambiencePresetSelect) {
        // プリセットをドロップダウンに追加
        AMBIENCE_PRESETS.forEach((p, i) => {
            const o = document.createElement('option');
            o.value = i;
            o.textContent = p.name;
            ambiencePresetSelect.appendChild(o);
        });
        ambiencePresetSelect.addEventListener('change', (e) => {
            const preset = AMBIENCE_PRESETS[e.target.value]; // 選択されたプリセットを取得
            // 修正: 'p' が未定義のため 'preset' を使用
            if (preset && visualizer.applyAmbiencePreset(preset)) {
                if (mixSlider) mixSlider.value = preset.values.mix;
                if (preDelaySlider) preDelaySlider.value = preset.values.preDelay;
                if (dampSlider) dampSlider.value = preset.values.damp;
            }
        });
    }

    // ボーカルカットパネルのイベントリスナー
    const vocalCutToggle = document.getElementById('vocalCutToggle');
    if (vocalCutToggle) {
        vocalCutToggle.addEventListener('change', (event) => {
            visualizer.setVocalCut(event.target.checked); // チェックボックスの状態に基づいてボーカルカットを切り替え
        });
    }

    // パネル表示/非表示のトグルボタンと閉じるボタンのイベントリスナー
    const panels = [
        { toggle: 'toggleEqBtn', close: 'closeEqBtn', panel: 'equalizerPanel' },
        { toggle: 'toggleToneBtn', close: 'closeToneBtn', panel: 'tonePanel' },
        { toggle: 'toggleAmbienceBtn', close: 'closeAmbienceBtn', panel: 'ambiencePanel' },
        { toggle: 'toggleVocalCutBtn', close: 'closeVocalCutBtn', panel: 'vocalCutPanel' }
    ];
    panels.forEach(({ toggle, close, panel }) => {
        const t = document.getElementById(toggle); // トグルボタン
        const c = document.getElementById(close); // 閉じるボタン
        const p = document.getElementById(panel); // パネル自体

        if(t && p) t.addEventListener('click',() => p.classList.remove('hidden')); // トグルボタンでパネルを表示
        if(c && p) c.addEventListener('click',() => p.classList.add('hidden')); // 閉じるボタンでパネルを非表示
        if(p) p.addEventListener('click', e => { // パネルの背景クリックで閉じる
            if(e.target === p) p.classList.add('hidden');
        });
    });

    // アルバムアート拡大表示モーダルのイベントリスナー
    const albumArt = document.getElementById('albumArt');
    const albumArtModal = document.getElementById('albumArtModal');
    const modalAlbumArt = document.getElementById('modalAlbumArt');
    const closeModalBtn = document.getElementById('closeModalBtn');

    if (albumArt && albumArtModal && modalAlbumArt && closeModalBtn) {

        // モーダルを開く関数
        const openModal = () => {
            const currentSrc = albumArt.src;
            // プレースホルダー画像でない場合のみモーダルを開く
            if (currentSrc && !currentSrc.includes('placehold.co') && !albumArt.classList.contains('hidden')) {
                modalAlbumArt.src = currentSrc; // モーダル内の画像ソースを設定
                albumArtModal.classList.remove('hidden'); // モーダルを表示
                document.body.style.overflow = 'hidden'; // 背景スクロールを禁止
            }
        };

        // モーダルを閉じる関数
        const closeModal = () => {
            albumArtModal.classList.add('hidden'); // モーダルを非表示
            document.body.style.overflow = ''; // スクロール禁止を解除
            modalAlbumArt.src = ''; // 安全のためにsrcをクリア
        };

        // 各要素にイベントリスナーを設定
        albumArt.addEventListener('click', openModal); // アルバムアートクリックでモーダルを開く
        closeModalBtn.addEventListener('click', closeModal); // 閉じるボタンクリックでモーダルを閉じる
        albumArtModal.addEventListener('click', (event) => {
            // モーダル背景クリックでモーダルを閉じる
            if (event.target === albumArtModal) {
                closeModal();
            }
        });

        // Escapeキーでモーダルを閉じるリスナーをドキュメントに追加
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !albumArtModal.classList.contains('hidden')) {
                closeModal();
            }
        });
    }

    // ★ファイル詳細情報モーダル関連のロジックを再導入
    if (dom.openDetailsModalBtn && dom.fileDetailsModal && dom.closeFileDetailsModalBtn) {
        dom.openDetailsModalBtn.addEventListener('click', () => {
            dom.fileDetailsModal.classList.remove('hidden'); // 詳細情報モーダルを表示
            // モーダルが開いた後にフォーカス可能な要素を更新（アクセシビリティのため）
            setTimeout(() => inputHandler.updateFocusableElements(), 100);
        });
        dom.closeFileDetailsModalBtn.addEventListener('click', () => {
            dom.fileDetailsModal.classList.add('hidden'); // 詳細情報モーダルを非表示
            // モーダルが閉じた後にフォーカス可能な要素を更新（アクセシビリティのため）
            setTimeout(() => inputHandler.updateFocusableElements(), 100);
        });
        dom.fileDetailsModal.addEventListener('click', (e) => {
            // モーダル背景クリックでモーダルを閉じる
            if (e.target === dom.fileDetailsModal) {
                dom.fileDetailsModal.classList.add('hidden');
                // モーダルが閉じた後にフォーカス可能な要素を更新（アクセシビリティのため）
                setTimeout(() => inputHandler.updateFocusableElements(), 100);
            }
        });
    }
    // ★追加ここまで
}

/**
 * プレーヤーの初期化を行います。
 * グローバルなjsmediatagsインスタンスの初期化、オーディオ・ビジュアライザー・UIのセットアップ、
 * イベントリスナーのアタッチ、デバイス情報の表示などを行います。
 */
function initializePlayer() {
    // jsmediatagsがグローバルスコープで利用可能であることを確認し、audioHandlerに渡す
    if (window.jsmediatags) audioHandler.initializeJsMediaTags(window.jsmediatags);
    audioHandler.initializeAudioHandler(mainModule); // audioHandlerにmainModuleを渡して、DOM要素の再生成時にイベントを再設定できるようにする
    visualizer.initVisualizerCanvas(); // Canvasを初期化

    setupEqualizerUI(); // イコライザーUIのセットアップ
    updateMediaSessionTarget(); // MediaSessionのターゲットを設定

    ui.initialMetadataDisplay(); // 初期メタデータ表示
    ui.resetFileInfoDisplay(); // ファイル情報表示のリセット
    lyrics.resetLyricsUI(); // 歌詞UIのリセット
    ui.setAudioControlsEnabled(false); // オーディオコントロールを無効化

    // 初期ボリューム設定
    if (dom.audioPlayer && dom.volumeBar) {
        dom.audioPlayer.volume = 0.5;
        dom.volumeBar.value = 0.5;
    }

    setupAudioPlayerEventListeners(dom.audioPlayer); // オーディオプレイヤーのイベントリスナーをセットアップ
    attachEventListeners(); // その他のイベントリスナーをアタッチ
    inputHandler.initializeGamepadHandler(); // ゲームパッド入力の初期化を修正

    // ★デバイス情報表示のロジックを再導入
    if (dom.deviceInfoDisplay) { // deviceInfoDisplay がHTMLに存在することを確認
        dom.deviceInfoDisplay.textContent = `再生デバイス: ${getDeviceType()}`;
    }

    utils.setSuccessMessage(dom.messageArea, "プレーヤーの準備ができました。"); // 準備完了メッセージ

    // ページを離れる前にObjectURLを解放し、AudioContextを閉じる
    window.addEventListener('beforeunload', () => {
        if(audioHandler.currentObjectURL) URL.revokeObjectURL(audioHandler.currentObjectURL);
        visualizer.closeAudioContext();
    });
}

// DOMコンテンツがロードされた後にプレイヤーを初期化
document.addEventListener('DOMContentLoaded', initializePlayer);
