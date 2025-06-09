// js/mediaSessionHandler.js
// import * as audioHandler from './audioHandler.js'; // main.js から必要な関数を渡す
// import * as ui from './ui.js'; // main.js から必要な関数を渡す

let audioPlayerRef; // main.jsから参照を渡す
let togglePlayPauseAudioFunctionRef; // main.jsから参照を渡す

export function setupMediaSession(audioPlayerElement, togglePlayPauseFunc) {
    audioPlayerRef = audioPlayerElement;
    togglePlayPauseAudioFunctionRef = togglePlayPauseFunc;

    if ('mediaSession' in navigator) {
        console.log("Media Session API is available.");
        navigator.mediaSession.setActionHandler('play', () => {
            console.log("Media Session: Play action received.");
            if (audioPlayerRef && audioPlayerRef.paused) {
                togglePlayPauseAudioFunctionRef();
            }
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            console.log("Media Session: Pause action received.");
            if (audioPlayerRef && !audioPlayerRef.paused) {
                togglePlayPauseAudioFunctionRef();
            }
        });
        navigator.mediaSession.setActionHandler('stop', () => {
            console.log("Media Session: Stop action received.");
            if (audioPlayerRef) {
                audioPlayerRef.pause();
                audioPlayerRef.currentTime = 0;
                // ui.updatePlayPauseButtonVisuals(false); // main.jsのイベントリスナーに任せるか、ここで呼ぶか
                // ui.updateTimeDisplayOnPlayer(audioPlayerRef);
            }
            // ビジュアライザー停止も考慮 (visualizer.stopVisualizerRender())
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            console.log("Media Session: Seek backward action received.", details);
            if (audioPlayerRef) {
                audioPlayerRef.currentTime = Math.max(audioPlayerRef.currentTime - (details.seekOffset || 10), 0);
            }
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            console.log("Media Session: Seek forward action received.", details);
            if (audioPlayerRef) {
                audioPlayerRef.currentTime = Math.min(audioPlayerRef.currentTime + (details.seekOffset || 10), audioPlayerRef.duration);
            }
        });
    } else {
        console.log("Media Session API is not available.");
    }
}

export async function updateMediaSessionMetadata(tags) {
    if ('mediaSession' in navigator) {
        console.log("Updating Media Session metadata with:", tags);
        const artwork = [];
        if (tags.picture) {
            try {
                const { data, format } = tags.picture;
                let base64String = "";
                for (let i = 0; i < data.length; i++) {
                    base64String += String.fromCharCode(data[i]);
                }
                // Note: Creating a blob URL for MediaSession artwork might be cleaned up by the browser automatically.
                // If issues arise, consider managing these blob URLs lifecycle.
                const blob = await fetch(`data:${format};base64,${window.btoa(base64String)}`).then(res => res.blob());
                const artworkObjectURL = URL.createObjectURL(blob);
                artwork.push({ src: artworkObjectURL, sizes: '512x512', type: blob.type });
            } catch (e) {
                console.error("Error creating blob from picture data for Media Session:", e);
            }
        }

        navigator.mediaSession.metadata = new MediaMetadata({
            title: tags.title || 'タイトル不明',
            artist: tags.artist || 'アーティスト不明',
            album: tags.album || 'アルバム不明',
            artwork: artwork
        });
        console.log("Media Session metadata updated.");
    }
}

export function clearMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
        console.log("Media Session cleared.");
    }
}