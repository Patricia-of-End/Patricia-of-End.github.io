// js/audioHeaderParser.js

/**
 * オーディオファイルのヘッダーを読み取り、サンプリングレート、チャンネル数、ビット深度を解析します。
 * @param {File} file - 読み込むFileオブジェクト。
 * @returns {Promise<{sampleRate: number|null, channels: number|null, bitsPerSample: number|null, format: string, bitRate?: number|null}>} - 解析された情報を含むPromise。bitRateは理論値 (kbps)
 */
export function parseAudioHeader(file) {
    return new Promise((resolve, reject) => {
        const sliceSize = Math.min(file.size, 4096); // 最大4KBを読み込む (ヘッダーは通常ファイルの先頭にある)
        const reader = new FileReader();

        reader.onload = (e) => {
            const buffer = e.target.result; // ArrayBuffer
            const view = new DataView(buffer);

            // WAV形式のチェックと解析
            const wavInfo = parseWAVHeader(view);
            if (wavInfo) {
                resolve(wavInfo);
                return;
            }

            // FLAC形式のチェックと解析
            const flacInfo = parseFLACHeader(view);
            if (flacInfo) {
                resolve(flacInfo);
                return;
            }

            // その他（対応していないフォーマット）
            reject(new Error("対応していないオーディオフォーマット、またはヘッダーが見つかりません。"));
        };

        reader.onerror = () => {
            reject(new Error("ファイルの読み込みエラーです。"));
        };

        reader.readAsArrayBuffer(file.slice(0, sliceSize));
    });
}

/**
 * WAVファイルのヘッダーを解析します。
 * @param {DataView} view - ファイルのArrayBufferのDataView。
 * @returns {{sampleRate: number, channels: number, bitsPerSample: number, format: string, bitRate: number}|null}
 */
function parseWAVHeader(view) {
    // 標準的なWAVヘッダーの最小サイズは44バイト（RIFF + WAVE + fmt + dataチャンクのIDとサイズまで）
    if (view.byteLength < 44) {
        console.warn("WAVヘッダーの解析に失敗しました: バッファが小さすぎます。 (byteLength: " + view.byteLength + ")");
        return null;
    }

    // RIFFチャンクディスクリプタ
    // ファイルオフセット: 0, フィールド名: ChunkID, フィールドサイズ: 4バイト, エンディアン: big
    const riffId = readString(view, 0, 4);
    console.log(`WAV Debug: RIFF ID = '${riffId}'`);
    if (riffId !== "RIFF") {
        console.warn("WAVヘッダーの解析に失敗しました: 'RIFF'シグネチャが見つかりません。");
        return null; // RIFFファイルではない
    }

    // ファイルオフセット: 4, フィールド名: ChunkSize, フィールドサイズ: 4バイト, エンディアン: little (デバッグログに追加)
    const totalChunkSize = view.getUint32(4, true);
    console.log(`WAV Debug: Total ChunkSize (file data size) = ${totalChunkSize} bytes`);

    // ファイルオフセット: 8, フィールド名: Format, フィールドサイズ: 4バイト, エンディアン: big
    const waveId = readString(view, 8, 4);
    console.log(`WAV Debug: WAVE ID = '${waveId}'`);
    if (waveId !== "WAVE") {
        console.warn("WAVヘッダーの解析に失敗しました: 'WAVE'フォーマットIDが見つかりません。");
        return null; // WAVファイルではない
    }

    let sampleRate = null;
    let channels = null;
    let bitsPerSample = null;

    // "fmt "サブチャンクと"data"サブチャンクを探索
    // 最初のサブチャンク（通常 "fmt "）から開始するため、オフセット12から探索を開始します。
    let offset = 12;
    let fmtChunkFound = false;

    while (offset < view.byteLength) {
        // チャンクIDとサイズのために少なくとも8バイトが残っていることを確認
        if (offset + 8 > view.byteLength) {
            console.warn(`WAV Debug: バッファの終端に到達。チャンクID/サイズを読み取るのに十分なバイトがありません。 現在のオフセット: ${offset}, バッファ長: ${view.byteLength}`);
            break;
        }

        const chunkId = readString(view, offset, 4);
        const chunkSize = view.getUint32(offset + 4, true); // WAVはサイズにリトルエンディアンを使用
        console.log(`WAV Debug: オフセット ${offset} でチャンク '${chunkId}', サイズ ${chunkSize} バイト`);

        // "fmt "サブチャンクをチェック
        if (chunkId === "fmt ") {
            fmtChunkFound = true;
            // fmtチャンクのデータが範囲内にあることを確認 (少なくとも16バイトのfmtデータが必要)
            if (offset + 8 + 16 > view.byteLength) {
                console.warn("WAVヘッダーの解析: 'fmt 'チャンクデータが不完全です。 (チャンク開始: " + offset + ", チャンクサイズ: " + chunkSize + ", バッファ長: " + view.byteLength + ")");
                break;
            }

            // "fmt "サブチャンクのフィールド（fmtチャンクの開始からの相対オフセットを画像で参照）
            const audioFormat = view.getUint16(offset + 8, true); // オーディオフォーマット (1=PCM)
            console.log(`WAV Debug: AudioFormat = ${audioFormat} (1=PCM, 他の数値は圧縮または拡張フォーマット)`);

            if (audioFormat !== 1) { // PCM形式 (1) のみをサポート
                console.warn(`WAVヘッダーの解析に失敗しました: サポートされていないオーディオフォーマット (${audioFormat})。PCM (1) のみ対応。`);
                return null;
            }

            channels = view.getUint16(offset + 10, true);
            sampleRate = view.getUint32(offset + 12, true);
            bitsPerSample = view.getUint16(offset + 22, true);

            console.log(`WAV Debug: 'fmt 'チャンクから解析された値 - SR: ${sampleRate}, Ch: ${channels}, BPS: ${bitsPerSample}`);
            break; // fmtチャンクが見つかったらループを抜ける
        }

        // 次のチャンクへ移動
        offset += 8 + chunkSize; // チャンクIDの4バイト + チャンクサイズの4バイト + データ部分
        if (offset % 2 !== 0) { // RIFFチャンクは通常ワードアライン（偶数バイト境界）
            offset++;
            console.log(`WAV Debug: 次のチャンクへアライン (オフセット: ${offset})`);
        }
    }

    if (fmtChunkFound && sampleRate > 0 && channels > 0 && bitsPerSample > 0) {
        // 理論上のビットレート (Bps) を計算し、kbpsで返す
        // WAVは非圧縮なので、理論ビットレートは常に (sampleRate * bitsPerSample * channels) / 1000
        const theoreticalBitRateBps = sampleRate * bitsPerSample * channels;
        const theoreticalBitRateKbps = Math.round(theoreticalBitRateBps / 1000);
        console.log(`WAV Debug: 最終結果 - SR: ${sampleRate}, Ch: ${channels}, BPS: ${bitsPerSample}, BitRate: ${theoreticalBitRateKbps} kbps`);

        return {
            sampleRate: sampleRate,
            channels: channels,
            bitsPerSample: bitsPerSample,
            bitRate: theoreticalBitRateKbps, // kbpsで返す
            format: 'WAV'
        };
    } else {
        console.warn(`WAV解析に失敗しました: 'fmt 'チャンクが見つからないか、無効な値が検出されました。SR: ${sampleRate}, Ch: ${channels}, BPS: ${bitsPerSample}`);
        return null; // 必要な情報が見つからないか、無効な値
    }
}

/**
 * FLACファイルのヘッダーを解析します。
 * @param {DataView} view - ファイルのArrayBufferのDataView。
 * @returns {{sampleRate: number, channels: number, bitsPerSample: number, format: string, bitRate: number}|null}
 */
function parseFLACHeader(view) {
    if (view.byteLength < 34) { // "fLaC"シグネチャ(4) + STREAMINFOブロックヘッダー(4) + STREAMINFOデータ(26)
        console.warn("FLACヘッダー解析失敗: バッファが小さすぎます。 (byteLength: " + view.byteLength + ")");
        return null;
    }

    const flacId = readString(view, 0, 4); // "fLaC"シグネチャ
    console.log(`FLAC Debug: FLAC ID = '${flacId}'`);
    if (flacId !== "fLaC") {
        console.warn("FLACヘッダー解析失敗: 'fLaC'シグネチャが見つかりません。");
        return null; // FLACファイルではない
    }

    // メタデータブロックヘッダー (4バイト目)
    const blockHeaderByte = view.getUint8(4);
    const blockType = (blockHeaderByte & 0x7F); // 下位7ビット
    const isLastBlock = (blockHeaderByte & 0x80) !== 0; // 最上位ビット
    console.log(`FLAC Debug: MetaData Block Header Byte = 0x${blockHeaderByte.toString(16)}, Block Type = ${blockType} (0=STREAMINFO), Is Last Block: ${isLastBlock}`);


    if (blockType !== 0) { // STREAMINFOブロック (タイプ0) ではない
        console.warn(`FLACヘッダー解析失敗: 最初のメタデータブロックがSTREAMINFOではありません (タイプ: ${blockType})。`);
        return null; // 最初のメタデータブロックはSTREAMINFOである必要がある
    }

    // STREAMINFOブロックのデータ部分 (26バイト) は viewのオフセット8 から始まる
    // 参照: https://xiph.org/flac/format.html#metadata_block_streaminfo

    // Sample Rate (20 bits): ビットオフセット80 (viewの絶対オフセット18) から始まる
    // This spans view.getUint8(18), view.getUint8(19), view.getUint8(20)
    // The 20 bits for sample rate are (from MSB to LSB):
    // 8 bits from byte 18, 8 bits from byte 19, 4 bits from byte 20 (upper 4 bits)

    if (view.byteLength < 21) { // Ensure bytes 18, 19, 20 are available for reading
        console.warn("FLACヘッダー解析失敗: Sample Rateの読み取りに十分なバイトがありません。");
        return null;
    }
    const byte18 = view.getUint8(18); // Contains bits 80-87
    const byte19 = view.getUint8(19); // Contains bits 88-95
    const byte20 = view.getUint8(20); // Contains bits 96-99 (upper 4 bits) and channels/bps

    const parsedSampleRate = (
        (byte18 << 12) |            // Shift byte 18 to position 12 (bits 80-87)
        (byte19 << 4) |             // Shift byte 19 to position 4 (bits 88-95)
        (byte20 >>> 4)              // Get top 4 bits of byte 20 (bits 96-99)
    );

    // Channels (3 bits): Bit offset 100 (from STREAMINFO block start)
    // These are bits 4-6 of byte 20.
    const parsedChannels = ((byte20 & 0b00001110) >> 1) + 1; // 0=モノラル -> 1ch, 1=ステレオ -> 2ch など

    // Bits Per Sample (5 bits): Bit offset 103 (from STREAMINFO block start)
    // These are bit 7 of byte 20, and bits 0-3 of byte 21.
    if (view.byteLength < 22) { // Ensure byte 21 is available
        console.warn("FLACヘッダー解析失敗: Bits Per Sampleの読み取りに十分なバイトがありません。");
        return null;
    }
    const byte21 = view.getUint8(21); // Contains bits 104-107 (lower 4 bits of bps)

    const parsedBitsPerSample = (
        ((byte20 & 0b00000001) << 4) | // バイト20のビット7（1ビット）を取得し、5ビットの最上位にシフト
        (byte21 >>> 4) // バイト21の上位4ビット（4ビット）を取得。FLACのBits Per Sampleは1から始まるため、+1が必要
    ) + 1; // FLACのBits Per Sampleは0が1bit、1が2bit...となるため、+1する


    // ★デバッグ用ログを強化
    console.log(`FLAC Raw Bytes (offsets 18-21 for SR/Ch/BPS): ${
        byte18.toString(16).padStart(2, '0')} ${
        byte19.toString(16).padStart(2, '0')} ${
        byte20.toString(16).padStart(2, '0')} ${
        byte21.toString(16).padStart(2, '0')}`);
    console.log(`FLAC (Parsed Final Debug) - SR: ${parsedSampleRate}, Ch: ${parsedChannels}, BPS: ${parsedBitsPerSample}`); // デバッグ用

    if (parsedSampleRate > 0 && parsedChannels > 0 && parsedBitsPerSample >= 8 && parsedBitsPerSample <= 32) { // ビット深度の範囲もチェック
        const theoreticalBitRateBps = parsedSampleRate * parsedBitsPerSample * parsedChannels;
        const theoreticalBitRateKbps = Math.round(theoreticalBitRateBps / 1000); // Bps -> kbps

        console.log(`FLAC (Parsed Final Debug) - Theoretical BitRate (kbps): ${theoreticalBitRateKbps}`); // デバッグログ

        return {
            sampleRate: parsedSampleRate,
            channels: parsedChannels,
            bitsPerSample: parsedBitsPerSample,
            bitRate: theoreticalBitRateKbps, // 計算したKBPS値を返す
            format: 'FLAC'
        };
    }
    console.warn(`FLAC解析に失敗しました: 無効な値が検出されました。SR: ${parsedSampleRate}, Ch: ${parsedChannels}, BPS: ${parsedBitsPerSample}`);
    return null; // 必要な情報が見つからなかった、または無効な値
}

/**
 * DataViewから指定したバイト数の文字列を読み取ります。
 * @param {DataView} view
 * @param {number} offset
 * @param {number} length
 * @returns {string}
 */
function readString(view, offset, length) {
    let s = '';
    try {
        for (let i = 0; i < length; i++) {
            s += String.fromCharCode(view.getUint8(offset + i));
        }
    } catch (e) {
        console.error(`オフセット${offset}、長さ${length}で文字列の読み取り中にエラーが発生しました:`, e);
        return ''; // エラー時は空文字列を返す
    }
    return s;
}