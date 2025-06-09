// js/audioHandler.js
import * as dom from './domElements.js';
import * as ui from './ui.js';
import * as lyrics from './lyricsHandler.js';
import * as visualizer from './visualizer.js';
import * as mediaSession from './mediaSessionHandler.js';
import { setSuccessMessage, setErrorMessage, setWarningMessage } from './utils.js';

export let currentFile = null;
export let currentObjectURL = null;
export let currentFileSize = 0;
export let audioLoaded = false;
export let isSeeking = false;
let jsmediatags;
let mainModuleRef;

// isSeekingを外部から変更するための関数
export function setIsSeeking(seeking) {
    isSeeking = seeking;
}

export function initializeJsMediaTags(tagsInstance) {
    jsmediatags = tagsInstance;
}
export function initializeAudioHandler(main) {
    mainModuleRef = main;
}


export function handleAudioFileChange(event) {
    const file = event.target.files[0];
    console.log('[AudioHandler] handleAudioFileChange - File selected:', file ? file.name : 'No file');

    if (dom.audioPlayer && dom.audioPlayer.src && !dom.audioPlayer.paused) {
        dom.audioPlayer.pause();
    }
    if (currentObjectURL) {
        URL.revokeObjectURL(currentObjectURL);
        console.log("[AudioHandler] Previous Object URL revoked:", currentObjectURL);
        currentObjectURL = null;
    }
    
    // <audio>要素を再生成し、参照を更新する
    const newAudioPlayerElement = dom.recreateAudioPlayer(); 
    
    // main.jsに新しいaudio要素のイベントリスナー再設定を依頼
    if (mainModuleRef && typeof mainModuleRef.setupAudioPlayerEventListeners === 'function') {
        mainModuleRef.setupAudioPlayerEventListeners(newAudioPlayerElement);
    } else {
        console.error("[AudioHandler] mainModuleRef or setupAudioPlayerEventListeners is not available for re-attaching listeners!");
    }
    // main.jsにMediaSessionのターゲット更新を依頼
    if (mainModuleRef && typeof mainModuleRef.updateMediaSessionTarget === 'function') {
        mainModuleRef.updateMediaSessionTarget(newAudioPlayerElement);
    } else {
        console.error("[AudioHandler] mainModuleRef or updateMediaSessionTarget is not available for MediaSession!");
    }

    audioLoaded = false;
    currentFile = null;
    currentFileSize = 0;

    visualizer.resetVisualizerState();
    lyrics.resetLyricsUI();
    ui.resetFileInfoDisplay();
    ui.resetAlbumArt();
    ui.initialMetadataDisplay();
    ui.updateTimeDisplayOnPlayer(dom.audioPlayer); // 新しいdom.audioPlayerを参照
    ui.setAudioControlsEnabled(false);
    
    if (file) {
        currentFile = file;
        currentFileSize = file.size;
        currentObjectURL = URL.createObjectURL(file);
        dom.audioPlayer.src = currentObjectURL;
        console.log("[AudioHandler] New audio file selected. src set to Object URL:", currentObjectURL, "on element:", dom.audioPlayer);
        setSuccessMessage(dom.messageArea, `${file.name} を選択しました。読み込み中...`);

        if (jsmediatags) {
            jsmediatags.read(file, {
                onSuccess: (tag) => {
                    console.log('[AudioHandler] jsmediatags - Metadata loaded successfully:', tag.tags);
                    ui.displayMetadata(tag.tags);
                    mediaSession.updateMediaSessionMetadata(tag.tags);
                    lyrics.loadEmbeddedLyrics(tag.tags);
                },
                onError: (error) => {
                    console.error('[AudioHandler] jsmediatags - Metadata loading error:', error);
                    ui.initialMetadataDisplay();
                    mediaSession.updateMediaSessionMetadata({});
                    lyrics.resetLyricsUI();
                    setErrorMessage(dom.messageArea, 'メタデータの読み込みに失敗しました。');
                }
            });
        } else {
            console.error("[AudioHandler] jsmediatags is not initialized!");
            setErrorMessage(dom.messageArea, "メタデータ解析ライブラリが未初期化です。");
        }
    } else {
        console.log("[AudioHandler] No file selected or selection cancelled.");
        if (dom.audioPlayer) dom.audioPlayer.src = "";
        setWarningMessage(dom.messageArea, "音声ファイルが選択されていません。");
    }
}


export async function togglePlayPauseAudio() {
    console.log('[AudioHandler] togglePlayPauseAudio called. audioLoaded:', audioLoaded, 'Player src:', dom.audioPlayer ? dom.audioPlayer.src : 'No Player');
    if (!dom.audioPlayer || !dom.audioPlayer.src) {
        setWarningMessage(dom.messageArea, "再生する音声ファイルが読み込まれていません。");
        return;
    }

    // ユーザー操作時に AudioContext の状態を確実にする
    await visualizer.ensureAudioContextResumed();

    if (dom.audioPlayer.paused || dom.audioPlayer.ended) {
        console.log('[AudioHandler] Attempting to play audio.');
        // isVisualizerReadyはsourceNodeの存在も見るので、再生前にセットアップを試みる
        if (!visualizer.isVisualizerReady()) {
            console.log('[AudioHandler] Visualizer not ready or needs re-setup, attempting setup before play.');
            // audioElementは再生成されたdom.audioPlayerを渡す
            if (!visualizer.setupVisualizer(dom.audioPlayer)) {
                 console.warn("[AudioHandler] Visualizer setup failed, but attempting to play audio anyway.");
            }
        }
        try {
            await dom.audioPlayer.play(); // これが 'play' イベントをトリガーする
        } catch (e) {
            console.error("[AudioHandler] Playback error:", e);
            setErrorMessage(dom.messageArea, `再生エラー: ${e.message}`);
            ui.updatePlayPauseButtonVisuals(false);
        }
    } else {
        console.log('[AudioHandler] Attempting to pause audio.');
        dom.audioPlayer.pause(); // これが 'pause' イベントをトリガーする
    }
}

export function handleAudioPlay() {
    console.log("[AudioHandler] Event: play. Current time:", dom.audioPlayer.currentTime);
    ui.updatePlayPauseButtonVisuals(true);

    // 再生が開始されたら、ビジュアライザーが準備できていなければセットアップし、描画を開始する
    if (!visualizer.isVisualizerReady()) {
        console.log('[AudioHandler] Visualizer not ready on play event, attempting setup.');
        visualizer.setupVisualizer(dom.audioPlayer);
    }
    visualizer.startVisualizerRender();

    console.log('[AudioHandler] handleAudioPlay - Updating file info for sample rate.');
    ui.updateFileInfoDisplay(currentFile, dom.audioPlayer.duration, visualizer.getAudioContextSampleRate(), currentFileSize);

    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "playing";
    }
}

export function handleAudioPause() {
    console.log("[AudioHandler] Event: pause. Current time:", dom.audioPlayer.currentTime);
    ui.updatePlayPauseButtonVisuals(false);
    visualizer.stopVisualizerRender();
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "paused";
    }
}

export function handleAudioEnded() {
    console.log("[AudioHandler] Event: ended.");
    ui.updatePlayPauseButtonVisuals(false);
    visualizer.stopVisualizerRender();
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "none";
    }
}

export function handleAudioLoadedMetadata() {
    console.log("[AudioHandler] Event: loadedmetadata. Duration:", dom.audioPlayer.duration);
    if (dom.seekBar) dom.seekBar.max = dom.audioPlayer.duration;
    ui.updateTimeDisplayOnPlayer(dom.audioPlayer);

    audioLoaded = true;
    ui.setAudioControlsEnabled(true);

    console.log('[AudioHandler] loadedmetadata - Attempting to update file info.');
    ui.updateFileInfoDisplay(currentFile, dom.audioPlayer.duration, visualizer.getAudioContextSampleRate(), currentFileSize);

    if (dom.messageArea.textContent.includes("読み込み中")) {
         setSuccessMessage(dom.messageArea, `${currentFile ? currentFile.name : 'ファイル'}の読み込み完了。`);
    }
}

export function handleAudioTimeUpdate() {
    if (!isSeeking) {
        if (dom.seekBar) {
            dom.seekBar.value = dom.audioPlayer.currentTime;
        }
    }
    ui.updateTimeDisplayOnPlayer(dom.audioPlayer);
    if (lyrics.lrcData.length > 0) {
        lyrics.updateLyricsHighlight(dom.audioPlayer.currentTime);
    }
}

export function handleAudioCanPlay() {
    console.log("[AudioHandler] Event: canplay. Media is ready to start playing.");
    if (audioLoaded) {
        console.log('[AudioHandler] canplay - Attempting to update file info again (for sample rate robustness).');
        ui.updateFileInfoDisplay(currentFile, dom.audioPlayer.duration, visualizer.getAudioContextSampleRate(), currentFileSize);
    }
}