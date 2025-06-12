// js/audioHandler.js
import * as dom from './domElements.js';
import * as ui from './ui.js';
import * as lyrics from './lyricsHandler.js';
import * as visualizer from './visualizer.js';
import * as mediaSession from './mediaSessionHandler.js';
import * as audioHeaderParser from './audioHeaderParser.js'; // ヘッダー解析モジュール
import { setSuccessMessage, setErrorMessage, setWarningMessage, setInfoMessage } from './utils.js';

export let currentFile = null;
export let currentObjectURL = null;
export let currentFileSize = 0;
export let audioLoaded = false;
export let isSeeking = false;
export let isFileLoading = false; 

// ファイルのメタデータを保持するためのグローバル変数
export let fileBitRate = null;
export let fileBitDepth = null;
export let fileSampleRate = null; // ★ ファイルのサンプリングレート
export let fileChannels = null;
export let fileDuration = null; // decodeAudioDataで取得したdurationを格納

let jsmediatags;
let mainModuleRef;

export function setIsSeeking(seeking) {
    isSeeking = seeking;
}

export function initializeJsMediaTags(tagsInstance) {
    jsmediatags = tagsInstance;
}
export function initializeAudioHandler(main) {
    mainModuleRef = main;
}

// handleAudioFileChange を async 関数に変更
export async function handleAudioFileChange(event) {
    const file = event.target.files[0];
    console.log('[AudioHandler] handleAudioFileChange - File selected:', file ? file.name : 'No file');
    
    isFileLoading = true; 
    
    if (dom.audioPlayer && dom.audioPlayer.src && !dom.audioPlayer.paused) {
        dom.audioPlayer.pause();
    }
    if (currentObjectURL) {
        URL.revokeObjectURL(currentObjectURL);
        console.log("[AudioHandler] Previous Object URL revoked:", currentObjectURL);
        currentObjectURL = null;
    }
    
    const newAudioPlayerElement = dom.recreateAudioPlayer(); 
    
    if (mainModuleRef && typeof mainModuleRef.setupAudioPlayerEventListeners === 'function') {
        mainModuleRef.setupAudioPlayerEventListeners(newAudioPlayerElement);
    } else {
        console.error("[AudioHandler] mainModuleRef or setupAudioPlayerEventListeners is not available for re-attaching listeners!");
    }
    if (mainModuleRef && typeof mainModuleRef.updateMediaSessionTarget === 'function') {
        mainModuleRef.updateMediaSessionTarget(newAudioPlayerElement);
    } else {
        console.error("[AudioHandler] mainModuleRef or updateMediaSessionTarget is not available for MediaSession!");
    }

    audioLoaded = false;
    currentFile = null;
    currentFileSize = 0;

    // グローバル変数を初期化
    fileBitRate = null;
    fileBitDepth = null;
    fileSampleRate = null;
    fileChannels = null;
    fileDuration = null; 

    visualizer.resetVisualizerState();
    lyrics.resetLyricsUI();
    ui.resetFileInfoDisplay(); // これでビット深度/ファイルSR/チャンネル数表示もリセットされる
    ui.resetAlbumArt();
    ui.initialMetadataDisplay();
    ui.updateTimeDisplayOnPlayer(dom.audioPlayer);
    ui.setAudioControlsEnabled(false);
    
    if (file) {
        currentFile = file;
        currentFileSize = file.size;
        currentObjectURL = URL.createObjectURL(file);
        dom.audioPlayer.src = currentObjectURL;
        console.log("[AudioHandler] New audio file selected. src set to Object URL:", currentObjectURL, "on element:", dom.audioPlayer);
        setInfoMessage(dom.messageArea, `${file.name} を読み込んでいます...`); // ユーザーに通知

        // ★jsmediatagsの読み込みと並行して、オーディオヘッダー解析も開始 (async/awaitで同期的に待つ)
        let headerInfoPromise = null;
        if (file) {
            headerInfoPromise = audioHeaderParser.parseAudioHeader(file)
                .catch(headerError => {
                    console.warn("[AudioHandler] Manual header parsing failed:", headerError.message);
                    return null; // エラー時はnullを返す
                });
        }

        if (jsmediatags) {
            jsmediatags.read(file, {
                onSuccess: async (tag) => { // async に変更
                    console.log('[AudioHandler] jsmediatags - Metadata loaded successfully:', tag.tags);
                    
                    // jsmediatagsからの情報と、ヘッダー解析からの情報をマージするためのオブジェクト
                    let mergedMetadata = { ...tag.tags }; // jsmediatagsの結果をベースにする

                    // ★ヘッダー解析結果を待機し、jsmediatagsで未取得の情報を補完
                    if (headerInfoPromise) {
                        const headerInfo = await headerInfoPromise; // ここで解決を待つ
                        console.log("[AudioHandler] Manual header parsing result (after jsmediatags):", headerInfo);
                        
                        if (headerInfo) {
                            // ヘッダー情報でメタデータを補完 (jsmediatagsで取得できていなければ)
                            if (headerInfo.title && !mergedMetadata.title) {
                                mergedMetadata.title = headerInfo.title;
                                console.log(`[AudioHandler Debug] Title補完 (Header): ${headerInfo.title}`);
                            }
                            if (headerInfo.artist && !mergedMetadata.artist) {
                                mergedMetadata.artist = headerInfo.artist;
                                console.log(`[AudioHandler Debug] Artist補完 (Header): ${headerInfo.artist}`);
                            }
                            if (headerInfo.album && !mergedMetadata.album) {
                                mergedMetadata.album = headerInfo.album;
                                console.log(`[AudioHandler Debug] Album補完 (Header): ${headerInfo.album}`);
                            }

                            // 既存の数値情報補完もここで行う
                            if (!fileSampleRate && headerInfo.sampleRate) { // ★ fileSampleRate にも補完
                                fileSampleRate = headerInfo.sampleRate;
                                console.log(`[AudioHandler Debug] SR補完 (File): ${fileSampleRate}`);
                            }
                            if (!fileBitDepth && headerInfo.bitsPerSample) {
                                fileBitDepth = headerInfo.bitsPerSample;
                                console.log(`[AudioHandler Debug] BPS補完: ${fileBitDepth}`);
                            }
                            if (!fileChannels && headerInfo.channels) { 
                                fileChannels = headerInfo.channels;
                                console.log(`[AudioHandler Debug] Ch補完: ${fileChannels}`);
                            }
                            if (!fileBitRate && headerInfo.bitRate) { // headerInfoから直接bitRateが取得できた場合
                                fileBitRate = headerInfo.bitRate;
                                console.log(`[AudioHandler Debug] BitRate補完: ${fileBitRate} kbps`);
                            }
                        }
                    }
                    
                    // 最終的なメタデータをUIに表示
                    ui.displayMetadata(mergedMetadata); // マージされたメタデータを渡す
                    mediaSession.updateMediaSessionMetadata(mergedMetadata); // Media Sessionも同様に更新
                    lyrics.loadEmbeddedLyrics(tag.tags); // 歌詞はjsmediatagsから直接（通常WAVには歌詞がないためそのまま）

                    // ★decodeAudioData で duration を確実に取得するロジック
                    if (currentFile) {
                        try {
                            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                            const arrayBuffer = await currentFile.arrayBuffer(); // FileオブジェクトからArrayBufferを直接読み込む
                            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                            fileDuration = audioBuffer.duration;
                            // もしfileSampleRateがまだ未設定なら、ここでAudioBufferのsampleRateを使用
                            if (!fileSampleRate && audioBuffer.sampleRate) {
                                fileSampleRate = audioBuffer.sampleRate;
                                console.log(`[AudioHandler Debug] SR補完 (AudioBuffer): ${fileSampleRate}`);
                            }
                            console.log(`[AudioHandler] decodeAudioData: Successfully obtained duration: ${fileDuration.toFixed(3)} seconds`);
                            audioContext.close(); // 不要になったAudioContextは閉じる
                        } catch (e) {
                            console.warn(`[AudioHandler] decodeAudioData failed to get duration: ${e.message}. Falling back to dom.audioPlayer.duration.`);
                            if (dom.audioPlayer && typeof dom.audioPlayer.duration === 'number' && isFinite(dom.audioPlayer.duration) && dom.audioPlayer.duration > 0) {
                                fileDuration = dom.audioPlayer.duration;
                                console.log(`[AudioHandler] Falling back to dom.audioPlayer.duration: ${fileDuration.toFixed(3)} seconds`);
                            } else {
                                fileDuration = null; // 取得できなかった場合はnull
                            }
                        }
                    } else {
                        fileDuration = null; // ファイルがない場合はnull
                    }

                    // ★BitRateの計算フォールバックの優先順位を調整 (durationはfileDurationを使用)
                    console.log(`[BitRate Calculation Debug] Current fileDuration (from Global/decodeAudioData): ${fileDuration}, isNaN: ${isNaN(fileDuration)}, isFinite: ${isFinite(fileDuration)}`);

                    if ((!fileBitRate || fileBitRate === 0) && currentFile && typeof currentFile.size === 'number' && currentFile.size > 0 && 
                        fileDuration && typeof fileDuration === 'number' && !isNaN(fileDuration) && fileDuration > 0 && isFinite(fileDuration)) {
                        
                        const fileSizeInBits = currentFile.size * 8; 
                        console.log(`[BitRate Calculation Debug] File Size (Bytes): ${currentFile.size}, Duration (seconds): ${fileDuration.toFixed(3)}`);

                        fileBitRate = Math.round(fileSizeInBits / fileDuration / 1000); // bps -> kbps
                        console.log(`[AudioHandler] Calculated (Average) Bit Rate: ${fileBitRate} kbps (from file size and duration)`);
                    } else if (!fileBitRate) { // 全ての試みが失敗した場合
                        fileBitRate = null; // 明示的にnullにしておく
                    }
                    
                    console.log("[AudioHandler] Final Detected File Bit Depth:", fileBitDepth, "Bit Rate:", fileBitRate, "File Sample Rate:", fileSampleRate, "File Channels:", fileChannels, "File Duration (Internal):", fileDuration); 

                    // ui.updateFileInfoDisplay は handleAudioLoadedMetadata や canplay からも呼ばれるので、
                    // ここでは一旦、必要な情報（タイトル、アーティスト、アルバムアートなど）だけUIに反映
                    // ファイル情報（SR, BPS, Ch, BitRate）は handleAudioLoadedMetadata で最終的に更新される

                },
                onError: (error) => {
                    console.error('[AudioHandler] jsmediatags - Metadata loading error:', error);
                    ui.initialMetadataDisplay();
                    mediaSession.updateMediaSessionMetadata({});
                    lyrics.resetLyricsUI();
                    setErrorMessage(dom.messageArea, 'メタデータの読み込みに失敗しました。');
                    
                    // jsmediatagsが失敗した場合でもヘッダー解析結果を待機し、情報を取得
                    if (headerInfoPromise) {
                        headerInfoPromise.then(headerInfo => {
                            let fallbackMetadata = {};
                            if (headerInfo) {
                                fileSampleRate = headerInfo.sampleRate || fileSampleRate;
                                fileBitDepth = headerInfo.bitsPerSample || fileBitDepth;
                                fileChannels = headerInfo.channels || fileChannels;
                                fileBitRate = headerInfo.bitRate || fileBitRate;

                                if (headerInfo.title) fallbackMetadata.title = headerInfo.title;
                                if (headerInfo.artist) fallbackMetadata.artist = headerInfo.artist;
                                if (headerInfo.album) fallbackMetadata.album = headerInfo.album;

                                console.log("[AudioHandler] Fallback to header info after jsmediatags error:", { fileSampleRate, fileBitDepth, fileChannels, fileBitRate, ...fallbackMetadata });
                            }
                            // durationの取得も試みる
                            if (currentFile) {
                                (async () => {
                                    try {
                                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                        const arrayBuffer = await currentFile.arrayBuffer();
                                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                                        fileDuration = audioBuffer.duration;
                                        // もしfileSampleRateがまだ未設定なら、ここでAudioBufferのsampleRateを使用
                                        if (!fileSampleRate && audioBuffer.sampleRate) {
                                            fileSampleRate = audioBuffer.sampleRate;
                                            console.log(`[AudioHandler Debug] SR補完 (AudioBuffer - Fallback): ${fileSampleRate}`);
                                        }
                                        console.log(`[AudioHandler] decodeAudioData (after jsmediatags error): Successfully obtained duration: ${fileDuration.toFixed(3)} seconds`);
                                        audioContext.close();
                                    } catch (e) {
                                        console.warn(`[AudioHandler] decodeAudioData failed (after jsmediatags error): ${e.message}`);
                                        if (dom.audioPlayer && typeof dom.audioPlayer.duration === 'number' && isFinite(dom.audioPlayer.duration) && dom.audioPlayer.duration > 0) {
                                            fileDuration = dom.audioPlayer.duration;
                                        } else {
                                            fileDuration = null;
                                        }
                                    }
                                    // 最終的なUI更新
                                    ui.displayMetadata(fallbackMetadata); // フォールバックのメタデータを渡す
                                    mediaSession.updateMediaSessionMetadata(fallbackMetadata);
                                    ui.updateFileInfoDisplay(currentFile, fileDuration, visualizer.getAudioContextSampleRate(), currentFileSize, fileBitRate, fileBitDepth, fileSampleRate, fileChannels);
                                })();
                            } else {
                                ui.displayMetadata(fallbackMetadata); // フォールバックのメタデータを渡す
                                mediaSession.updateMediaSessionMetadata(fallbackMetadata);
                                ui.updateFileInfoDisplay(currentFile, fileDuration, visualizer.getAudioContextSampleRate(), currentFileSize, null, null, null, null);
                            }
                        });
                    } else {
                        // headerInfoPromiseがない、またはエラーも発生しなかった場合
                        fileBitRate = null; fileBitDepth = null; fileSampleRate = null; fileChannels = null; fileDuration = null; 
                        ui.updateFileInfoDisplay(currentFile, fileDuration, visualizer.getAudioContextSampleRate(), currentFileSize, null, null, null, null);
                    }
                }
            });
        } else {
            console.error("[AudioHandler] jsmediatags is not initialized!");
            setErrorMessage(dom.messageArea, "メタデータ解析ライブラリが未初期化です。");
            // jsmediatagsが初期化されていない場合でもヘッダー解析結果を待機
            if (headerInfoPromise) {
                const headerInfo = await headerInfoPromise;
                let fallbackMetadata = {};
                if (headerInfo) {
                    fileSampleRate = headerInfo.sampleRate;
                    fileBitDepth = headerInfo.bitsPerSample;
                    fileChannels = headerInfo.channels;
                    fileBitRate = headerInfo.bitRate;

                    if (headerInfo.title) fallbackMetadata.title = headerInfo.title;
                    if (headerInfo.artist) fallbackMetadata.artist = headerInfo.artist;
                    if (headerInfo.album) fallbackMetadata.album = headerInfo.album;

                    console.log("[AudioHandler] Fallback to header info (jsmediatags not initialized):", { fileSampleRate, fileBitDepth, fileChannels, fileBitRate, ...fallbackMetadata });
                }
                // durationも取得
                if (currentFile) {
                    try {
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const arrayBuffer = await currentFile.arrayBuffer();
                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                        fileDuration = audioBuffer.duration;
                        // もしfileSampleRateがまだ未設定なら、ここでAudioBufferのsampleRateを使用
                        if (!fileSampleRate && audioBuffer.sampleRate) {
                            fileSampleRate = audioBuffer.sampleRate;
                            console.log(`[AudioHandler Debug] SR補完 (AudioBuffer - jsmediatags not init): ${fileSampleRate}`);
                        }
                        console.log(`[AudioHandler] decodeAudioData (jsmediatags not init): Successfully obtained duration: ${fileDuration.toFixed(3)} seconds`);
                        audioContext.close();
                    } catch (e) {
                        console.warn(`[AudioHandler] decodeAudioData failed (jsmediatags not init): ${e.message}`);
                        if (dom.audioPlayer && typeof dom.audioPlayer.duration === 'number' && isFinite(dom.audioPlayer.duration) && dom.audioPlayer.duration > 0) {
                            fileDuration = dom.audioPlayer.duration;
                        } else {
                            fileDuration = null;
                        }
                    }
                }
                ui.displayMetadata(fallbackMetadata); // フォールバックのメタデータを渡す
                mediaSession.updateMediaSessionMetadata(fallbackMetadata);
            } else {
                fileBitRate = null; fileBitDepth = null; fileSampleRate = null; fileChannels = null; fileDuration = null; 
            }
            ui.updateFileInfoDisplay(currentFile, fileDuration, visualizer.getAudioContextSampleRate(), currentFileSize, fileBitRate, fileBitDepth, fileSampleRate, fileChannels);
        }
    } else {
        console.log("[AudioHandler] No file selected or selection cancelled.");
        if (dom.audioPlayer) dom.audioPlayer.src = "";
        setWarningMessage(dom.messageArea, "音声ファイルが選択されていません。");
        isFileLoading = false; 
        // ファイル選択がキャンセルされた場合も、グローバル変数をクリアし、UIをリセット
        fileBitRate = null; fileBitDepth = null; fileSampleRate = null; fileChannels = null; fileDuration = null; 
        ui.updateFileInfoDisplay(currentFile, fileDuration, visualizer.getAudioContextSampleRate(), currentFileSize, null, null, null, null);
    }
}


export async function togglePlayPauseAudio() {
    console.log('[AudioHandler] togglePlayPauseAudio called. audioLoaded:', audioLoaded, 'Player src:', dom.audioPlayer ? dom.audioPlayer.src : 'No Player');
    if (!dom.audioPlayer || !dom.audioPlayer.src) {
        setWarningMessage(dom.messageArea, "再生する音声ファイルが読み込まれていません。");
        return;
    }

    await visualizer.ensureAudioContextResumed();

    if (dom.audioPlayer.paused || dom.audioPlayer.ended) {
        console.log('[AudioHandler] Attempting to play audio.');
        if (!visualizer.isVisualizerReady()) {
            console.log('[AudioHandler] Visualizer not ready or needs re-setup, attempting setup before play.');
            // ★修正: visualizer.setupVisualizer に fileSampleRate を渡す
            if (!visualizer.setupVisualizer(dom.audioPlayer, fileSampleRate)) { 
                   console.warn("[AudioHandler] Visualizer setup failed, but attempting to play audio anyway.");
            }
        }
        try {
            await dom.audioPlayer.play();
        } catch (e) {
            console.error("[AudioHandler] Playback error:", e);
            setErrorMessage(dom.messageArea, `再生エラー: ${e.message}`);
            ui.updatePlayPauseButtonVisuals(false);
        }
    } else {
        console.log('[AudioHandler] Attempting to pause audio.');
        dom.audioPlayer.pause();
    }
}

export function handleAudioPlay() {
    console.log("[AudioHandler] Event: play. Current time:", dom.audioPlayer.currentTime);
    ui.updatePlayPauseButtonVisuals(true);

    if (!visualizer.isVisualizerReady()) {
        console.log('[AudioHandler] Visualizer not ready on play event, attempting setup.');
        // ★修正: visualizer.setupVisualizer に fileSampleRate を渡す
        visualizer.setupVisualizer(dom.audioPlayer, fileSampleRate); 
    }
    visualizer.startVisualizerRender();

    console.log('[AudioHandler] handleAudioPlay - Updating file info for sample rate.');
    // グローバル変数 `fileBitRate` `fileBitDepth` `fileSampleRate` `fileChannels` `fileDuration` を渡す
    ui.updateFileInfoDisplay(currentFile, fileDuration, visualizer.getAudioContextSampleRate(), currentFileSize, fileBitRate, fileBitDepth, fileSampleRate, fileChannels);

    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "playing";
        // durationはfileDurationを使用し、MediaSessionAPIに渡す
        if (fileDuration && isFinite(fileDuration)) {
            mediaSession.updatePositionState(dom.audioPlayer);
        }
    }
}

export function handleAudioPause() {
    console.log("[AudioHandler] Event: pause. Current time:", dom.audioPlayer.currentTime);
    ui.updatePlayPauseButtonVisuals(false);
    visualizer.stopVisualizerRender();
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "paused";
        // durationはfileDurationを使用し、MediaSessionAPIに渡す
        if (fileDuration && isFinite(fileDuration)) {
            mediaSession.updatePositionState(dom.audioPlayer);
        }
    }
}

export function handleAudioEnded() {
    console.log("[AudioHandler] Event: ended.");
    ui.updatePlayPauseButtonVisuals(false);
    visualizer.stopVisualizerRender();
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "none";
        // durationはfileDurationを使用し、MediaSessionAPIに渡す
        if (fileDuration && isFinite(fileDuration)) {
            mediaSession.updatePositionState(dom.audioPlayer);
        }
    }
}

export function handleAudioLoadedMetadata() {
    console.log("[AudioHandler] Event: loadedmetadata. Duration:", dom.audioPlayer.duration);
    // audioPlayer.duration は初期段階で正確でない場合があるため、fileDuration を優先
    if (dom.seekBar) {
        dom.seekBar.max = fileDuration && isFinite(fileDuration) ? fileDuration : dom.audioPlayer.duration;
    }
    ui.updateTimeDisplayOnPlayer(dom.audioPlayer);

    audioLoaded = true;
    ui.setAudioControlsEnabled(true);

    console.log('[AudioHandler] loadedmetadata - Attempting to update file info (Final Update).');
    // グローバル変数 `fileBitRate` `fileBitDepth` `fileSampleRate` `fileChannels` `fileDuration` を渡す
    ui.updateFileInfoDisplay(currentFile, fileDuration, visualizer.getAudioContextSampleRate(), currentFileSize, fileBitRate, fileBitDepth, fileSampleRate, fileChannels);

    if (dom.messageArea.textContent.includes("読み込んでいます")) {
        setSuccessMessage(dom.messageArea, `${currentFile ? currentFile.name : 'ファイル'}の読み込み完了。`);
    }

    isFileLoading = false; // 読み込み完了

    // Media Session APIへの更新 (ここでは fileDuration を使う)
    if (fileDuration && isFinite(fileDuration) && fileDuration > 0) {
        console.log("[AudioHandler] LoadedMetadata: Updating Media Session position state with valid duration.");
        mediaSession.updatePositionState(dom.audioPlayer);
    } else {
        console.warn("[AudioHandler] LoadedMetadata: Duration is not valid (>0 and finite). Skipping Media Session position update.");
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
    // durationはfileDurationを使用し、MediaSessionAPIに渡す
    if (fileDuration && isFinite(fileDuration)) {
        // console.log(`[MediaSession Debug] Time Update: CurrentTime=${dom.audioPlayer.currentTime.toFixed(1)}, Duration=${fileDuration.toFixed(1)}`); // デバッグ用
        mediaSession.updatePositionState(dom.audioPlayer);
    } else {
        // console.warn(`[MediaSession Debug] Time Update: Duration is not valid (>0 and finite). Skipping Media Session position update.`); // デバッグ用
    }
}

export function handleAudioCanPlay() {
    console.log("[AudioHandler] Event: canplay. Media is ready to start playing.");
    if (audioLoaded) {
        console.log('[AudioHandler] canplay - Attempting to update file info again (for sample rate robustness).');
        // グローバル変数 `fileBitRate` `fileBitDepth` `fileSampleRate` `fileChannels` `fileDuration` を渡す
        ui.updateFileInfoDisplay(currentFile, fileDuration, visualizer.getAudioContextSampleRate(), currentFileSize, fileBitRate, fileBitDepth, fileSampleRate, fileChannels);
    }
    // durationはfileDurationを使用し、MediaSessionAPIに渡す
    if (fileDuration && isFinite(fileDuration)) {
        console.log("[AudioHandler] CanPlay: Updating Media Session position state with valid duration.");
        mediaSession.updatePositionState(dom.audioPlayer);
    } else {
        console.warn("[MediaSession Debug] CanPlay: Duration is not valid (>0 and finite). Skipping Media Session position update.");
    }
}