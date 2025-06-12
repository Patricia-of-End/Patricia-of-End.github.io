// js/lyricsHandler.js

// 必要なモジュールとユーティリティ関数をインポート
import * as dom from './domElements.js'; // DOM要素を扱うモジュール
import * as ui from './ui.js'; // UI関連の処理を扱うモジュール
import * as visualizer from './visualizer.js'; // ★ visualizerをインポート (AudioContextの操作に使用)
import { setSuccessMessage, setErrorMessage, setWarningMessage, isLrcString, unescapeHtmlForLyrics } from './utils.js'; // メッセージ表示やLRC関連のユーティリティ

export let lrcData = []; // 解析されたLRC歌詞データを保持する配列
export let currentLrcLineIndex = -1; // 現在ハイライトされている歌詞行のインデックス
let metadataLyricsSource = null; // 歌詞のソース（メタデータ埋め込みのLRC/プレーンテキスト、外部LRCファイルなど）

/**
 * 歌詞関連の全ての状態を初期値にリセットします。
 */
export function resetLyricsState() {
    lrcData = []; // 歌詞データを空にする
    currentLrcLineIndex = -1; // 現在の歌詞行インデックスをリセット
    metadataLyricsSource = null; // 歌詞ソースをリセット
}

/**
 * 歌詞表示UIと関連する状態をリセットし、フォールバックメッセージを表示します。
 */
export function resetLyricsUI() {
    resetLyricsState(); // 歌詞の状態をリセット
    displayFallbackLyricsMessage(); // フォールバックメッセージを表示
    ui.setClearLrcButtonEnabled(false); // 歌詞クリアボタンを無効化
}

/**
 * LRCコンテンツを解析し、問題がなければUIに表示します。
 * @param {string} lrcContent - 解析するLRCフォーマットの文字列。
 * @param {string} source - 歌詞のソース ('metadata' または 'file')。
 * @returns {boolean} - 歌詞が正常に解析され表示された場合は true、そうでない場合は false。
 */
function parseAndDisplayLRC(lrcContent, source) {
    const parsed = parseLRC(lrcContent); // LRCコンテンツを解析
    if (parsed.length > 0) {
        lrcData = parsed; // 解析結果をグローバル変数に格納
        displayLrcLines(); // 歌詞を行ごとに表示
        metadataLyricsSource = (source === 'metadata') ? 'lrc' : null; // メタデータ由来のLRCか記録
        ui.setClearLrcButtonEnabled(true); // 歌詞クリアボタンを有効化
        return true;
    }
    lrcData = []; // 解析失敗時はLRCデータをクリア
    return false;
}

/**
 * 解析されたLRCデータをHTML要素として表示します。
 * 各行にはクリックイベントリスナーが追加され、クリックでその行のタイムスタンプにシークします。
 */
function displayLrcLines() {
    if (!dom.lyricsContainer) return; // 歌詞コンテナがなければ処理しない
    dom.lyricsContainer.innerHTML = ''; // 既存の歌詞をクリア
    if (lrcData.length === 0) {
        displayFallbackLyricsMessage(); // 歌詞データがなければフォールバックメッセージを表示
        return;
    }

    lrcData.forEach((line, index) => {
        const p = document.createElement('p'); // 各歌詞行のためのp要素を作成
        p.textContent = unescapeHtmlForLyrics(line.text); // HTMLエスケープ解除済みのテキストを設定
        p.classList.add('lyrics-line'); // スタイル用のクラスを追加
        p.dataset.index = index; // データインデックスを設定
        p.dataset.time = line.time; // データタイムスタンプを設定

        // ★★★ ここが修正のポイント ★★★
        // 歌詞行がクリックされたときのイベントリスナー
        p.addEventListener('click', async () => { // ★ async に変更 (AudioContextのawaitのため)
            const currentPlayer = dom.audioPlayer; // 現在のオーディオプレーヤー要素

            console.log(`[Lyrics] Line clicked. Time: ${line.time}, Target audioPlayer:`, currentPlayer);

            if (currentPlayer && typeof line.time === 'number') {
                // 再生を開始する前に、AudioContextの状態を確実にする
                await visualizer.ensureAudioContextResumed(); // ★ この行を追加: AudioContextが'suspended'状態でないことを保証

                currentPlayer.currentTime = line.time; // クリックされた歌詞のタイムスタンプにシーク
                console.log(`[Lyrics] Set audioPlayer.currentTime to ${line.time}`);

                if (currentPlayer.paused) {
                    // もしオーディオが一時停止中であれば再生を開始
                    currentPlayer.play().catch(e => console.error("[Lyrics] Play error on lyric click:", e)); // 再生エラーをキャッチ
                }
                // もし既に再生中なら、シークするだけで何もしなくてもビジュアライザーは動き続ける
            } else {
                console.warn("[Lyrics] Could not seek. Conditions not met."); // シークできない場合の警告
            }
        });
        dom.lyricsContainer.appendChild(p); // 歌詞コンテナにp要素を追加
    });
}

/**
 * プレーンテキスト形式の歌詞をUIに表示します。
 * (LRCフォーマットではないため、時間同期は行われません)
 * @param {string} plainText - 表示するプレーンテキスト。
 */
function displayPlainTextLyrics(plainText) {
    if (!dom.lyricsContainer) return; // 歌詞コンテナがなければ処理しない
    lrcData = []; // LRCデータは空にする
    currentLrcLineIndex = -1; // 現在の歌詞行インデックスをリセット
    dom.lyricsContainer.innerHTML = ''; // 既存の歌詞をクリア
    if (!plainText || !plainText.trim()) {
        // テキストが空の場合のメッセージ
        dom.lyricsContainer.innerHTML = '<p class="text-slate-500">メタデータに歌詞はありますが、内容は空です。</p>';
        return;
    }
    const lines = plainText.split('\n'); // 改行で歌詞を行に分割
    lines.forEach(line => {
        const p = document.createElement('p'); // 各歌詞行のためのp要素を作成
        p.textContent = unescapeHtmlForLyrics(line.trim()); // HTMLエスケープ解除済みのテキストを設定
        p.classList.add('lyrics-line'); // スタイル用のクラスを追加
        p.style.cursor = 'default'; // クリックできないようにカーソルをデフォルトに
        dom.lyricsContainer.appendChild(p); // 歌詞コンテナにp要素を追加
    });
}

/**
 * 歌詞が表示されていない場合のフォールバックメッセージをUIに表示します。
 */
function displayFallbackLyricsMessage() {
    if (dom.lyricsContainer) {
        dom.lyricsContainer.innerHTML = '<p class="text-gray-500">LRCファイルを読み込むか、音声ファイルに歌詞情報が含まれていれば表示されます。</p>';
    }
}

/**
 * LRCフォーマットの文字列を解析し、時間とテキストのオブジェクトの配列を返します。
 * @param {string} lrcContent - 解析するLRCフォーマットの文字列。
 * @returns {{time: number, text: string}[]} - 解析された歌詞データの配列。
 */
function parseLRC(lrcContent) {
    let tempLrcData = []; // 一時的な歌詞データ格納用配列
    const lines = lrcContent.split('\n'); // LRCファイルを改行で分割
    // 時間タグとテキストを抽出する正規表現
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    // メタデータタグを抽出する正規表現 (アーティスト、タイトル、アルバム、作成者、オフセットなど)
    const metaRegex = /\[(ar|ti|al|by|offset):(.+)\]/;
    let lrcOffset = 0; // LRCファイル内のオフセット（ミリ秒単位）

    for (const line of lines) {
        const metaMatch = line.match(metaRegex); // メタデータタグをチェック
        if (metaMatch) {
            const key = metaMatch[1].toLowerCase(); // タグのキー
            const value = metaMatch[2].trim(); // タグの値
            if (key === 'offset') {
                const offsetValue = parseInt(value, 10); // オフセット値を整数に変換
                if (!isNaN(offsetValue)) {
                    lrcOffset = offsetValue / 1000; // ミリ秒を秒に変換してオフセットに設定
                }
            }
            continue; // メタデータ行はスキップ
        }

        let restOfLine = line;
        let textContent = '';
        while (true) {
            const match = restOfLine.match(timeRegex); // 時間タグをチェック
            if (match) {
                const minutes = parseInt(match[1], 10); // 分を抽出
                const seconds = parseInt(match[2], 10); // 秒を抽出
                const milliseconds = parseInt(match[3].padEnd(3, '0'), 10); // ミリ秒を抽出 (2桁または3桁に対応)
                // 時間を秒単位に変換し、オフセットを加算
                const time = minutes * 60 + seconds + milliseconds / 1000 + lrcOffset;
                textContent = match[4].trim(); // 時間タグ以降のテキスト内容
                if (textContent) {
                    tempLrcData.push({ time, text: textContent }); // 時間とテキストをデータに追加
                }
                restOfLine = textContent; // 複数タイムスタンプ行に対応するため、残りの行を更新
            } else {
                break; // 時間タグが見つからなければループ終了
            }
        }
    }
    tempLrcData.sort((a, b) => a.time - b.time); // 時間でソート
    console.log('[Lyrics] LRC Parsed:', tempLrcData); // 解析結果をログ出力
    return tempLrcData;
}

/**
 * 外部LRCファイルが選択されたときのハンドラ。
 * @param {Event} event - ファイル入力イベント。
 * @param {boolean} audioCurrentlyLoaded - 現在音声ファイルが読み込まれているかどうか。
 */
export function handleLrcFileChange(event, audioCurrentlyLoaded) {
    const file = event.target.files[0]; // 選択されたファイルを取得
    if (file && audioCurrentlyLoaded) {
        const reader = new FileReader(); // FileReaderを作成
        reader.onload = (e) => {
            resetLyricsState(); // 既存の歌詞状態をリセット
            try {
                if (parseAndDisplayLRC(e.target.result, 'file')) {
                    setSuccessMessage(dom.messageArea, 'LRCファイルを読み込みました。'); // 成功メッセージ
                } else {
                    setWarningMessage(dom.messageArea, 'LRCファイルに有効な歌詞データがありませんでした。'); // 警告メッセージ
                }
            } catch (err) {
                console.error("[Lyrics] LRCファイルのパースエラー:", err); // パースエラーをログ出力
                setErrorMessage(dom.messageArea, 'LRCファイルの形式が正しくありません。'); // エラーメッセージ
                displayFallbackLyricsMessage(); // フォールバックメッセージを表示
            }
        };
        reader.onerror = () => {
            setErrorMessage(dom.messageArea, 'LRCファイルの読み込みに失敗しました。'); // 読み込みエラーメッセージ
            console.error("[Lyrics] LRCファイルの読み込みエラー"); // 読み込みエラーをログ出力
            resetLyricsUI(); // UIをリセット
        }
        reader.readAsText(file); // ファイルをテキストとして読み込む
    } else if (!audioCurrentlyLoaded) {
        setErrorMessage(dom.messageArea, '先に音声ファイルを選択してください。'); // 音声ファイルが未選択の場合のエラーメッセージ
        if (dom.lrcFileEl) dom.lrcFileEl.value = ''; // LRCファイル入力の値をクリア
    }
}

/**
 * 外部LRC歌詞をクリアし、UIをリセットします。
 */
export function clearExternalLyrics() {
    resetLyricsUI(); // 歌詞UIをリセット
    if (dom.lrcFileEl) dom.lrcFileEl.value = ''; // ファイル入力の値をクリア
    setSuccessMessage(dom.messageArea, '歌詞情報をクリアしました。'); // 成功メッセージ
}

/**
 * 現在の再生時間に基づいて歌詞のハイライトを更新します。
 * @param {number} currentTime - 現在のオーディオ再生時間（秒）。
 */
export function updateLyricsHighlight(currentTime) {
    if (lrcData.length === 0 || !dom.lyricsContainer) return; // 歌詞データまたはコンテナがなければ処理しない

    let newCurrentLineIndex = -1;
    // 現在の再生時間に対応する歌詞行を逆順で検索
    for (let i = lrcData.length - 1; i >= 0; i--) {
        if (currentTime >= lrcData[i].time) {
            newCurrentLineIndex = i;
            break;
        }
    }

    // ハイライトする歌詞行が変わった場合のみ更新
    if (newCurrentLineIndex !== currentLrcLineIndex) {
        // 前のハイライトを解除
        const prevLineEl = dom.lyricsContainer.querySelector('.lyrics-line.highlighted');
        if (prevLineEl) prevLineEl.classList.remove('highlighted');

        if (newCurrentLineIndex !== -1) {
            // 新しい歌詞行をハイライト
            const currentLineEl = dom.lyricsContainer.querySelector(`.lyrics-line[data-index="${newCurrentLineIndex}"]`);
            if (currentLineEl) {
                currentLineEl.classList.add('highlighted');

                // 歌詞コンテナ内でハイライトされた行が中央に来るようにスクロール
                const containerRect = dom.lyricsContainer.getBoundingClientRect();
                const lineRect = currentLineEl.getBoundingClientRect();
                const lineOffsetTopInContainer = currentLineEl.offsetTop - dom.lyricsContainer.offsetTop;
                const desiredScrollTop = lineOffsetTopInContainer - (containerRect.height / 2) + (lineRect.height / 2);
                dom.lyricsContainer.scrollTop = desiredScrollTop;
            }
        }
        currentLrcLineIndex = newCurrentLineIndex; // 現在の歌詞行インデックスを更新
    }
}

/**
 * ファイルのメタデータから埋め込み歌詞を読み込み、表示します。
 * @param {object} tags - jsmediatagsから取得したメタデータタグオブジェクト。
 */
export function loadEmbeddedLyrics(tags) {
    resetLyricsState(); // 歌詞の状態をリセット
    metadataLyricsSource = null; // 歌詞ソースをリセット

    let lyricsText = null;
    // 複数のパスから歌詞データを試行錯誤して取得
    if (tags.lyrics) {
        if (typeof tags.lyrics === 'string') lyricsText = tags.lyrics;
        else if (typeof tags.lyrics === 'object' && tags.lyrics.lyrics) lyricsText = tags.lyrics.lyrics;
        else if (Array.isArray(tags.lyrics) && tags.lyrics.length > 0 && tags.lyrics[0].lyrics) lyricsText = tags.lyrics[0].lyrics;
    }
    if (!lyricsText) {
        // Vorbisコメントのような一般的なコンテナから歌詞を検索
        const commonVorbisContainers = ['vorbisComments', 'comment', 'comments', 'userDefinedInformation'];
        for (const containerName of commonVorbisContainers) {
            if (tags[containerName] && Array.isArray(tags[containerName])) {
                const lyricsComment = tags[containerName].find(comment =>
                    // 'LYRICS' または 'UNSYNCEDLYRICS' キーを持つコメントを探す
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
    // その他の一般的なタグから歌詞を検索
    if (!lyricsText && typeof tags.LYRICS === 'string') lyricsText = tags.LYRICS;
    else if (!lyricsText && typeof tags.USLT === 'string') lyricsText = tags.USLT;


    if (lyricsText && lyricsText.trim()) { // 歌詞テキストが存在し、空でない場合
        console.log('[Lyrics] 埋め込み歌詞の内容を取得:', lyricsText.substring(0, 100) + "..."); // 歌詞の内容をログ出力
        if (isLrcString(lyricsText)) { // LRCフォーマットであるかを判定
            console.log('[Lyrics] メタデータ歌詞をLRC形式として認識。');
            try {
                if (parseAndDisplayLRC(lyricsText, 'metadata')) { // LRCとして解析し表示
                    setSuccessMessage(dom.messageArea, 'メタデータからLRC形式の歌詞を読み込みました。');
                    metadataLyricsSource = 'lrc';
                } else {
                    // LRC形式だが、解析結果が空の場合
                    setWarningMessage(dom.messageArea, 'メタデータLRC歌詞のパース結果が空です。テキストとして表示します。');
                    displayPlainTextLyrics(lyricsText); // プレーンテキストとして表示
                    metadataLyricsSource = 'plain_parse_empty_lrc';
                    ui.setClearLrcButtonEnabled(true);
                }
            } catch (err) {
                // LRC解析中にエラーが発生した場合
                console.error("[Lyrics] 埋め込みLRC歌詞のパースエラー:", err);
                setWarningMessage(dom.messageArea, 'メタデータ内のLRC歌詞のパースに失敗しました。テキストとして表示します。');
                displayPlainTextLyrics(lyricsText); // プレーンテキストとして表示
                metadataLyricsSource = 'plain_parse_failed';
                ui.setClearLrcButtonEnabled(true);
            }
        } else {
            // LRC形式ではない場合、プレーンテキストとして表示
            console.log('[Lyrics] メタデータ歌詞をプレーンテキストとして認識。');
            displayPlainTextLyrics(lyricsText);
            metadataLyricsSource = 'plain';
            setSuccessMessage(dom.messageArea, 'メタデータから歌詞をテキストとして表示しました（時間同期なし）。');
            ui.setClearLrcButtonEnabled(true);
        }
    } else {
        // 埋め込み歌詞が見つからない場合
        console.log('[Lyrics] 埋め込み歌詞は見つかりませんでした。');
        displayFallbackLyricsMessage(); // フォールバックメッセージを表示
        ui.setClearLrcButtonEnabled(false); // 歌詞クリアボタンを無効化
    }
}

/**
 * 現在歌詞が表示されているか（LRCデータがあるか、またはプレーンテキスト歌詞があるか）を判定します。
 * @returns {boolean} - 歌詞がある場合は true、そうでない場合は false。
 */
export function hasLyrics() {
    // LRCデータがあるか、またはプレーンテキスト歌詞が表示されており、かつフォールバックメッセージではない場合
    return lrcData.length > 0 || (metadataLyricsSource === 'plain' && dom.lyricsContainer && dom.lyricsContainer.textContent.trim() !== "" && !dom.lyricsContainer.firstChild?.classList?.contains('text-gray-500'));
}
