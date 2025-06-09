// js/ui.js
import * as dom from './domElements.js';
import { formatTime, formatFileSize } from './utils.js';

const marqueeTimeouts = new Map();
const marqueeAnimationEndListeners = new Map();

export function displayMetadata(tags) {
    const titleTextEl = dom.trackTitleContainerEl.querySelector('.marquee-child');
    const artistTextEl = dom.trackArtistContainerEl.querySelector('.marquee-child');
    const albumTextEl = dom.trackAlbumContainerEl.querySelector('.marquee-child');

    titleTextEl.textContent = tags.title || 'タイトル不明';
    artistTextEl.textContent = tags.artist || 'アーティスト不明';
    albumTextEl.textContent = tags.album || 'アルバム不明';
    dom.trackTitleContainerEl.title = tags.title || 'タイトル不明';
    dom.trackArtistContainerEl.title = tags.artist || 'アーティスト不明';
    dom.trackAlbumContainerEl.title = tags.album || 'アルバム不明';

    checkAndApplyMarquee(dom.trackTitleContainerEl, titleTextEl);
    checkAndApplyMarquee(dom.trackArtistContainerEl, artistTextEl);
    checkAndApplyMarquee(dom.trackAlbumContainerEl, albumTextEl);

    if (tags.picture) {
        dom.albumArtPlaceholderEl.classList.add('hidden');
        dom.albumArtEl.classList.remove('hidden');
        const { data, format } = tags.picture;
        let base64String = "";
        for (let i = 0; i < data.length; i++) base64String += String.fromCharCode(data[i]);
        dom.albumArtEl.src = `data:${format};base64,${window.btoa(base64String)}`;
    } else {
        resetAlbumArt(); // アルバムアートがない場合はプレースホルダー表示
    }
}

export function checkAndApplyMarquee(parentElement, textElement) {
    const existingListener = marqueeAnimationEndListeners.get(textElement);
    if (existingListener) {
        textElement.removeEventListener('animationend', existingListener);
        marqueeAnimationEndListeners.delete(textElement);
    }
    if (marqueeTimeouts.has(textElement)) {
        clearTimeout(marqueeTimeouts.get(textElement));
        marqueeTimeouts.delete(textElement);
    }

    textElement.classList.remove('start-scroll-setup', 'animate-scroll');
    parentElement.style.textOverflow = 'ellipsis';
    textElement.style.removeProperty('--animation-duration');
    textElement.style.removeProperty('--marquee-transform-x-target');
    textElement.style.paddingLeft = '0';
    textElement.style.transform = 'translateX(0px)';

    requestAnimationFrame(() => {
        // 要素が非表示の場合は何もしない
        if (parentElement.offsetParent === null) return;

        const parentWidth = parentElement.clientWidth;
        const textWidth = textElement.scrollWidth;

        if (textWidth > parentWidth) {
            const startMarqueeAnimation = () => {
                parentElement.style.textOverflow = 'clip';
                textElement.classList.add('start-scroll-setup');
                void textElement.offsetWidth; // Reflow to apply initial state
                textElement.classList.add('animate-scroll');

                const computedStyle = window.getComputedStyle(textElement);
                const fontSize = parseFloat(computedStyle.fontSize);
                const gapWidth = Math.max(20, 2.5 * fontSize); // End gap

                const transformTargetX = -(parentWidth + textWidth + gapWidth);
                textElement.style.setProperty('--marquee-transform-x-target', `${transformTargetX}px`);

                const effectiveScrollDistance = parentWidth + textWidth + gapWidth; // Total distance to animate
                const speed = 75; // pixels per second
                let duration = effectiveScrollDistance / speed;
                duration = Math.max(3, Math.min(duration, 20)); // Clamp duration
                
                textElement.style.setProperty('--animation-duration', `${duration}s`);
            };

            const animationEndHandler = () => {
                textElement.classList.remove('start-scroll-setup', 'animate-scroll');
                textElement.style.paddingLeft = '0'; // Reset padding
                textElement.style.transform = 'translateX(0px)'; // Reset transform
                const loopTimeoutId = setTimeout(startMarqueeAnimation, 2000); // Delay before restart
                marqueeTimeouts.set(textElement, loopTimeoutId);
            };
            
            textElement.addEventListener('animationend', animationEndHandler);
            marqueeAnimationEndListeners.set(textElement, animationEndHandler);

            const initialTimeoutId = setTimeout(startMarqueeAnimation, 2000); // Initial delay
            marqueeTimeouts.set(textElement, initialTimeoutId);
        }
    });
}


export function updateTimeDisplayOnPlayer(audioPlayerElement) {
    if (!dom.timeDisplay || !audioPlayerElement) return;
    const currentTime = audioPlayerElement.currentTime;
    const duration = audioPlayerElement.duration || 0; // NaNやInfinityを避ける
    dom.timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
}

export function updatePlayPauseButtonVisuals(isPlaying) {
    if (!dom.playIcon || !dom.pauseIcon) return;
    dom.playIcon.classList.toggle('hidden', isPlaying);
    dom.pauseIcon.classList.toggle('hidden', !isPlaying);
}

export function setAudioControlsEnabled(enabled) {
    if (dom.playPauseBtn) {
        dom.playPauseBtn.disabled = !enabled;
        dom.playPauseBtn.classList.toggle('disabled-button', !enabled);
    }
    if (dom.seekBar) {
        dom.seekBar.disabled = !enabled;
        if (!enabled) dom.seekBar.value = 0; // 無効化時にシークバーをリセット
    }
}

export function setClearLrcButtonEnabled(enabled) {
    if (dom.clearLrcBtn) {
        dom.clearLrcBtn.disabled = !enabled;
        dom.clearLrcBtn.classList.toggle('disabled-button', !enabled);
    }
}

export function resetFileInfoDisplay() {
    console.log('[UI] resetFileInfoDisplay called');
    if (dom.fileTypeEl) dom.fileTypeEl.textContent = 'N/A';
    if (dom.sampleRateEl) dom.sampleRateEl.textContent = 'N/A';
    if (dom.bitRateEl) dom.bitRateEl.textContent = 'N/A';
    if (dom.fileSizeEl) dom.fileSizeEl.textContent = 'N/A';
}

export function updateFileInfoDisplay(currentFile, audioDuration, audioContextSampleRate, currentFileSize) {
    console.log('[UI] updateFileInfoDisplay called with:', { currentFile, audioDuration, audioContextSampleRate, currentFileSize });
    // ファイル形式
    if (dom.fileTypeEl && currentFile) {
        const fileName = currentFile.name;
        const extension = fileName.split('.').pop();
        if (extension && extension !== fileName) {
            dom.fileTypeEl.textContent = extension.toUpperCase();
        } else if (currentFile.type && currentFile.type.trim() !== "") {
            dom.fileTypeEl.textContent = currentFile.type.toUpperCase().replace('AUDIO/', '');
        } else {
            dom.fileTypeEl.textContent = '不明';
        }
    } else if (dom.fileTypeEl) {
        dom.fileTypeEl.textContent = 'N/A';
    }

    // サンプルレート
    console.log('[UI] updateFileInfoDisplay - Received audioContextSampleRate:', audioContextSampleRate);
    if (dom.sampleRateEl) {
        if (audioContextSampleRate) { // nullや0でないことを確認
            dom.sampleRateEl.textContent = `${audioContextSampleRate / 1000} kHz (再生時)`;
            console.log('[UI] Sample rate displayed:', dom.sampleRateEl.textContent);
        } else {
            console.warn('[UI] Sample rate is null, undefined or zero, not updating display from here. Current text:', dom.sampleRateEl.textContent);
             // N/Aに戻したい場合は resetFileInfoDisplay() を呼ぶか、ここで明示的にN/Aを設定。
             // 現状は resetFileInfoDisplay() でN/Aになるため、ここでは何もしないでおくか、
             // もし既に有効な値が表示されていて audioContextSampleRate が null で来た場合に
             // N/A に戻すべきか検討。安全策として N/A に戻すのもあり。
             // dom.sampleRateEl.textContent = 'N/A';
        }
    }

    // ビットレート
    if (dom.bitRateEl) {
        const isCurrentFileValid = !!(currentFile && typeof currentFile.size === 'number' && currentFile.size > 0);
        const isDurationValid = !!(typeof audioDuration === 'number' && !isNaN(audioDuration) && audioDuration > 0);
        if (isCurrentFileValid && isDurationValid) {
            const fileSizeInBits = currentFile.size * 8;
            const calculatedBitRate = Math.round(fileSizeInBits / audioDuration / 1000);
            dom.bitRateEl.textContent = `${calculatedBitRate} kbps`;
        } else {
            dom.bitRateEl.textContent = 'N/A';
        }
    }

    // ファイルサイズ
    if (dom.fileSizeEl) {
        if (currentFileSize > 0) {
            dom.fileSizeEl.textContent = formatFileSize(currentFileSize);
        } else if (currentFile && currentFile.size > 0) { // currentFileSizeが未更新の場合のフォールバック
            dom.fileSizeEl.textContent = formatFileSize(currentFile.size);
        }
        // ここにあった不要な '*' は削除済み
        else {
            dom.fileSizeEl.textContent = 'N/A';
        }
    }
}

export function resetAlbumArt() {
    if(dom.albumArtEl && dom.albumArtPlaceholderEl) {
        dom.albumArtEl.classList.add('hidden');
        dom.albumArtEl.src = ''; // srcをクリアしてメモリ解放を期待
        dom.albumArtPlaceholderEl.classList.remove('hidden');
    }
}

export function initialMetadataDisplay() {
    const initialTags = { title: '曲名未選択', artist: 'アーティスト不明', album: 'アルバム不明' };
    displayMetadata(initialTags); // これによりマーキーも初期化される
}