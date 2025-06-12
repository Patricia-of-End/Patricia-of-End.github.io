// js/utils.js

/**
 * HTML特殊文字をエスケープします。
 * 主にユーザーが入力したテキストをHTMLとして表示する際に、クロスサイトスクリプティング (XSS) 攻撃を防ぐために使用されます。
 * @param {string} unsafe - エスケープする可能性のあるHTMLを含む文字列。
 * @returns {string} - エスケープされた文字列。入力が文字列でない場合は空文字列を返します。
 */
export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return ''; // 文字列型でない場合は空文字列を返す
    return unsafe
        .replace(/&/g, "&amp;")  // '&' を '&amp;' に置換
        .replace(/</g, "&lt;")   // '<' を '&lt;' に置換
        .replace(/>/g, "&gt;")   // '>' を '&gt;' に置換
        .replace(/"/g, "&quot;") // '"' を '&quot;' に置換
        .replace(/'/g, "&#039;"); // "'" を '&#039;' に置換
}

/**
 * HTMLエンティティを元の文字（アンエスケープ）に戻します。
 * 特にLRC歌詞のように、メタデータがHTMLエスケープされている可能性がある場合に、
 * 正しいテキストを表示するために使用されます。
 * @param {string} html - アンエスケープするHTMLエンティティを含む文字列。
 * @returns {string} - アンエスケープされた文字列。入力が文字列でない場合は空文字列を返します。
 */
export function unescapeHtmlForLyrics(html) {
    if (typeof html !== 'string') return ''; // 文字列型でない場合は空文字列を返す
    return html
        .replace(/&amp;/g, '&')     // '&amp;' を '&' に戻す（最初に処理することが重要）
        .replace(/&lt;/g, '<')      // '&lt;' を '<' に戻す
        .replace(/&gt;/g, '>')      // '&gt;' を '>' に戻す
        .replace(/&quot;/g, '"')    // '&quot;' を '"' に戻す
        .replace(/&#039;/g, "'")    // '&#039;' を "'" に戻す
        .replace(/&apos;/g, "'");   // '&apos;' (HTML5のアポストロフィ) を "'" に戻す
}

/**
 * 指定された文字列がLRC歌詞フォーマットの文字列であるかを簡易的に判定します。
 * 最初の数行にLRCタイムスタンプパターン（例: `[00:00.00]` または `[00:00.000]`) が含まれているかを確認します。
 * @param {string} text - 判定する文字列。
 * @returns {boolean} - LRC形式であると判断された場合は true、そうでない場合は false。
 */
export function isLrcString(text) {
    if (typeof text !== 'string' || !text.trim()) return false; // 文字列でない、または空の場合はfalse
    const lines = text.split('\n').slice(0, 10); // 最初の10行をチェック対象とする
    const lrcTimePattern = /\[\d{2}:\d{2}\.\d{2,3}\]/; // LRCタイムスタンプの正規表現
    return lines.some(line => lrcTimePattern.test(line)); // いずれかの行がパターンにマッチすればtrue
}

/**
 * 秒単位の時間を「分:秒」形式の文字列にフォーマットします。
 * 例: `65` は `1:05` になります。
 * @param {number} timeInSeconds - フォーマットする時間（秒）。
 * @returns {string} - フォーマットされた時間文字列。
 */
export function formatTime(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60); // 分を計算
    const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0'); // 秒を計算し、2桁にパディング
    return `${minutes}:${seconds}`; // 「分:秒」形式で返す
}

/**
 * バイト単位のファイルサイズを、読みやすい形式（KB, MB, GBなど）にフォーマットします。
 * @param {number} bytes - フォーマットするバイト数。
 * @param {number} [decimals=2] - 小数点以下の桁数。
 * @returns {string} - フォーマットされたファイルサイズ文字列。
 */
export function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes'; // 0バイトの場合は「0 Bytes」を返す
    const k = 1024; // 1キロバイトあたりのバイト数
    const dm = decimals < 0 ? 0 : decimals; // 小数点以下の桁数を0以上にする
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']; // サイズ単位の配列
    const i = Math.floor(Math.log(bytes) / Math.log(k)); // 適切なサイズ単位のインデックスを計算
    // 数値をフォーマットし、単位を付加して返す
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// --- メッセージ表示関連の関数 ---

/**
 * 指定されたメッセージ要素にテキストを設定し、タイプに応じてスタイルを適用します。
 * @param {HTMLElement} messageElement - メッセージを表示するDOM要素。
 * @param {string} text - 表示するメッセージテキスト。
 * @param {string} [type='error'] - メッセージのタイプ ('error', 'success', 'warning', 'info')。
 */
export function showMessage(messageElement, text, type = 'error') {
    if (!messageElement) return; // メッセージ要素がなければ処理しない
    messageElement.textContent = text; // テキストコンテンツを設定
    // 既存のスタイルクラスを全て削除
    messageElement.classList.remove('text-red-400', 'text-green-400', 'text-yellow-400');
    // タイプに応じて新しいスタイルクラスを追加
    if (type === 'error') messageElement.classList.add('text-red-400');      // 赤色（エラー）
    else if (type === 'success') messageElement.classList.add('text-green-400'); // 緑色（成功）
    // 'info' と 'warning' は同じスタイル（黄色）を適用
    else if (type === 'warning' || type === 'info') messageElement.classList.add('text-yellow-400'); // 黄色（警告または情報）
}

/**
 * エラーメッセージをUIに表示します。
 * @param {HTMLElement} messageElement - メッセージを表示するDOM要素。
 * @param {string} message - 表示するエラーメッセージ。
 */
export function setErrorMessage(messageElement, message) { showMessage(messageElement, message, 'error'); }

/**
 * 成功メッセージをUIに表示します。
 * @param {HTMLElement} messageElement - メッセージを表示するDOM要素。
 * @param {string} message - 表示する成功メッセージ。
 */
export function setSuccessMessage(messageElement, message) { showMessage(messageElement, message, 'success'); }

/**
 * 警告メッセージをUIに表示します。
 * @param {HTMLElement} messageElement - メッセージを表示するDOM要素。
 * @param {string} message - 表示する警告メッセージ。
 */
export function setWarningMessage(messageElement, message) { showMessage(messageElement, message, 'warning'); }

/**
 * 情報メッセージをUIに表示します。
 * @param {HTMLElement} messageElement - メッセージを表示するDOM要素。
 * @param {string} message - 表示する情報メッセージ。
 */
export function setInfoMessage(messageElement, message) { showMessage(messageElement, message, 'info'); }
