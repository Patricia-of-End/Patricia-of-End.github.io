// js/lyricsHandler.js
import * as dom from './domElements.js';
import * as ui from './ui.js';
import * as visualizer from './visualizer.js'; // ★ visualizerをインポート
import { setSuccessMessage, setErrorMessage, setWarningMessage, isLrcString, unescapeHtmlForLyrics } from './utils.js';

export let lrcData = [];
export let currentLrcLineIndex = -1;
let metadataLyricsSource = null;

export function resetLyricsState() {
    lrcData = [];
    currentLrcLineIndex = -1;
    metadataLyricsSource = null;
}

export function resetLyricsUI() {
    resetLyricsState();
    displayFallbackLyricsMessage();
    ui.setClearLrcButtonEnabled(false);
}

function parseAndDisplayLRC(lrcContent, source) {
    const parsed = parseLRC(lrcContent);
    if (parsed.length > 0) {
        lrcData = parsed;
        displayLrcLines();
        metadataLyricsSource = (source === 'metadata') ? 'lrc' : null;
        ui.setClearLrcButtonEnabled(true);
        return true;
    }
    lrcData = [];
    return false;
}

function displayLrcLines() {
    if (!dom.lyricsContainer) return;
    dom.lyricsContainer.innerHTML = '';
    if (lrcData.length === 0) {
        displayFallbackLyricsMessage();
        return;
    }

    lrcData.forEach((line, index) => {
        const p = document.createElement('p');
        p.textContent = unescapeHtmlForLyrics(line.text);
        p.classList.add('lyrics-line');
        p.dataset.index = index;
        p.dataset.time = line.time;

        // ★★★ ここが修正のポイント ★★★
        p.addEventListener('click', async () => { // ★ async に変更
            const currentPlayer = dom.audioPlayer; 

            console.log(`[Lyrics] Line clicked. Time: ${line.time}, Target audioPlayer:`, currentPlayer);
            
            if (currentPlayer && typeof line.time === 'number') {
                // 再生を開始する前に、AudioContextの状態を確実にする
                await visualizer.ensureAudioContextResumed(); // ★ この行を追加

                currentPlayer.currentTime = line.time;
                console.log(`[Lyrics] Set audioPlayer.currentTime to ${line.time}`);

                if (currentPlayer.paused) {
                    currentPlayer.play().catch(e => console.error("[Lyrics] Play error on lyric click:", e));
                }
                // もし既に再生中なら、シークするだけで何もしなくてもビジュアライザーは動き続ける
            } else {
                console.warn("[Lyrics] Could not seek. Conditions not met.");
            }
        });
        dom.lyricsContainer.appendChild(p);
    });
}

function displayPlainTextLyrics(plainText) {
    if (!dom.lyricsContainer) return;
    lrcData = [];
    currentLrcLineIndex = -1;
    dom.lyricsContainer.innerHTML = '';
    if (!plainText || !plainText.trim()) {
        dom.lyricsContainer.innerHTML = '<p class="text-slate-500">メタデータに歌詞はありますが、内容は空です。</p>';
        return;
    }
    const lines = plainText.split('\n');
    lines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = unescapeHtmlForLyrics(line.trim());
        p.classList.add('lyrics-line');
        p.style.cursor = 'default';
        dom.lyricsContainer.appendChild(p);
    });
}

function displayFallbackLyricsMessage() {
    if (dom.lyricsContainer) {
        dom.lyricsContainer.innerHTML = '<p class="text-gray-500">LRCファイルを読み込むか、音声ファイルに歌詞情報が含まれていれば表示されます。</p>';
    }
}

function parseLRC(lrcContent) {
    let tempLrcData = [];
    const lines = lrcContent.split('\n');
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    const metaRegex = /\[(ar|ti|al|by|offset):(.+)\]/;
    let lrcOffset = 0;
    for (const line of lines) {
        const metaMatch = line.match(metaRegex);
        if (metaMatch) {
            const key = metaMatch[1].toLowerCase();
            const value = metaMatch[2].trim();
            if (key === 'offset') {
                const offsetValue = parseInt(value, 10);
                if (!isNaN(offsetValue)) {
                    lrcOffset = offsetValue / 1000;
                }
            }
            continue;
        }
        
        let restOfLine = line;
        let textContent = '';
        while (true) {
            const match = restOfLine.match(timeRegex);
            if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
                const time = minutes * 60 + seconds + milliseconds / 1000 + lrcOffset;
                textContent = match[4].trim();
                if (textContent) {
                    tempLrcData.push({ time, text: textContent });
                }
                restOfLine = textContent;
            } else {
                break;
            }
        }
    }
    tempLrcData.sort((a, b) => a.time - b.time);
    console.log('[Lyrics] LRC Parsed:', tempLrcData);
    return tempLrcData;
}


export function handleLrcFileChange(event, audioCurrentlyLoaded) {
    const file = event.target.files[0];
    if (file && audioCurrentlyLoaded) {
        const reader = new FileReader();
        reader.onload = (e) => {
            resetLyricsState();
            try {
                if (parseAndDisplayLRC(e.target.result, 'file')) {
                    setSuccessMessage(dom.messageArea, 'LRCファイルを読み込みました。');
                } else {
                    setWarningMessage(dom.messageArea, 'LRCファイルに有効な歌詞データがありませんでした。');
                }
            } catch (err) {
                console.error("[Lyrics] LRCファイルのパースエラー:", err);
                setErrorMessage(dom.messageArea, 'LRCファイルの形式が正しくありません。');
                displayFallbackLyricsMessage();
            }
        };
        reader.onerror = () => {
            setErrorMessage(dom.messageArea, 'LRCファイルの読み込みに失敗しました。');
            console.error("[Lyrics] LRCファイルの読み込みエラー");
            resetLyricsUI();
        }
        reader.readAsText(file);
    } else if (!audioCurrentlyLoaded) {
        setErrorMessage(dom.messageArea, '先に音声ファイルを選択してください。');
        if (dom.lrcFileEl) dom.lrcFileEl.value = '';
    }
}

export function clearExternalLyrics() {
    resetLyricsUI();
    if (dom.lrcFileEl) dom.lrcFileEl.value = '';
    setSuccessMessage(dom.messageArea, '歌詞情報をクリアしました。');
}

export function updateLyricsHighlight(currentTime) {
    if (lrcData.length === 0 || !dom.lyricsContainer) return;
    let newCurrentLineIndex = -1;
    for (let i = lrcData.length - 1; i >= 0; i--) {
        if (currentTime >= lrcData[i].time) {
            newCurrentLineIndex = i;
            break;
        }
    }
    if (newCurrentLineIndex !== currentLrcLineIndex) {
        const prevLineEl = dom.lyricsContainer.querySelector('.lyrics-line.highlighted');
        if (prevLineEl) prevLineEl.classList.remove('highlighted');

        if (newCurrentLineIndex !== -1) {
            const currentLineEl = dom.lyricsContainer.querySelector(`.lyrics-line[data-index="${newCurrentLineIndex}"]`);
            if (currentLineEl) {
                currentLineEl.classList.add('highlighted');
                const containerRect = dom.lyricsContainer.getBoundingClientRect();
                const lineRect = currentLineEl.getBoundingClientRect();
                const lineOffsetTopInContainer = currentLineEl.offsetTop - dom.lyricsContainer.offsetTop;
                const desiredScrollTop = lineOffsetTopInContainer - (containerRect.height / 2) + (lineRect.height / 2);
                dom.lyricsContainer.scrollTop = desiredScrollTop;
            }
        }
        currentLrcLineIndex = newCurrentLineIndex;
    }
}

export function loadEmbeddedLyrics(tags) {
    resetLyricsState();
    metadataLyricsSource = null;

    let lyricsText = null;
    if (tags.lyrics) {
        if (typeof tags.lyrics === 'string') lyricsText = tags.lyrics;
        else if (typeof tags.lyrics === 'object' && tags.lyrics.lyrics) lyricsText = tags.lyrics.lyrics;
        else if (Array.isArray(tags.lyrics) && tags.lyrics.length > 0 && tags.lyrics[0].lyrics) lyricsText = tags.lyrics[0].lyrics;
    }
    if (!lyricsText) {
        const commonVorbisContainers = ['vorbisComments', 'comment', 'comments', 'userDefinedInformation'];
        for (const containerName of commonVorbisContainers) {
            if (tags[containerName] && Array.isArray(tags[containerName])) {
                const lyricsComment = tags[containerName].find(comment =>
                    comment && typeof comment.key === 'string' && (comment.key.toUpperCase() === 'LYRICS' || comment.key.toUpperCase() === 'UNSYNCEDLYRICS')
                );
                if (lyricsComment && typeof lyricsComment.value === 'string') {
                    lyricsText = lyricsComment.value;
                    break;
                }
            } else if (tags[containerName] && typeof tags[containerName] === 'object') {
                const commentsObject = tags[containerName];
                if (typeof commentsObject.LYRICS === 'string') { lyricsText = commentsObject.LYRICS; break; }
                else if (typeof commentsObject.UNSYNCEDLYRICS === 'string') { lyricsText = commentsObject.UNSYNCEDLYRICS; break; }
            }
        }
    }
    if (!lyricsText && typeof tags.LYRICS === 'string') lyricsText = tags.LYRICS;
    else if (!lyricsText && typeof tags.USLT === 'string') lyricsText = tags.USLT;


    if (lyricsText && lyricsText.trim()) {
        console.log('[Lyrics] 埋め込み歌詞の内容を取得:', lyricsText.substring(0, 100) + "...");
        if (isLrcString(lyricsText)) {
            console.log('[Lyrics] メタデータ歌詞をLRC形式として認識。');
            try {
                if (parseAndDisplayLRC(lyricsText, 'metadata')) {
                    setSuccessMessage(dom.messageArea, 'メタデータからLRC形式の歌詞を読み込みました。');
                    metadataLyricsSource = 'lrc';
                } else {
                    setWarningMessage(dom.messageArea, 'メタデータLRC歌詞のパース結果が空です。テキストとして表示します。');
                    displayPlainTextLyrics(lyricsText);
                    metadataLyricsSource = 'plain_parse_empty_lrc';
                    ui.setClearLrcButtonEnabled(true);
                }
            } catch (err) {
                console.error("[Lyrics] 埋め込みLRC歌詞のパースエラー:", err);
                setWarningMessage(dom.messageArea, 'メタデータ内のLRC歌詞のパースに失敗しました。テキストとして表示します。');
                displayPlainTextLyrics(lyricsText);
                metadataLyricsSource = 'plain_parse_failed';
                ui.setClearLrcButtonEnabled(true);

            }
        } else {
            console.log('[Lyrics] メタデータ歌詞をプレーンテキストとして認識。');
            displayPlainTextLyrics(lyricsText);
            metadataLyricsSource = 'plain';
            setSuccessMessage(dom.messageArea, 'メタデータから歌詞をテキストとして表示しました（時間同期なし）。');
            ui.setClearLrcButtonEnabled(true);
        }
    } else {
        console.log('[Lyrics] 埋め込み歌詞は見つかりませんでした。');
        displayFallbackLyricsMessage();
        ui.setClearLrcButtonEnabled(false);
    }
}

export function hasLyrics() {
    return lrcData.length > 0 || (metadataLyricsSource === 'plain' && dom.lyricsContainer && dom.lyricsContainer.textContent.trim() !== "" && !dom.lyricsContainer.firstChild?.classList?.contains('text-gray-500'));
}