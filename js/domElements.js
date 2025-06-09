// js/domElements.js
export const audioFileEl = document.getElementById('audioFile');
export const lrcFileEl = document.getElementById('lrcFile');
export const clearLrcBtn = document.getElementById('clearLrcBtn');
export let audioPlayer = document.getElementById('audioPlayer'); // ★ let に変更
export const audioPlayerContainer = document.getElementById('audioPlayerContainer'); // ★ audioPlayerの親要素

export const playPauseBtn = document.getElementById('playPauseBtn');
export const seekBar = document.getElementById('seekBar');
export const timeDisplay = document.getElementById('timeDisplay');
export const volumeBar = document.getElementById('volumeBar');
export const lyricsContainer = document.getElementById('lyricsContainer');
export const messageArea = document.getElementById('messageArea');

export const playIcon = document.getElementById('playIcon');
export const pauseIcon = document.getElementById('pauseIcon');
export const albumArtEl = document.getElementById('albumArt');
export const albumArtPlaceholderEl = document.getElementById('albumArtPlaceholder');
export const trackTitleContainerEl = document.getElementById('trackTitle');
export const trackArtistContainerEl = document.getElementById('trackArtist');
export const trackAlbumContainerEl = document.getElementById('trackAlbum');

export const fileTypeEl = document.getElementById('fileType');
export const sampleRateEl = document.getElementById('sampleRate');
export const bitRateEl = document.getElementById('bitRate');
export const fileSizeEl = document.getElementById('fileSize');

export let visualizerCanvas = document.getElementById('visualizerCanvas');
export function getVisualizerContext() {
    return visualizerCanvas ? visualizerCanvas.getContext('2d') : null;
}

// ★ audioPlayerを再生成し、新しい要素を返す関数を追加
export function recreateAudioPlayer() {
    if (!audioPlayerContainer) {
        console.error("[DOM] Audio player container (audioPlayerContainer) not found in HTML!");
        // コンテナがない場合は、現在のaudioPlayerをそのまま返すか、エラーを投げる
        // ここでは現在のものを返すが、HTMLに #audioPlayerContainer を追加することが推奨される
        return document.getElementById('audioPlayer');
    }
    
    const oldPlayerVolume = audioPlayer ? audioPlayer.volume : 0.5;
    const oldPlayerCrossOrigin = audioPlayer ? audioPlayer.crossOrigin : 'anonymous';

    if (audioPlayer && audioPlayer.parentNode === audioPlayerContainer) { // 親要素も確認
        audioPlayer.pause();
        audioPlayer.removeAttribute('src'); // Remove src attribute to release resources
        audioPlayer.load(); // Abort current media loading
        audioPlayerContainer.removeChild(audioPlayer); // DOMから削除
        console.log('[DOM] Old audioPlayer element removed from container.');
    } else if (audioPlayer) {
        console.warn("[DOM] audioPlayer's parentNode is not audioPlayerContainer, or audioPlayer is null. Cannot remove safely.");
    }


    const newAudioPlayer = document.createElement('audio');
    newAudioPlayer.id = 'audioPlayer'; // 同じIDを再利用
    newAudioPlayer.classList.add('hidden'); // スタイルを適用
    newAudioPlayer.crossOrigin = oldPlayerCrossOrigin;
    
    audioPlayerContainer.appendChild(newAudioPlayer); // 新しい要素をコンテナに追加
    audioPlayer = newAudioPlayer; // グローバル参照を更新
    audioPlayer.volume = oldPlayerVolume; // 音量を復元
    console.log('[DOM] audioPlayer element recreated, re-referenced, and appended to container.');
    return newAudioPlayer;
}