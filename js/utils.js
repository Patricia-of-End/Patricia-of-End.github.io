// js/utils.js
export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

export function unescapeHtmlForLyrics(html) {
    if (typeof html !== 'string') return '';
    return html
        .replace(/&amp;/g, '&')      // &amp; は最初に処理する
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'");
}

export function isLrcString(text) {
    if (typeof text !== 'string' || !text.trim()) return false;
    const lines = text.split('\n').slice(0, 10);
    const lrcTimePattern = /\[\d{2}:\d{2}\.\d{2,3}\]/;
    return lines.some(line => lrcTimePattern.test(line));
}

export function formatTime(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

export function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function showMessage(messageElement, text, type = 'error') {
    if (!messageElement) return;
    messageElement.textContent = text;
    messageElement.classList.remove('text-red-400', 'text-green-400', 'text-yellow-400');
    if (type === 'error') messageElement.classList.add('text-red-400');
    else if (type === 'success') messageElement.classList.add('text-green-400');
    else if (type === 'warning') messageElement.classList.add('text-yellow-400');
}
export function setErrorMessage(messageElement, message) { showMessage(messageElement, message, 'error'); }
export function setSuccessMessage(messageElement, message) { showMessage(messageElement, message, 'success'); }
export function setWarningMessage(messageElement, message) { showMessage(messageElement, message, 'warning'); }