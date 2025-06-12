// js/domElements.js

// プレーヤーコンテナと表示要素
export const playerContainer = document.getElementById('player-container'); // 'player-container' IDを持つ要素を取得し、エクスポートします。
export const albumArt = document.getElementById('albumArt'); // アルバムアート画像を表示する要素を取得します。
export const albumArtPlaceholder = document.getElementById('albumArtPlaceholder'); // アルバムアートのプレースホルダー要素を取得します。
export const trackTitle = document.getElementById('trackTitle'); // トラックタイトルを表示する要素を取得します。
export const trackArtist = document.getElementById('trackArtist'); // トラックアーティストを表示する要素を取得します。
export const trackAlbum = document.getElementById('trackAlbum'); // トラックアルバムを表示する要素を取得します。


export const deviceInfoDisplay = document.getElementById('deviceInfoDisplay'); // デバイス情報を表示する要素を取得します。

// ファイル入力要素
export const audioFileEl = document.getElementById('audioFile'); // オーディオファイル入力要素を取得します。
export const lrcFileEl = document.getElementById('lrcFile'); // LRCファイル入力要素を取得します。
export const clearLrcBtn = document.getElementById('clearLrcBtn'); // LRCクリアボタンを取得します。

// オーディオプレーヤー要素
export const audioPlayerContainer = document.getElementById('audioPlayerContainer'); // オーディオプレーヤーのコンテナ要素を取得します。
export let audioPlayer = document.getElementById('audioPlayer'); // オーディオプレーヤー要素を取得します（letで再割り当て可能にします）。

// コントロール要素
export const playPauseBtn = document.getElementById('playPauseBtn'); // 再生/一時停止ボタンを取得します。
export const playIcon = document.getElementById('playIcon'); // 再生アイコン要素を取得します。
export const pauseIcon = document.getElementById('pauseIcon'); // 一時停止アイコン要素を取得します。
export const seekBar = document.getElementById('seekBar'); // シークバー要素を取得します。
export const timeDisplay = document.getElementById('timeDisplay'); // 時間表示要素を取得します。
export const volumeBar = document.getElementById('volumeBar'); // 音量バー要素を取得します。
export const lyricsContainer = document.getElementById('lyricsContainer'); // 歌詞を表示するコンテナ要素を取得します。
export const messageArea = document.getElementById('messageArea'); // メッセージ表示エリア要素を取得します。

// パネルトグルボタン
export const toggleEqBtn = document.getElementById('toggleEqBtn'); // イコライザーパネルのトグルボタンを取得します。
export const toggleToneBtn = document.getElementById('toggleToneBtn'); // トーンパネルのトグルボタンを取得します。
export const toggleAmbienceBtn = document.getElementById('toggleAmbienceBtn'); // アンビエンスパネルのトグルボタンを取得します。
export const toggleVocalCutBtn = document.getElementById('toggleVocalCutBtn'); // ボーカルカットパネルのトグルボタンを取得します。

// パネル自体
export const equalizerPanel = document.getElementById('equalizerPanel'); // イコライザーパネル要素を取得します。
export const tonePanel = document.getElementById('tonePanel'); // トーンパネル要素を取得します。
export const ambiencePanel = document.getElementById('ambiencePanel'); // アンビエンスパネル要素を取得します。
export const vocalCutPanel = document.getElementById('vocalCutPanel'); // ボーカルカットパネル要素を取得します。

// アルバムアートモーダル
export const albumArtModal = document.getElementById('albumArtModal'); // アルバムアートモーダル要素を取得します。
export const modalAlbumArt = document.getElementById('modalAlbumArt'); // モーダル内のアルバムアート画像要素を取得します。
export const closeModalBtn = document.getElementById('closeModalBtn'); // モーダルを閉じるボタンを取得します。

// ★ここから追加: ファイル詳細情報モーダル関連の要素（IDがDisplay付きでHTMLに存在する）
export const openDetailsModalBtn = document.getElementById('openDetailsModalBtn'); // ファイル詳細モーダルを開くボタンを取得します。
export const fileDetailsModal = document.getElementById('fileDetailsModal'); // ファイル詳細モーダル要素を取得します。
export const closeFileDetailsModalBtn = document.getElementById('closeFileDetailsModalBtn'); // ファイル詳細モーダルを閉じるボタンを取得します。
export const fileInfoDisplay = document.getElementById('fileInfoDisplay'); // モーダル内の情報表示コンテナを取得します (旧fileInfoをモーダルに移動した新しいコンテナ)。
export const fileTypeDisplay = document.getElementById('fileTypeDisplay'); // モーダル内のファイル形式表示要素を取得します。
export const sampleRateDisplay = document.getElementById('sampleRateDisplay'); // モーダル内のAudioContextのサンプリングレート表示要素を取得します。
export const fileSampleRateDisplay = document.getElementById('fileSampleRateDisplay'); // モーダル内のファイルのサンプリングレート表示要素を取得します。
export const bitRateDisplay = document.getElementById('bitRateDisplay'); // モーダル内のビットレート表示要素を取得します。
export const bitDepthDisplay = document.getElementById('bitDepthDisplay'); // モーダル内のビット深度表示要素を取得します。
export const fileChannelsDisplay = document.getElementById('fileChannelsDisplay'); // モーダル内のチャンネル数表示要素を取得します。
export const fileSizeDisplay = document.getElementById('fileSizeDisplay'); // モーダル内のファイルサイズ表示要素を取得します。
// ★ここまで追加

// Visualizer Canvas
export const visualizerCanvas = document.getElementById('visualizerCanvas'); // ビジュアライザーキャンバス要素を取得します。

/**
 * ビジュアライザーCanvasの2Dレンダリングコンテキストを取得します。
 * @returns {CanvasRenderingContext2D|null} - Canvasの2Dコンテキスト、またはCanvas要素が存在しない場合はnull。
 */
export function getVisualizerContext() {
    if (visualizerCanvas) {
        return visualizerCanvas.getContext('2d'); // Canvasの2Dレンダリングコンテキストを返します。
    }
    return null; // Canvasが存在しない場合はnullを返します。
}

/**
 * audioPlayer要素を再作成し、DOMツリー内の参照とこのモジュール内の参照を更新します。
 * これにより、オーディオ要素のイベントリスナーを再設定する必要があるシナリオ（例: ファイル変更時）に対応します。
 * @returns {HTMLAudioElement} - 新しく作成され、参照が更新されたオーディオプレーヤー要素。
 */
export function recreateAudioPlayer() {
    if (audioPlayer) {
        audioPlayer.pause(); // 現在のプレーヤーを一時停止します。
        audioPlayer.src = ""; // ソースをクリアします。
        if (audioPlayer.parentNode) {
            audioPlayer.parentNode.removeChild(audioPlayer); // 親ノードから現在のプレーヤー要素を削除します。
            console.log("[DOM] Old audioPlayer element removed from container."); // 削除ログを出力します。
        }
    }
    const newAudioPlayer = document.createElement('audio'); // 新しいオーディオ要素を作成します。
    newAudioPlayer.id = 'audioPlayer'; // IDを設定します。
    newAudioPlayer.className = 'hidden'; // CSSで非表示にするためのクラス名を設定します。
    newAudioPlayer.crossOrigin = 'anonymous'; // クロスオリジン属性を設定します（CORSポリシーに準拠するため、特にMediaElementSourceNodeを使用する場合に重要）。

    if (audioPlayerContainer) {
        audioPlayerContainer.appendChild(newAudioPlayer); // 新しいプレーヤー要素をコンテナに追加します。
        console.log("[DOM] audioPlayer element recreated, re-referenced, and appended to container."); // 追加ログを出力します。
    } else {
        console.error("[DOM] audioPlayerContainer not found, cannot recreate audio player."); // コンテナが見つからない場合のエラーログを出力します。
    }
    audioPlayer = newAudioPlayer; // グローバルなaudioPlayer参照を新しい要素に更新します。
    return audioPlayer; // 新しいオーディオプレーヤー要素を返します。
}
