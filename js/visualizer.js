// js/visualizer.js

import * as dom from './domElements.js'; // DOM要素を扱うモジュールをインポート
import { setErrorMessage } from './utils.js'; // エラーメッセージ表示ユーティリティをインポート

// --- グローバル変数 ---
let audioContext = null; // AudioContextインスタンスを保持します。
let sourceNode = null; // オーディオソースノード（HTMLMediaElementSourceNode）を保持します。
let analyser = null; // アナライザーノード（周波数データを取得するため）を保持します。
let frequencyData; // アナライザーから取得する周波数データ（Uint8Array）を保持します。
let renderFrameId; // requestAnimationFrameのID（ビジュアライザー描画ループ用）を保持します。
let visualizerCtx; // ビジュアライザーCanvasの2Dコンテキストを保持します。

let eqBands = []; // イコライザーバンドフィルターの配列（BiquadFilterNode）を保持します。
const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]; // 各EQバンドの中心周波数を定義します。
let currentGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 各EQバンドの現在のゲイン値（dB）を保持します。

let bassFilter = null; // 低音調整用フィルター（lowshelf）を保持します。
let trebleFilter = null; // 高音調整用フィルター（highshelf）を保持します。
let currentTone = { bass: 0, treble: 0 }; // 現在のトーンコントロール設定を保持します。

let stereo_splitter = null; // ステレオ信号をL/Rチャンネルに分割するためのChannelSplitterNodeを保持します。
let stereo_merger = null; // L/Rチャンネルをステレオ信号に結合するためのChannelMergerNodeを保持します。
let stereo_delay = null; // ステレオ拡張のための遅延ノード（DelayNode）を保持します。
let currentStereoDelay = 0; // 現在のステレオ遅延時間（秒）を保持します。

let reverbNode = null; // リバーブ効果を生成するConvolverNodeを保持します。
let preDelayNode = null; // リバーブのプリディレイ用DelayNodeを保持します。
let reverbDampFilter = null; // リバーブのダンピング（高域減衰）用BiquadFilterNodeを保持します。
let wetGainNode = null; // リバーブ音（ウェット信号）のゲインノードを保持します。
let dryGainNode = null; // 原音（ドライ信号）のゲインノードを保持します。
let currentAmbience = { mix: 0, preDelay: 0, damp: 22050 }; // 現在のアンビエンス設定を保持します。

let vocalCut_splitter = null; // ボーカルカット用スプリッターを保持します。
let vocalCut_inverter = null; // ボーカルカット用反転ゲインノード（ゲイン値-1）を保持します。
let vocalCut_merger = null; // ボーカルカット用マージノードを保持します。
let vocalCut_onGain = null; // ボーカルカットON時のゲインノードを保持します。
let vocalCut_offGain = null; // ボーカルカットOFF時のゲインノードを保持します。
let isVocalCutEnabled = false; // ボーカルカットが現在有効かどうかのフラグを保持します。


/**
 * AudioContextとオーディオ処理グラフを構築します。
 * 音声要素からの出力を、ボーカルカット、トーンコントロール、イコライザー、
 * ステレオ拡張、アンビエンス（リバーブ）の各エフェクトノードを介して、
 * 最終的にアナライザーとオーディオ出力に接続します。
 * @param {HTMLAudioElement} audioElement - 音声データを提供するHTMLAudioElement。
 * @returns {boolean} - グラフが正常に作成された場合はtrue、失敗した場合はfalse。
 */
function createAudioGraph(audioElement) {
    // AudioContextが存在しない、または閉じている場合は新しく作成します。
    if (!audioContext || audioContext.state === 'closed') {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            // AudioContextの初期化に失敗した場合、エラーメッセージを表示してfalseを返します。
            setErrorMessage(dom.messageArea, "AudioContextの初期化に失敗しました。このブラウザは対応していないか、セキュリティ制限があります。");
            console.error("Failed to initialize AudioContext:", e);
            return false;
        }
    }

    // --- 1. 全てのノードを作成 & 初期化 ---
    // イコライザーバンドフィルターを初期化します。
    eqBands = EQ_FREQUENCIES.map((f, i) => {
        const F = audioContext.createBiquadFilter();
        F.type = 'peaking'; // ピーキングフィルタータイプを使用します。
        F.frequency.value = f; // 各バンドの中心周波数を設定します。
        F.Q.value = 1.5; // Q値（帯域幅）を設定します。
        F.gain.value = currentGains[i]; // 初期ゲインを設定します。
        return F;
    });

    // バストーンフィルターを初期化します。
    bassFilter = audioContext.createBiquadFilter();
    bassFilter.type = 'lowshelf'; // ローシェルフフィルタータイプを使用します。
    bassFilter.frequency.value = 200; // 低音の周波数を設定します。
    bassFilter.gain.value = currentTone.bass; // 初期ゲインを設定します。

    // トレブルトーンフィルターを初期化します。
    trebleFilter = audioContext.createBiquadFilter();
    trebleFilter.type = 'highshelf'; // ハイシェルフフィルタータイプを使用します。
    trebleFilter.frequency.value = 5000; // 高音の周波数を設定します。
    trebleFilter.gain.value = currentTone.treble; // 初期ゲインを設定します。

    // アナライザーノードを初期化します。
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // FFTサイズ（周波数データ点の数）を設定します。
    frequencyData = new Uint8Array(analyser.frequencyBinCount); // 周波数データ格納用配列を作成します。

    // リバーブ関連ノードを初期化します。
    preDelayNode = audioContext.createDelay(1.0); // プリディレイノードを作成します（最大1秒遅延）。
    preDelayNode.delayTime.value = currentAmbience.preDelay; // 初期プリディレイ時間を設定します。
    reverbNode = audioContext.createConvolver(); // コンボルバーノード（インパルス応答用）を作成します。
    reverbDampFilter = audioContext.createBiquadFilter(); // ダンピングフィルターを作成します。
    reverbDampFilter.type = 'lowpass'; // ローパスフィルタータイプを使用します。
    reverbDampFilter.frequency.value = currentAmbience.damp; // 初期周波数を設定します。
    dryGainNode = audioContext.createGain(); // ドライ信号用ゲインノードを作成します。
    wetGainNode = audioContext.createGain(); // ウェット信号用ゲインノードを作成します。
    setReverbMix(currentAmbience.mix); // 初期リバーブミックスを設定します。

    // ステレオ拡張関連ノードを初期化します。
    stereo_splitter = audioContext.createChannelSplitter(2); // 2チャンネルに分割するスプリッターを作成します。
    stereo_merger = audioContext.createChannelMerger(2); // 2チャンネルを結合するマージャーを作成します。
    stereo_delay = audioContext.createDelay(0.1); // 遅延ノードを作成します（最大0.1秒遅延）。
    setStereoWidth(currentStereoDelay); // 初期ステレオ幅を設定します。

    // ボーカルカット関連ノードを初期化します。
    vocalCut_splitter = audioContext.createChannelSplitter(2); // 2チャンネルに分割するスプリッターを作成します。
    vocalCut_inverter = audioContext.createGain(); // ゲインノードを作成します。
    vocalCut_inverter.gain.value = -1; // 位相を反転させるためにゲインを-1に設定します。
    vocalCut_merger = audioContext.createGain(); // マージノードを作成します。
    vocalCut_onGain = audioContext.createGain(); // ボーカルカットON時のゲインノードを作成します。
    vocalCut_offGain = audioContext.createGain(); // ボーカルカットOFF時のゲインノードを作成します。
    setVocalCut(isVocalCutEnabled); // 初期ボーカルカット状態を設定します。

    // インパルス応答を生成し、リバーブノードに設定します（非同期処理）。
    generateImpulseResponse().then(impulse => {
        if(reverbNode) reverbNode.buffer = impulse;
    }).catch(e => console.error("Error generating impulse response:", e)); // エラーが発生した場合のログ出力

    // 既存のsourceNodeがあれば切断します。
    if (sourceNode) sourceNode.disconnect();
    try {
        // HTMLAudioElementからMediaElementSourceNodeを作成します。
        sourceNode = audioContext.createMediaElementSource(audioElement);
    } catch (e) {
        // オーディオソースの作成に失敗した場合、エラーメッセージを表示してfalseを返します。
        setErrorMessage(dom.messageArea, "オーディオソースの作成に失敗しました。ファイルの形式が対応していない可能性があります。");
        console.error("Failed to create MediaElementSourceNode:", e);
        return false;
    }

    // --- 2. ノードを順番に接続 ---
    let lastNode = sourceNode; // 接続の起点となるノードを設定します。

    // Stage 1: ボーカルカット（簡易的なMid-Side処理）
    const vocalCutOutput = audioContext.createGain(); // ボーカルカット処理の出力ノードを作成します。
    // ONのパス: source -> splitter -> (L->merger, R->inverter->merger) -> onGain -> vocalCutOutput
    // このパスは、左右チャンネルの差分信号（サイド成分）を強調することでボーカルを抑制する簡易的な方法です。
    lastNode.connect(vocalCut_splitter); // ソースノードをスプリッターに接続します。
    // スプリッターの左チャンネル (出力0) をボーカルカットのゲインノード（vocalCut_merger）の入力0へ接続
    vocalCut_splitter.connect(vocalCut_merger, 0, 0); // inputIndexを明示

    // スプリッターの右チャンネル (出力1) をインバーターの入力0へ接続
    vocalCut_splitter.connect(vocalCut_inverter, 1, 0); // inputIndexを明示

    // インバーターの出力 (反転された右チャンネル) をボーカルカットのゲインノード（vocalCut_merger）の入力0へ接続
    vocalCut_inverter.connect(vocalCut_merger, 0, 0); // inputIndexを明示

    // vocalCut_mergerからの出力（L + (-R)のモノラル信号）をonGainノード経由で最終出力へ
    vocalCut_merger.connect(vocalCut_onGain).connect(vocalCutOutput);

    // ボーカルカットのOFFパス（元の信号をバイパス）
    // lastNode (元のソース) をoffGainノード経由で最終出力へ
    lastNode.connect(vocalCut_offGain).connect(vocalCutOutput);

    lastNode = vocalCutOutput; // 次のステージの入力はボーカルカットの出力ノードになります。

    // Stage 2: トーンコントロール（BassとTreble）
    lastNode.connect(bassFilter); // 現在の出力からバスフィルターへ接続します。
    bassFilter.connect(trebleFilter); // バスフィルターからトレブルフィルターへ接続します。
    lastNode = trebleFilter; // 次のステージの入力はトレブルフィルターになります。

    // Stage 3: グラフィックイコライザー
    // イコライザーバンドの配列を順番に接続します（reduceを使用して、前のフィルターの出力を次のフィルターの入力に接続）。
    lastNode = eqBands.reduce((prevNode, currentFilter) => prevNode.connect(currentFilter), lastNode);

    // Stage 4: ステレオ拡張（ハーアス効果を利用した簡易的なステレオ拡張）
    lastNode.connect(stereo_splitter); // 現在の出力からステレオ分割器へ接続します。
    stereo_splitter.connect(stereo_merger, 0, 0); // 左チャンネルをマージノードの左入力へ接続します。
    stereo_splitter.connect(stereo_delay, 1, 0).connect(stereo_merger, 0, 1); // 右チャンネルを遅延ノード経由でマージノードの右入力へ接続します。
    lastNode = stereo_merger; // 次のステージの入力はステレオ結合ノードになります。

    // Stage 5: アンビエンス（リバーブ）
    const masterOutput = audioContext.createGain(); // 最終的なマスター出力ノードを作成します。
    // ドライ信号のパス: lastNode -> dryGainNode -> masterOutput
    lastNode.connect(dryGainNode).connect(masterOutput); // 現在の出力からドライゲインノード経由でマスター出力へ接続します。
    // ウェット信号のパス: lastNode -> preDelayNode -> reverbNode -> reverbDampFilter -> wetGainNode -> masterOutput
    lastNode.connect(preDelayNode).connect(reverbNode).connect(reverbDampFilter).connect(wetGainNode).connect(masterOutput); // 現在の出力からプリディレイノード、リバーブノードなどを経由してマスター出力へ接続します。
    lastNode = masterOutput; // 次のステージの入力はマスター出力ノードになります。

    // Stage 6: 最終出力（アナライザーとAudioContext.destination）
    lastNode.connect(analyser); // マスター出力からアナライザーへ接続します。
    analyser.connect(audioContext.destination); // アナライザーからAudioContextの最終出力（スピーカーなど）へ接続します。

    return true; // グラフ構築成功
}

/**
 * リバーブ用のインパルス応答バッファを生成します。
 * これは、リバーブの音響特性を定義するノイズの短いバッファです。
 * @returns {Promise<AudioBuffer>} - 生成されたAudioBufferを解決するPromise。
 */
async function generateImpulseResponse() {
    if (!audioContext) return null;
    const sampleRate = audioContext.sampleRate; // AudioContextのサンプリングレートを取得します。
    const duration = 2; // インパルス応答の長さ（秒）を設定します。
    const decay = 2; // 減衰の度合いを設定します。
    const length = sampleRate * duration; // バッファのフレーム数を計算します。
    const impulse = audioContext.createBuffer(2, length, sampleRate); // 2チャンネル、指定長さ、サンプリングレートでバッファを作成します。

    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel); // 各チャンネルのFloat32Arrayを取得します。
        for (let i = 0; i < length; i++) {
            // ランダムなノイズを生成し、時間の経過とともに減衰させることで、リバーブの特性をシミュレートします。
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse; // 生成したインパルス応答バッファを返します。
}

/**
 * 指定されたイコライザーバンドのゲインを設定します。
 * GainNodeの`setTargetAtTime`を使用して、滑らかなゲイン変化を実現します。
 * @param {number} bandIndex - EQバンドのインデックス。
 * @param {number} gain - 設定するゲイン値（dB）。
 */
export function setEqBandGain(bandIndex, gain) {
    currentGains[bandIndex] = gain; // 現在のゲイン配列を更新します。
    // フィルターが存在し、AudioContextがアクティブならゲインを設定します。
    if(eqBands[bandIndex] && audioContext) {
        eqBands[bandIndex].gain.setTargetAtTime(gain, audioContext.currentTime, 0.01); // 平滑な変化（0.01秒で目標値に到達）
    }
}

/**
 * 全てのイコライザーバンドのゲインを0にリセットします。
 * @returns {boolean} - リセットが成功した場合はtrue。
 */
export function resetEqGains() {
    currentGains.fill(0); // 全ゲインを0で埋めます。
    // 全てのフィルターのゲインを0に設定します。
    if (eqBands.length > 0 && audioContext) {
        eqBands.forEach(b => b.gain.setTargetAtTime(0, audioContext.currentTime, 0.01));
    }
    return true;
}

/**
 * イコライザープリセットを適用します。
 * プリセットのゲイン値に基づいて、各EQバンドのゲインを設定します。
 * @param {object} preset - 適用するプリセットオブジェクト（`gains`プロパティを持つ）。
 * @returns {boolean} - プリセットが正常に適用された場合はtrue、そうでない場合はfalse。
 */
export function applyEqPreset(preset) {
    if (preset && preset.gains) {
        currentGains = [...preset.gains]; // 現在のゲインをプリセット値で更新します。
        if (eqBands.length && audioContext) {
            preset.gains.forEach((g,i) => {
                if(eqBands[i]) eqBands[i].gain.setTargetAtTime(g, audioContext.currentTime, 0.01); // 各バンドのゲインを設定します。
            });
        }
        return true;
    }
    return false;
}

/**
 * 低音フィルターのゲインを設定します。
 * @param {number} gain - 設定するゲイン値（dB）。
 */
export function setBassGain(gain) {
    currentTone.bass = gain; // 現在のトーン設定を更新します。
    if (bassFilter && audioContext) {
        bassFilter.gain.setTargetAtTime(gain, audioContext.currentTime, 0.01); // ゲインを設定します。
    }
}

/**
 * 高音フィルターのゲインを設定します。
 * @param {number} gain - 設定するゲイン値（dB）。
 */
export function setTrebleGain(gain) {
    currentTone.treble = gain; // 現在のトーン設定を更新します。
    if (trebleFilter && audioContext) {
        trebleFilter.gain.setTargetAtTime(gain, audioContext.currentTime, 0.01); // ゲインを設定します。
    }
}

/**
 * ステレオ幅を設定します。
 * これは、片方のチャンネルにわずかな遅延を与えることで、ステレオ感を強調する効果（ハーアス効果）です。
 * @param {number} width - ステレオ幅の強度（0〜1の範囲を想定）。
 */
export function setStereoWidth(width) {
    // 幅の値を遅延時間（秒）に変換します（最大0.03秒 = 30ms）。
    currentStereoDelay = width * 0.03;
    if (stereo_delay && audioContext) {
        stereo_delay.delayTime.setTargetAtTime(currentStereoDelay, audioContext.currentTime, 0.01); // 遅延時間を設定します。
    }
}

/**
 * トーンコントロール（低音、高音、ステレオ幅）をデフォルト値にリセットします。
 * @returns {boolean} - リセットが成功した場合はtrue。
 */
export function resetToneControls() {
    setBassGain(0); // 低音ゲインを0にリセットします。
    setTrebleGain(0); // 高音ゲインを0にリセットします。
    setStereoWidth(0); // ステレオ幅を0にリセットします。
    currentTone = { bass: 0, treble: 0 }; // 内部状態もリセットします。
    currentStereoDelay = 0; // 内部状態もリセットします。
    return true;
}

/**
 * リバーブのウェット/ドライミックスを設定します。
 * ウェット信号はリバーブ処理後の音、ドライ信号は原音です。
 * @param {number} mix - ミックス比（0.0=ドライのみ、1.0=ウェットのみ）。
 */
export function setReverbMix(mix) {
    currentAmbience.mix = mix; // 現在のアンビエンス設定を更新します。
    if (dryGainNode && wetGainNode && audioContext) {
        // ドライゲインとウェットゲインをミックス比に基づいて設定します。
        dryGainNode.gain.setTargetAtTime(1.0 - mix, audioContext.currentTime, 0.01);
        wetGainNode.gain.setTargetAtTime(mix, audioContext.currentTime, 0.01);
    }
}

/**
 * リバーブのプリディレイを設定します。
 * プリディレイは、原音と最初のリバーブ音の間の遅延時間です。
 * @param {number} delay - プリディレイ時間（秒）。
 */
export function setReverbPreDelay(delay) {
    currentAmbience.preDelay = delay; // 現在のアンビエンス設定を更新します。
    if (preDelayNode && audioContext) {
        preDelayNode.delayTime.setTargetAtTime(delay, audioContext.currentTime, 0.01); // プリディレイ時間を設定します。
    }
}

/**
 * リバーブのダンピング（高域減衰）を設定します。
 * 高い周波数ほど速く減衰します。
 * @param {number} frequency - ダンピングフィルターの周波数（Hz）。
 */
export function setReverbDamp(frequency) {
    currentAmbience.damp = frequency; // 現在のアンビエンス設定を更新します。
    if (reverbDampFilter && audioContext) {
        reverbDampFilter.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.01); // 周波数を設定します。
    }
}

/**
 * アンビエンスコントロール（リバーブミックス、プリディレイ、ダンピング）をデフォルト値にリセットします。
 * @returns {boolean} - リセットが成功した場合はtrue。
 */
export function resetAmbienceControls() {
    setReverbMix(0); // ミックスを0にリセットします。
    setReverbPreDelay(0); // プリディレイを0にリセットします。
    setReverbDamp(22050); // ダンピングをデフォルト（高域をあまり減衰させない）にリセットします。
    currentAmbience = { mix: 0, preDelay: 0, damp: 22050 }; // 内部状態もリセットします。
    return true;
}

/**
 * アンビエンスプリセットを適用します。
 * プリセットの各値に基づいて、リバーブの設定を更新します。
 * @param {object} preset - 適用するプリセットオブジェクト（`values`プロパティを持つ）。
 * @returns {boolean} - プリセットが正常に適用された場合はtrue、そうでない場合はfalse。
 */
export function applyAmbiencePreset(preset) {
    if (preset && preset.values) {
        setReverbMix(preset.values.mix); // ミックスを適用します。
        setReverbPreDelay(preset.values.preDelay); // プリディレイを適用します。
        setReverbDamp(preset.values.damp); // ダンピングを適用します。
        return true;
    }
    return false;
}

/**
 * ボーカルカット機能の有効/無効を切り替えます。
 * @param {boolean} enabled - ボーカルカットを有効にする場合はtrue、無効にする場合はfalse。
 */
export function setVocalCut(enabled) {
    isVocalCutEnabled = enabled; // フラグを更新します。
    if (vocalCut_onGain && vocalCut_offGain && audioContext) {
        if (enabled) {
            // ONの場合: ONゲインを1（有効）、OFFゲインを0（無効）にします。
            vocalCut_onGain.gain.setTargetAtTime(1, audioContext.currentTime, 0.01);
            vocalCut_offGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);
        } else {
            // OFFの場合: ONゲインを0（無効）、OFFゲインを1（有効）にします。
            vocalCut_onGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);
            vocalCut_offGain.gain.setTargetAtTime(1, audioContext.currentTime, 0.01);
        }
        console.log(`Vocal Cut Toggled: ${enabled}`); // ログ出力
    }
}

/**
 * ビジュアライザーCanvasを初期化し、ウィンドウのリサイズイベントリスナーを設定します。
 */
export function initVisualizerCanvas() {
    if (dom.visualizerCanvas) {
        visualizerCtx = dom.getVisualizerContext(); // Canvasの2Dコンテキストを取得します。
        if (visualizerCtx) {
            resizeVisualizerCanvas(); // 初期リサイズを実行します。
            window.addEventListener('resize', resizeVisualizerCanvas); // ウィンドウリサイズ時に再リサイズするリスナーを設定します。
        }
    }
}

/**
 * ビジュアライザーCanvasのサイズをウィンドウのサイズに合わせて調整します。
 */
export function resizeVisualizerCanvas() {
    if (dom.visualizerCanvas && visualizerCtx) {
        dom.visualizerCanvas.width = window.innerWidth; // Canvasの幅をウィンドウの幅に設定します。
        dom.visualizerCanvas.height = window.innerHeight; // Canvasの高さをウィンドウの高さに設定します。
    }
}

/**
 * AudioContextが中断状態でないことを確認し、必要であれば再開します。
 * これは、ユーザーのインタラクションがないとAudioContextが中断されるブラウザの制限に対応するためのものです。
 */
export async function ensureAudioContextResumed() {
    // AudioContextが存在しない、または閉じている場合は新しく作成します。
    if (!audioContext || audioContext.state === 'closed') {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) {
            console.error("Failed to create or resume AudioContext:", e);
            setErrorMessage(dom.messageArea, "オーディオ機能の開始に失敗しました。このブラウザは対応していないか、セキュリティ制限があります。");
        }
    }
    // AudioContextが「suspended」状態の場合、再開を試みます。
    if (audioContext && audioContext.state === 'suspended') {
        try {
            await audioContext.resume(); // AudioContextを再開します。
            console.log("AudioContext resumed successfully.");
        } catch(e) {
            console.error("Failed to resume AudioContext:", e);
            setErrorMessage(dom.messageArea, "オーディオ機能の再開に失敗しました。ユーザーの操作が必要です。");
        }
    }
}

/**
 * ビジュアライザーをセットアップします。
 * オーディオグラフを構築し、アナライザーを準備します。
 * @param {HTMLAudioElement} audioElement - 音源となるHTMLAudioElement。
 * @returns {boolean} - セットアップが成功した場合はtrue、失敗した場合はfalse。
 */
export function setupVisualizer(audioElement) {
    if (!audioElement || !audioElement.src) {
        console.warn("[Visualizer] setupVisualizer: No audio element or src available.");
        return false;
    }
    // オーディオグラフの作成を試みます。
    if (!createAudioGraph(audioElement)) {
        console.error("[Visualizer] Audio graph creation failed during visualizer setup.");
        return false;
    }
    return true;
}

/**
 * ビジュアライザーの描画ループを実行するプライベート関数。
 * requestAnimationFrameを使用して継続的にCanvasを更新し、周波数データを可視化します。
 */
function renderVisualizerFrameLoop() {
    // 描画に必要なノードやコンテキストが利用可能か、AudioContextが実行中かを確認します。
    if (!analyser || !visualizerCtx || !frequencyData || !dom.visualizerCanvas || !audioContext || audioContext.state !== 'running' || !sourceNode) {
        // 条件を満たさない場合、描画ループを停止します。
        if(renderFrameId){
            cancelAnimationFrame(renderFrameId);
            renderFrameId = null;
        }
        return;
    }

    renderFrameId = requestAnimationFrame(renderVisualizerFrameLoop); // 次のフレームをリクエストします。

    analyser.getByteFrequencyData(frequencyData); // アナライザーから周波数データを取得します。

    visualizerCtx.clearRect(0, 0, dom.visualizerCanvas.width, dom.visualizerCanvas.height); // キャンバスをクリアします。

    const numBars = analyser.frequencyBinCount * 0.7; // 表示するバーの数を調整します（全周波数ビンの70%）。
    const barWidth = dom.visualizerCanvas.width / numBars; // 各バーの幅を計算します。
    let x = 0; // X座標の初期値

    for (let i = 0; i < numBars; i++) {
        const barHeightValue = frequencyData[i]; // 周波数データの値を取得します（0-255）。
        const barHeight = (barHeightValue / 255) * (dom.visualizerCanvas.height * 0.5); // バーの高さを計算します（Canvasの最大高さの半分に調整）。

        // バーの色をHSL形式で設定します（周波数に応じて色相を変化させます）。
        const hue = (i / numBars) * 180 + 180; // 色相 (180-360度: 青から赤へ変化)
        const saturation = 70 + (barHeightValue / 255) * 30; // 彩度
        const lightness = Math.min(45 + (barHeightValue / 255) * 30, 75); // 明度 (最小45%, 最大75%に制限)

        visualizerCtx.fillStyle = `hsl(${hue % 360}, ${saturation}%, ${lightness}%)`; // 塗りつぶし色を設定します。
        // バーを描画します。Math.max(1, ...) で最小幅を1ピクセル保証します。
        visualizerCtx.fillRect(x, dom.visualizerCanvas.height - barHeight, Math.max(1, barWidth - 1), barHeight);
        x += barWidth; // 次のバーのX座標を更新します。
    }
}

/**
 * ビジュアライザーの描画ループを停止します。
 */
export function stopVisualizerRender() {
    if (renderFrameId) {
        cancelAnimationFrame(renderFrameId); // アニメーションフレームをキャンセルします。
        renderFrameId = null; // IDをリセットします。
        // キャンバスをクリアします。
        if(visualizerCtx && dom.visualizerCanvas) {
            visualizerCtx.clearRect(0,0,dom.visualizerCanvas.width,dom.visualizerCanvas.height);
        }
    }
}

/**
 * ビジュアライザーの描画ループを開始します。
 * 既に実行中でない場合のみ開始します。
 */
export function startVisualizerRender() {
    if (!renderFrameId && isVisualizerReady()) { // 描画中でなく、ビジュアライザーが準備できていれば
        renderVisualizerFrameLoop(); // 描画ループを開始します。
    }
}

/**
 * AudioContextのサンプリングレートを取得します。
 * @returns {number|null} - サンプリングレート、またはAudioContextが準備できていなければnull。
 */
export function getAudioContextSampleRate() {
    if (audioContext && audioContext.state === 'running') {
        return audioContext.sampleRate; // サンプリングレートを返します。
    }
    return null; // 準備できていなければnull
}

/**
 * ビジュアライザーの状態をリセットします。
 * 描画を停止し、AudioContextを閉じ、全てのノードと状態変数を初期化します。
 */
export function resetVisualizerState() {
    stopVisualizerRender(); // 描画を停止します。
    // AudioContextが閉じている状態でない場合、閉じます。
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(e => console.error("Error closing AudioContext:", e)); // エラーハンドリングを追加
    }
    // 全てのノードと状態変数をリセットし、ガベージコレクションを促します。
    audioContext = null;
    sourceNode = null;
    analyser = null;
    eqBands = [];
    bassFilter = null;
    trebleFilter = null;
    reverbNode = null;
    preDelayNode = null;
    reverbDampFilter = null;
    wetGainNode = null;
    dryGainNode = null;
    stereo_splitter = null;
    stereo_merger = null;
    stereo_delay = null;
    vocalCut_splitter = null;
    vocalCut_inverter = null;
    vocalCut_merger = null;
    vocalCut_onGain = null;
    vocalCut_offGain = null;
    isVocalCutEnabled = false; // ボーカルカットの状態もリセットします。
}

/**
 * ビジュアライザーが描画を開始できる状態であるかを確認します。
 * @returns {boolean} - 準備ができていればtrue、そうでなければfalse。
 */
export function isVisualizerReady() {
    // AudioContextが実行中で、ソースノードとアナライザーが準備できていればtrue
    return !!(audioContext && audioContext.state === 'running' && sourceNode && analyser);
}

/**
 * AudioContextを閉じます。
 * ページ離脱時などにWeb Audio APIリソースを解放するために使用されます。
 */
export function closeAudioContext() {
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(e => console.error("Error closing AudioContext:", e)); // エラーハンドリングを追加
    }
}
