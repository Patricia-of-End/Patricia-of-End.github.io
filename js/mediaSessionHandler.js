// js/mediaSessionHandler.js

// このモジュールはMedia Session APIを扱い、メディア通知やメディアキーの制御を可能にします。

let audioPlayerRef; // main.jsから渡されるHTMLAudioElementへの参照を保持します。
let togglePlayPauseAudioFunctionRef; // main.jsから渡される再生/一時停止トグル関数への参照を保持します。

/**
 * Media Session APIを設定し、各種メディアアクションのハンドラを定義します。
 * @param {HTMLAudioElement} audioPlayerElement - Media Sessionに関連付けるオーディオプレーヤー要素。
 * @param {Function} togglePlayPauseFunc - 再生/一時停止を切り替える関数（audioHandler.togglePlayPauseAudioを想定）。
 */
export function setupMediaSession(audioPlayerElement, togglePlayPauseFunc) {
    audioPlayerRef = audioPlayerElement; // オーディオプレーヤー要素の参照を設定
    togglePlayPauseAudioFunctionRef = togglePlayPauseFunc; // 再生/一時停止関数の参照を設定

    if ('mediaSession' in navigator) { // Media Session APIがブラウザでサポートされているか確認
        console.log("Media Session API is available.");

        // 'play' アクションのハンドラ: オーディオが一時停止中の場合、再生を試みます。
        navigator.mediaSession.setActionHandler('play', () => {
            console.log("Media Session: Play action received.");
            if (audioPlayerRef && audioPlayerRef.paused) {
                togglePlayPauseAudioFunctionRef(); // 渡された再生/一時停止関数を呼び出す
            }
        });

        // 'pause' アクションのハンドラ: オーディオが再生中の場合、一時停止を試みます。
        navigator.mediaSession.setActionHandler('pause', () => {
            console.log("Media Session: Pause action received.");
            if (audioPlayerRef && !audioPlayerRef.paused) {
                togglePlayPauseAudioFunctionRef(); // 渡された再生/一時停止関数を呼び出す
            }
        });

        // 'stop' アクションのハンドラ: オーディオを停止し、再生位置をリセットします。
        navigator.mediaSession.setActionHandler('stop', () => {
            console.log("Media Session: Stop action received.");
            if (audioPlayerRef) {
                audioPlayerRef.pause(); // オーディオを一時停止
                audioPlayerRef.currentTime = 0; // 再生位置を0にリセット
                // ここでUIの更新やビジュアライザーの停止はmain.jsからのイベントリスナーに任せるか、
                // あるいは必要に応じて明示的に呼び出すことができます。
            }
        });

        // 'seekbackward' アクションのハンドラ: 指定されたオフセット（デフォルト10秒）だけ巻き戻します。
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            console.log("Media Session: Seek backward action received.", details);
            if (audioPlayerRef) {
                // 現在の再生位置からseekOffsetを引く。0秒を下回らないようにMath.maxで制限
                audioPlayerRef.currentTime = Math.max(audioPlayerRef.currentTime - (details.seekOffset || 10), 0);
            }
        });

        // 'seekforward' アクションのハンドラ: 指定されたオフセット（デフォルト10秒）だけ早送りします。
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            console.log("Media Session: Seek forward action received.", details);
            if (audioPlayerRef) {
                // 現在の再生位置にseekOffsetを加える。オーディオの長さを超えないようにMath.minで制限
                audioPlayerRef.currentTime = Math.min(audioPlayerRef.currentTime + (details.seekOffset || 10), audioPlayerRef.duration);
            }
        });

        // 他のメディアアクションハンドラもここに追加できます（例: 'previoustrack', 'nexttrack'）
        // navigator.mediaSession.setActionHandler('previoustrack', () => { /* 前のトラックへ */ });
        // navigator.mediaSession.setActionHandler('nexttrack', () => { /* 次のトラックへ */ });

    } else {
        console.log("Media Session API is not available.");
    }
}

/**
 * Media Sessionのメタデータを更新します。
 * (タイトル、アーティスト、アルバム、アートワークなど)
 * @param {object} tags - jsmediatagsから取得したメタデータタグオブジェクト。
 */
export async function updateMediaSessionMetadata(tags) {
    if ('mediaSession' in navigator) { // Media Session APIがサポートされているか確認
        console.log("Updating Media Session metadata with:", tags);
        const artwork = []; // アートワークの配列を初期化

        // タグに画像データが含まれている場合、アートワークを準備
        if (tags.picture) {
            try {
                const { data, format } = tags.picture; // 画像のバイトデータとフォーマットを取得
                let base64String = "";
                // バイトデータをBase64文字列に変換
                for (let i = 0; i < data.length; i++) {
                    base64String += String.fromCharCode(data[i]);
                }
                // Base64文字列からBlobを作成し、Object URLを生成してアートワークとして設定
                const blob = await fetch(`data:${format};base64,${window.btoa(base64String)}`).then(res => res.blob());
                const artworkObjectURL = URL.createObjectURL(blob);
                artwork.push({ src: artworkObjectURL, sizes: '512x512', type: blob.type }); // アートワーク配列に追加
            } catch (e) {
                console.error("Error creating blob from picture data for Media Session:", e); // エラーハンドリング
            }
        }

        // MediaMetadataオブジェクトを作成し、Media Sessionに設定
        navigator.mediaSession.metadata = new MediaMetadata({
            title: tags.title || 'タイトル不明', // タイトル、なければ「タイトル不明」
            artist: tags.artist || 'アーティスト不明', // アーティスト、なければ「アーティスト不明」
            album: tags.album || 'アルバム不明', // アルバム、なければ「アルバム不明」
            artwork: artwork // 準備したアートワークを設定
        });
        console.log("Media Session metadata updated.");
    }
}

/**
 * Media Sessionの情報をクリアします。
 * (メタデータと再生状態をリセット)
 */
export function clearMediaSession() {
    if ('mediaSession' in navigator) { // Media Session APIがサポートされているか確認
        navigator.mediaSession.metadata = null; // メタデータをクリア
        navigator.mediaSession.playbackState = "none"; // 再生状態を「なし」にリセット
        console.log("Media Session cleared.");
    }
}

// ★ここから追加: updatePositionState 関数が抜けていました
/**
 * Media Sessionの再生位置状態を更新します。
 * これにより、システムUI（通知、ロック画面など）で再生バーが正確に表示されます。
 * @param {HTMLAudioElement} audioElement - 現在再生中のオーディオ要素。
 */
export function updatePositionState(audioElement) {
    if ('mediaSession' in navigator && audioElement) { // Media Session APIとオーディオ要素が存在するか確認
        // durationがNaNやInfinityの場合に0をフォールバックとして使う
        // durationが0の場合もpositionを0として報告する
        const duration = audioElement.duration && isFinite(audioElement.duration) ? audioElement.duration : 0;
        let position = audioElement.currentTime;

        if (duration === 0) { // durationが0の場合はpositionも0と見なす
            position = 0;
        }

        // Media Sessionの再生位置状態を設定
        navigator.mediaSession.setPositionState({
            duration: duration, // オーディオの総時間（秒）
            playbackRate: audioElement.playbackRate, // 現在の再生速度
            position: position // 現在の再生位置（秒）
        });
        // console.log(`[MediaSessionHandler] PositionState Updated: Duration=${duration.toFixed(1)}, Position=${position.toFixed(1)}`); // デバッグ用ログ
    }
}
