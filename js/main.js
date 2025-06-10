import * as dom from './domElements.js';
import * as utils from './utils.js';
import * as ui from './ui.js';
import * as audioHandler from './audioHandler.js';
import * as lyrics from './lyricsHandler.js';
import * as visualizer from './visualizer.js';
import * as mediaSession from './mediaSessionHandler.js';
import { PRESETS } from './eq-presets.js';
import { AMBIENCE_PRESETS } from './ambience-presets.js';
import * as inputHandler from './inputHandler.js'; // ★追加: inputHandlerモジュールのインポート

export const mainModule = {
    setupAudioPlayerEventListeners,
    updateMediaSessionTarget
};

function setupAudioPlayerEventListeners(playerElement) {
    if (!playerElement) {
        console.error("[Main] setupAudioPlayerEventListeners: playerElement is null or undefined!");
        return;
    }
    console.log("[Main] Attempting to attach event listeners to audioPlayer:", playerElement);

    playerElement.addEventListener('play', audioHandler.handleAudioPlay);
    playerElement.addEventListener('pause', audioHandler.handleAudioPause);
    playerElement.addEventListener('ended', audioHandler.handleAudioEnded);
    playerElement.addEventListener('loadedmetadata', audioHandler.handleAudioLoadedMetadata);
    playerElement.addEventListener('timeupdate', audioHandler.handleAudioTimeUpdate);
    playerElement.addEventListener('canplay', audioHandler.handleAudioCanPlay);
    playerElement.addEventListener('error', (e) => {
        console.error('[Main] audioPlayer Error Event on element:', playerElement, 'Error object:', e);
        const currentAudioPlayerInScope = playerElement;
        if (currentAudioPlayerInScope && currentAudioPlayerInScope.error) {
            console.error('[Main] audioPlayer.error details:', currentAudioPlayerInScope.error);
            let message = '音声ファイルの再生中にエラーが発生しました。';
            switch (currentAudioPlayerInScope.error.code) {
                case MediaError.MEDIA_ERR_ABORTED: message = '音声の再生が中止されました。'; break;
                case MediaError.MEDIA_ERR_NETWORK: message = 'ネットワークエラーにより音声のダウンロードに失敗しました。'; break;
                case MediaError.MEDIA_ERR_DECODE: message = '音声のデコード中にエラーが発生しました。'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: message = '音声ソースの形式がサポートされていません。'; break;
                default: message = '不明なエラーにより音声の再生に失敗しました。'; break;
            }
            utils.setErrorMessage(dom.messageArea, message + ` (Code: ${currentAudioPlayerInScope.error.code})`);
        } else {
            utils.setErrorMessage(dom.messageArea, '音声ファイルの再生中に不明なエラーが発生しました。');
        }
    });
    playerElement.addEventListener('stalled', (e) => { console.warn('[Main] audioPlayer Stalled Event:', e); });
    playerElement.addEventListener('emptied', (e) => { console.log('[Main] audioPlayer Emptied Event:', e); });
    console.log('[Main] AudioPlayer event listeners (re-)attached to:', playerElement);
}

function updateMediaSessionTarget(playerElement = dom.audioPlayer) {
    mediaSession.setupMediaSession(playerElement, audioHandler.togglePlayPauseAudio);
    console.log('[Main] MediaSession target updated to:', playerElement);
}

function setupEqualizerUI() {
    const eqContainer = document.getElementById('equalizerContainer');
    const presetSelect = document.getElementById('eqPresetSelect');
    if (!eqContainer || !presetSelect) return;
    presetSelect.innerHTML = '';
    PRESETS.forEach((p, i) => { const o = document.createElement('option'); o.value = i; o.textContent = p.name; presetSelect.appendChild(o); });    
    eqContainer.innerHTML = '';
    const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
    const maxGain = 15;
    frequencies.forEach((freq, i) => {
        const bandContainer = document.createElement('div');
        bandContainer.className = 'equalizer-band';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = -maxGain;
        slider.max = maxGain;
        slider.step = 0.5;
        slider.value = 0;
        slider.dataset.bandIndex = i;
        const label = document.createElement('label');
        label.textContent = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
        bandContainer.appendChild(slider);
        bandContainer.appendChild(label);
        eqContainer.appendChild(bandContainer);
    });
}

function updateEqUISliders(gains) {
    const sliders = document.querySelectorAll('#equalizerContainer input[type="range"]');
    if (sliders.length === gains.length) {
        sliders.forEach((slider, index) => { slider.value = gains[index]; });
    }
}

function attachEventListeners() {
    // メインコントロール
    if (dom.audioFileEl) dom.audioFileEl.addEventListener('change', audioHandler.handleAudioFileChange);
    if (dom.lrcFileEl) dom.lrcFileEl.addEventListener('change', (event) => lyrics.handleLrcFileChange(event, audioHandler.audioLoaded, dom.audioPlayer));
    if (dom.clearLrcBtn) dom.clearLrcBtn.addEventListener('click', lyrics.clearExternalLyrics);
    if (dom.playPauseBtn) dom.playPauseBtn.addEventListener('click', audioHandler.togglePlayPauseAudio);
    if (dom.seekBar) {
        dom.seekBar.addEventListener('input', () => { if (audioHandler.audioLoaded && dom.audioPlayer) dom.audioPlayer.currentTime = dom.seekBar.value; });
        dom.seekBar.addEventListener('mousedown', () => { if(audioHandler.audioLoaded) audioHandler.setIsSeeking(true); });
        dom.seekBar.addEventListener('mouseup', () => { if(audioHandler.audioLoaded) audioHandler.setIsSeeking(false); });
        dom.seekBar.addEventListener('touchstart', () => { if(audioHandler.audioLoaded) audioHandler.setIsSeeking(true); });
        dom.seekBar.addEventListener('touchend', () => { if(audioHandler.audioLoaded) audioHandler.setIsSeeking(false); });
    }
    if (dom.volumeBar) dom.volumeBar.addEventListener('input', (event) => { if (dom.audioPlayer) dom.audioPlayer.volume = event.target.value; });

    // イコライザーパネル
    const eqContainer = document.getElementById('equalizerContainer');
    const presetSelect = document.getElementById('eqPresetSelect');
    const resetEqBtn = document.getElementById('resetEqBtn');
    if (eqContainer && presetSelect && resetEqBtn) {
        eqContainer.addEventListener('input', e => {
            if (e.target.type === 'range') {
                const i = parseInt(e.target.dataset.bandIndex, 10);
                const v = parseFloat(e.target.value);
                visualizer.setEqBandGain(i, v);
                presetSelect.value = '';
            }
        });
        eqContainer.addEventListener('dblclick', e => {
            if (e.target.type === 'range') {
                e.target.value = 0;
                const i = parseInt(e.target.dataset.bandIndex, 10);
                visualizer.setEqBandGain(i, 0);
                presetSelect.value = 0;
            }
        });
        resetEqBtn.addEventListener('click', () => {
            if (visualizer.resetEqGains()) {
                updateEqUISliders(PRESETS[0].gains);
                presetSelect.value = 0;
            }
        });
        presetSelect.addEventListener('change', e => {
            const i = e.target.value;
            if (i === "") return;
            const p = PRESETS[i];
            if (p && visualizer.applyEqPreset(p)) {
                updateEqUISliders(p.gains);
            }
        });
    }

    // 音質・音場パネル
    const bassSlider = document.getElementById('bassSlider');
    const trebleSlider = document.getElementById('trebleSlider');
    const stereoSlider = document.getElementById('stereoSlider');
    const resetToneBtn = document.getElementById('resetToneBtn');
    if(stereoSlider) stereoSlider.value = 0;
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
    if (resetToneBtn) {
        resetToneBtn.addEventListener('click', () => {
            if (visualizer.resetToneControls()) {
                if(bassSlider) bassSlider.value = 0;
                if(trebleSlider) trebleSlider.value = 0;
                if(stereoSlider) stereoSlider.value = 0;
            }
        });
    }

    // アンビエンスパネル
    const mixSlider = document.getElementById('reverbMixSlider');
    const preDelaySlider = document.getElementById('preDelaySlider');
    const dampSlider = document.getElementById('dampSlider');
    const ambiencePresetSelect = document.getElementById('ambiencePresetSelect');
    const resetAmbienceBtn = document.getElementById('resetAmbienceBtn');
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
        dampSlider.addEventListener('dblclick', e => { e.target.value = 22050; visualizer.setReverbDamp(22050); });
    }
    if (resetAmbienceBtn) {
        resetAmbienceBtn.addEventListener('click', () => {
            if (visualizer.resetAmbienceControls()) {
                if (mixSlider) mixSlider.value = 0;
                if (preDelaySlider) preDelaySlider.value = 0;
                if (dampSlider) dampSlider.value = 22050;
                if (ambiencePresetSelect) ambiencePresetSelect.value = 0;
            }
        });
    }
    if (ambiencePresetSelect) {
        AMBIENCE_PRESETS.forEach((p, i) => { const o=document.createElement('option'); o.value=i; o.textContent=p.name; ambiencePresetSelect.appendChild(o); });
        ambiencePresetSelect.addEventListener('change', (e) => {
            const preset = AMBIENCE_PRESETS[e.target.value];
            if (preset && visualizer.applyAmbiencePreset(preset)) {
                if (mixSlider) mixSlider.value = preset.values.mix;
                if (preDelaySlider) preDelaySlider.value = preset.values.preDelay;
                if (dampSlider) dampSlider.value = preset.values.damp;
            }
        });
    }
    
    // ボーカルカットパネル
    const vocalCutToggle = document.getElementById('vocalCutToggle');
    if (vocalCutToggle) {
        vocalCutToggle.addEventListener('change', (event) => {
            visualizer.setVocalCut(event.target.checked);
        });
    }
    
    // パネル表示/非表示
    const panels = [ { toggle: 'toggleEqBtn', close: 'closeEqBtn', panel: 'equalizerPanel' }, { toggle: 'toggleToneBtn', close: 'closeToneBtn', panel: 'tonePanel' }, { toggle: 'toggleAmbienceBtn', close: 'closeAmbienceBtn', panel: 'ambiencePanel' }, { toggle: 'toggleVocalCutBtn', close: 'closeVocalCutBtn', panel: 'vocalCutPanel' }];
    panels.forEach(({ toggle, close, panel }) => { const t=document.getElementById(toggle),c=document.getElementById(close),p=document.getElementById(panel); if(t&&p)t.addEventListener('click',()=>p.classList.remove('hidden')); if(c&&p)c.addEventListener('click',()=>p.classList.add('hidden')); if(p)p.addEventListener('click',e=>{if(e.target===p)p.classList.add('hidden');}); });

    // アルバムアート拡大表示
    const albumArt = document.getElementById('albumArt');
    const albumArtModal = document.getElementById('albumArtModal');
    const modalAlbumArt = document.getElementById('modalAlbumArt');
    // ★HTMLに追加した閉じるボタンのIDと一致させます (前回の提案では 'closeModalBtn')
    const closeModalBtn = document.getElementById('closeModalBtn'); 

    if (albumArt && albumArtModal && modalAlbumArt && closeModalBtn) {
        
        const openModal = () => {
            const currentSrc = albumArt.src;
            // プレースホルダー画像ではないことを確認してから表示
            if (currentSrc && !currentSrc.includes('placehold.co') && !albumArt.classList.contains('hidden')) {
                modalAlbumArt.src = currentSrc;
                albumArtModal.classList.remove('hidden');
                document.body.style.overflow = 'hidden'; // 背景スクロールを禁止
            }
        };

        const closeModal = () => {
            albumArtModal.classList.add('hidden');
            document.body.style.overflow = ''; // スクロール禁止を解除
            modalAlbumArt.src = ''; // 安全のためにsrcをクリア
        };

        // 各要素にイベントリスナーを設定
        albumArt.addEventListener('click', openModal);
        closeModalBtn.addEventListener('click', closeModal);
        albumArtModal.addEventListener('click', (event) => {
            // 背景クリック時のみ閉じる
            if (event.target === albumArtModal) {
                closeModal();
            }
        });

        // Escapeキーでモーダルを閉じるリスナーをドキュメントに追加
        // このリスナーは一度だけ設定すればOKです
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !albumArtModal.classList.contains('hidden')) {
                closeModal();
            }
        });
    }
}

function initializePlayer() {
    if (window.jsmediatags) audioHandler.initializeJsMediaTags(window.jsmediatags);
    audioHandler.initializeAudioHandler(mainModule);
    visualizer.initVisualizerCanvas();
    setupEqualizerUI();
    updateMediaSessionTarget();
    ui.initialMetadataDisplay();
    ui.resetFileInfoDisplay();
    lyrics.resetLyricsUI();
    ui.setAudioControlsEnabled(false);
    if (dom.audioPlayer && dom.volumeBar) { dom.audioPlayer.volume = 0.5; dom.volumeBar.value = 0.5; }
    setupAudioPlayerEventListeners(dom.audioPlayer);
    attachEventListeners(); // 全ての静的要素へのリスナー設定をまとめる
    utils.setSuccessMessage(dom.messageArea, "プレーヤーの準備ができました。");
    window.addEventListener('beforeunload', () => { if(audioHandler.currentObjectURL) URL.revokeObjectURL(audioHandler.currentObjectURL); visualizer.closeAudioContext(); });
}

document.addEventListener('DOMContentLoaded', initializePlayer);
