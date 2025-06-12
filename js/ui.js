// js/ui.js

import * as dom from './domElements.js'; // DOM要素を扱うモジュールをインポート
import { formatFileSize, formatTime } from './utils.js'; // ファイルサイズと時間フォーマットのユーティリティ関数をインポート

/**
 * トラックのメタデータ（タイトル、アーティスト、アルバム、アルバムアート）をUIに表示します。
 * @param {object} tags - jsmediatagsから取得したメタデータタグオブジェクト。
 */
export function displayMetadata(tags) {
    // 各テキスト要素にコンテンツを設定（タイトル、アーティスト、アルバム）
    dom.trackTitle.querySelector('.marquee-child').textContent = tags.title || 'タイトル不明';
    dom.trackArtist.querySelector('.marquee-child').textContent = tags.artist || 'アーティスト不明';
    dom.trackAlbum.querySelector('.marquee-child').textContent = tags.album || 'アルバム不明';

    // アルバムアートの表示
    if (tags.picture) {
        const image = tags.picture;
        let base64String = "";
        // 画像データをBase64文字列に変換
        for (let i = 0; i < image.data.length; i++) {
            base64String += String.fromCharCode(image.data[i]);
        }
        const imageUrl = `data:${image.format};base64,${btoa(base64String)}`; // データURLを作成
        dom.albumArt.src = imageUrl; // アルバムアート画像要素のsrcを設定
        dom.albumArt.classList.remove('hidden'); // アルバムアートを表示
        dom.albumArtPlaceholder.classList.add('hidden'); // プレースホルダーを非表示
    } else {
        dom.albumArt.classList.add('hidden'); // アルバムアートを非表示
        dom.albumArtPlaceholder.classList.remove('hidden'); // プレースホルダーを表示
        // デフォルトのプレースホルダー画像をセット (テキストもURLエンコード済み)
        dom.albumArt.src = "https://placehold.co/300x300/e0e0e0/757570?text=Album+Art";
    }

    // 各marquee要素のスクロールアニメーションをリセット
    resetMarquee(dom.trackTitle);
    resetMarquee(dom.trackArtist);
    resetMarquee(dom.trackAlbum);
}

/**
 * マーカー要素（テキストがスクロールする要素）のアニメーションをリセットし、初期状態に戻します。
 * @param {HTMLElement} element - marquee-childクラスを含む親要素。
 */
function resetMarquee(element) {
    const child = element.querySelector('.marquee-child');
    if (child) {
        child.style.transform = 'translateX(0)'; // 位置をリセット
        child.style.animation = 'none'; // アニメーションを停止
        // 再度アニメーションをトリガーするためにreflowを強制 (CSSアニメーションのトリック)
        child.offsetHeight;
        child.style.animation = ''; // アニメーションを再開
    }
}

/**
 * メタデータ表示領域を初期状態に戻します（「曲名未選択」など）。
 */
export function initialMetadataDisplay() { // export されています
    dom.trackTitle.querySelector('.marquee-child').textContent = '曲名未選択';
    dom.trackArtist.querySelector('.marquee-child').textContent = 'アーティスト不明';
    dom.trackAlbum.querySelector('.marquee-child').textContent = 'アルバム不明';
    dom.albumArt.classList.add('hidden'); // アルバムアートを非表示
    dom.albumArtPlaceholder.classList.remove('hidden'); // プレースホルダーを表示
    // デフォルトのプレースホルダー画像をセット (テキストもURLエンコード済み)
    dom.albumArt.src = "https://placehold.co/300x300/e0e0e0/757570?text=Album+Art";

    resetMarquee(dom.trackTitle); // マーカーをリセット
    resetMarquee(dom.trackArtist);
    resetMarquee(dom.trackAlbum);
}

/**
 * アルバムアート表示を初期状態（プレースホルダー）に戻します。
 */
export function resetAlbumArt() {
    dom.albumArt.classList.add('hidden'); // アルバムアートを非表示
    dom.albumArtPlaceholder.classList.remove('hidden'); // プレースホルダーを表示
    // デフォルトのプレースホルダー画像をセット (テキストもURLエンコード済み)
    dom.albumArt.src = "https://placehold.co/300x300/e0e0e0/757570?text=Album+Art";
}

/**
 * 再生時間と総時間の表示を更新します。
 * @param {number} currentTime - 現在の再生時間（秒）。
 * @param {number} duration - オーディオの総時間（秒）。
 */
export function updateTimeDisplay(currentTime, duration) {
    dom.timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`; // 時間表示を更新
    if (dom.seekBar) {
        dom.seekBar.value = currentTime; // シークバーの現在値を更新
        dom.seekBar.max = duration; // シークバーの最大値を更新
    }
}

/**
 * オーディオプレーヤーの現在の状態に基づいて時間表示とシークバーを更新します。
 * @param {HTMLAudioElement} audioPlayer - 現在再生中のオーディオプレーヤー要素。
 */
export function updateTimeDisplayOnPlayer(audioPlayer) {
    if (audioPlayer) {
        const currentTime = audioPlayer.currentTime;
        const duration = audioPlayer.duration;
        dom.timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`; // 時間表示を更新
        if (dom.seekBar) {
            dom.seekBar.value = currentTime; // シークバーの現在値を更新
            if (isFinite(duration) && duration > 0) {
                dom.seekBar.max = duration; // 総時間が有効な場合、シークバーの最大値を設定
            } else {
                dom.seekBar.max = 0; // Durationが不正な場合はシークバーを無効にする
            }
        }
    } else {
        dom.timeDisplay.textContent = '0:00 / 0:00'; // オーディオプレーヤーがない場合は初期表示
        if (dom.seekBar) dom.seekBar.value = 0; // シークバーをリセット
    }
}


/**
 * ファイルの詳細情報（タイプ、サンプリングレート、ビットレート、ビット深度、チャンネル数、ファイルサイズ）を
 * モーダル内のUI要素に表示します。
 * @param {File} file - 選択されたファイルオブジェクト。
 * @param {number|null} audioDuration - オーディオの総時間（秒）。
 * @param {number|null} audioContextSampleRate - AudioContextのサンプリングレート。
 * @param {number|null} currentFileSize - ファイルサイズ（バイト）。
 * @param {number|null} bitRateValue - ビットレート（kbps）。
 * @param {number|null} bitDepthValue - ビット深度。
 * @param {number|null} fileSampleRateValue - ファイルから解析されたサンプリングレート。
 * @param {number|null} fileChannelsValue - ファイルから解析されたチャンネル数。
 */
export function updateFileInfoDisplay(file, audioDuration, audioContextSampleRate, currentFileSize, bitRateValue, bitDepthValue, fileSampleRateValue, fileChannelsValue) {
    console.log("[UI] updateFileInfoDisplay called with:", {currentFile: file, audioDuration: audioDuration, audioContextSampleRate: audioContextSampleRate, currentFileSize: currentFileSize, bitRateValue: bitRateValue, bitDepthValue: bitDepthValue, fileSampleRateValue: fileSampleRateValue, fileChannelsValue: fileChannelsValue});

    if (file) {
        // ★ここから変更: モーダル内の表示要素を更新
        dom.fileTypeDisplay.textContent = file.type || 'N/A'; // ファイルタイプを表示
        // AudioContextのサンプリングレートを表示
        dom.sampleRateDisplay.textContent = audioContextSampleRate && audioContextSampleRate > 0 && isFinite(audioContextSampleRate) ? `${audioContextSampleRate / 1000} kHz` : 'N/A';
        dom.bitRateDisplay.textContent = bitRateValue ? `${bitRateValue} kbps` : 'N/A'; // ビットレートを表示
        dom.fileSizeDisplay.textContent = currentFileSize ? formatFileSize(currentFileSize) : 'N/A'; // ファイルサイズを表示

        // ファイルからのサンプリングレート表示 (モーダル内): 値があれば表示、なければ非表示
        if (fileSampleRateValue && fileSampleRateValue > 0 && isFinite(fileSampleRateValue)) {
            dom.fileSampleRateDisplay.textContent = `${fileSampleRateValue / 1000} kHz`;
            dom.fileSampleRateDisplay.parentElement.style.display = 'block'; // 親要素を表示
        } else {
            dom.fileSampleRateDisplay.textContent = 'N/A';
            dom.fileSampleRateDisplay.parentElement.style.display = 'none'; // 親要素を非表示
        }

        // ビット深度の表示 (モーダル内): 値があれば表示、なければ非表示
        if (bitDepthValue) {
            dom.bitDepthDisplay.textContent = `${bitDepthValue} bits`;
            dom.bitDepthDisplay.parentElement.style.display = 'block'; // 親要素を表示
        } else {
            dom.bitDepthDisplay.textContent = 'N/A';
            dom.bitDepthDisplay.parentElement.style.display = 'none'; // 親要素を非表示
        }

        // ファイルのチャンネル数表示 (モーダル内): 値があれば表示、なければ非表示
        if (fileChannelsValue && fileChannelsValue > 0 && isFinite(fileChannelsValue)) {
            dom.fileChannelsDisplay.textContent = `${fileChannelsValue} ch`;
            dom.fileChannelsDisplay.parentElement.style.display = 'block'; // 親要素を表示
        } else {
            dom.fileChannelsDisplay.textContent = 'N/A';
            dom.fileChannelsDisplay.parentElement.style.display = 'none'; // 親要素を非表示
        }
        // ★ここまで変更

        // 再生時間表示の更新（プレーヤーの現在時間と総時間）
        if (audioDuration && isFinite(audioDuration)) {
            dom.timeDisplay.textContent = `${formatTime(dom.audioPlayer.currentTime)} / ${formatTime(audioDuration)}`;
        } else {
            dom.timeDisplay.textContent = '0:00 / 0:00';
        }
    } else {
        resetFileInfoDisplay(); // ファイルが選択されていない場合は情報表示をリセット
    }
}

/**
 * ファイル詳細情報モーダル内のUI要素をリセットし、特定の情報を非表示にします。
 */
export function resetFileInfoDisplay() {
    console.log("[UI] resetFileInfoDisplay called");
    // ★ここから変更: モーダル内の表示要素をリセットし、非表示に
    dom.fileTypeDisplay.textContent = 'N/A';
    dom.sampleRateDisplay.textContent = 'N/A';
    dom.fileSampleRateDisplay.textContent = 'N/A';
    dom.fileSampleRateDisplay.parentElement.style.display = 'none'; // 親要素を非表示
    dom.bitRateDisplay.textContent = 'N/A';
    dom.bitDepthDisplay.textContent = 'N/A';
    dom.bitDepthDisplay.parentElement.style.display = 'none'; // 親要素を非表示
    dom.fileChannelsDisplay.textContent = 'N/A';
    dom.fileChannelsDisplay.parentElement.style.display = 'none'; // 親要素を非表示
    dom.fileSizeDisplay.textContent = 'N/A';
    // ★ここまで変更
}

/**
 * オーディオコントロール（再生/一時停止ボタン、シークバーなど）の有効/無効を切り替えます。
 * @param {boolean} enabled - コントロールを有効にする場合は true、無効にする場合は false。
 */
export function setAudioControlsEnabled(enabled) {
    // 各コントロール要素のdisabledプロパティを設定
    if (dom.playPauseBtn) dom.playPauseBtn.disabled = !enabled;
    if (dom.seekBar) dom.seekBar.disabled = !enabled;
    if (dom.volumeBar) dom.volumeBar.disabled = !enabled;
    if (dom.clearLrcBtn) dom.clearLrcBtn.disabled = !enabled;

    // パネルトグルボタンも制御
    if (dom.toggleEqBtn) dom.toggleEqBtn.disabled = !enabled;
    if (dom.toggleToneBtn) dom.toggleToneBtn.disabled = !enabled;
    if (dom.toggleAmbienceBtn) dom.toggleAmbienceBtn.disabled = !enabled;
    if (dom.toggleVocalCutBtn) dom.toggleVocalCutBtn.disabled = !enabled;

    // 'disabled-button' クラスのトグル（CSSでのスタイル適用のため）
    const controls = [
        dom.playPauseBtn, dom.seekBar, dom.volumeBar, dom.clearLrcBtn,
        dom.toggleEqBtn, dom.toggleToneBtn, dom.toggleAmbienceBtn, dom.toggleVocalCutBtn
    ];
    controls.forEach(control => {
        if (control) {
            if (!enabled) {
                control.classList.add('disabled-button'); // 無効なスタイルを追加
            } else {
                control.classList.remove('disabled-button'); // 有効なスタイルを削除
            }
        }
    });
}

/**
 * 再生/一時停止ボタンの視覚的な状態（アイコン）を更新します。
 * @param {boolean} isPlaying - 現在再生中であれば true、そうでなければ false。
 */
export function updatePlayPauseButtonVisuals(isPlaying) {
    if (dom.playIcon && dom.pauseIcon) {
        if (isPlaying) {
            dom.playIcon.classList.add('hidden'); // 再生アイコンを非表示
            dom.pauseIcon.classList.remove('hidden'); // 一時停止アイコンを表示
        } else {
            dom.playIcon.classList.remove('hidden'); // 再生アイコンを表示
            dom.pauseIcon.classList.add('hidden'); // 一時停止アイコンを非表示
        }
    }
}

/**
 * LRCクリアボタンの有効/無効を切り替えます。
 * @param {boolean} enabled - ボタンを有効にする場合は true、無効にする場合は false。
 */
export function setClearLrcButtonEnabled(enabled) {
    if (dom.clearLrcBtn) {
        dom.clearLrcBtn.disabled = !enabled; // ボタンのdisabledプロパティを設定
        if (!enabled) {
            dom.clearLrcBtn.classList.add('disabled-button'); // 無効なスタイルを追加
        } else {
            dom.clearLrcBtn.classList.remove('disabled-button'); // 有効なスタイルを削除
        }
    }
}
