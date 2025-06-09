import * as dom from './domElements.js';
import { setErrorMessage } from './utils.js';

let audioContext = null;
let sourceNode = null;
let analyser = null;
let frequencyData;
let renderFrameId;
let visualizerCtx;

let eqBands = [];
const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
let currentGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

let bassFilter = null;
let trebleFilter = null;
let currentTone = { bass: 0, treble: 0 };

let stereo_splitter = null;
let stereo_merger = null;
let stereo_delay = null;
let currentStereoDelay = 0; // この変数は、main.jsからのsetStereoWidthで更新されるdelayTimeの値を持つことになる

let reverbNode = null;
let preDelayNode = null;
let reverbDampFilter = null;
let wetGainNode = null;
let dryGainNode = null;
let currentAmbience = { mix: 0, preDelay: 0, damp: 22050 };

let vocalCut_splitter = null;
let vocalCut_inverter = null;
let vocalCut_merger = null;
let vocalCut_onGain = null;
let vocalCut_offGain = null;
let isVocalCutEnabled = false;


function createAudioGraph(audioElement) {
    if (!audioContext || audioContext.state === 'closed') {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { return false; }
    }

    // --- 1. 全てのノードを作成 & 初期化 ---
    eqBands = EQ_FREQUENCIES.map((f, i) => { const F=audioContext.createBiquadFilter(); F.type='peaking'; F.frequency.value=f; F.Q.value=1.5; F.gain.value=currentGains[i]; return F; });
    bassFilter = audioContext.createBiquadFilter(); bassFilter.type='lowshelf'; bassFilter.frequency.value=200; bassFilter.gain.value=currentTone.bass;
    trebleFilter = audioContext.createBiquadFilter(); trebleFilter.type='highshelf'; trebleFilter.frequency.value=5000; trebleFilter.gain.value=currentTone.treble;
    analyser = audioContext.createAnalyser(); analyser.fftSize=256; frequencyData=new Uint8Array(analyser.frequencyBinCount);
    
    preDelayNode = audioContext.createDelay(1.0); preDelayNode.delayTime.value = currentAmbience.preDelay;
    reverbNode = audioContext.createConvolver();
    reverbDampFilter = audioContext.createBiquadFilter(); reverbDampFilter.type='lowpass'; reverbDampFilter.frequency.value = currentAmbience.damp;
    dryGainNode = audioContext.createGain();
    wetGainNode = audioContext.createGain();
    setReverbMix(currentAmbience.mix);
    
    stereo_splitter = audioContext.createChannelSplitter(2);
    stereo_merger = audioContext.createChannelMerger(2);
    stereo_delay = audioContext.createDelay(0.1); // stereo_delayノードを作成
    // ★ここを変更します！
    // setStereoWidth(currentStereoDelay); // この行は削除またはコメントアウト
    // currentStereoDelay は既に setStereoWidth で正しい値に設定されているはずなので、
    // それを新しい stereo_delay ノードの delayTime に直接設定します。
    stereo_delay.delayTime.value = currentStereoDelay;


    vocalCut_splitter = audioContext.createChannelSplitter(2);
    vocalCut_inverter = audioContext.createGain(); vocalCut_inverter.gain.value = -1;
    vocalCut_merger = audioContext.createGain();
    vocalCut_onGain = audioContext.createGain();
    vocalCut_offGain = audioContext.createGain();
    setVocalCut(isVocalCutEnabled);

    generateImpulseResponse().then(impulse => { if(reverbNode) reverbNode.buffer = impulse; });

    if (sourceNode) sourceNode.disconnect();
    try {
        sourceNode = audioContext.createMediaElementSource(audioElement);
    } catch (e) { return false; }

    // --- 2. ノードを順番に接続 ---
    let lastNode = sourceNode;

    // Stage 1: ボーカルカット
    const vocalCutOutput = audioContext.createGain();
    // ONのパス: source -> splitter -> (L->merger, R->inverter->merger) -> onGain -> vocalCutOutput
    lastNode.connect(vocalCut_splitter);
    vocalCut_splitter.connect(vocalCut_merger, 0);
    vocalCut_splitter.connect(vocalCut_inverter, 1).connect(vocalCut_merger);
    vocalCut_merger.connect(vocalCut_onGain).connect(vocalCutOutput);
    // OFFのパス: source -> offGain -> vocalCutOutput
    lastNode.connect(vocalCut_offGain).connect(vocalCutOutput);
    lastNode = vocalCutOutput;

    // Stage 2: トーンコントロール
    lastNode.connect(bassFilter);
    bassFilter.connect(trebleFilter);
    lastNode = trebleFilter;

    // Stage 3: グラフィックイコライザー
    lastNode = eqBands.reduce((prevNode, currentFilter) => prevNode.connect(currentFilter), lastNode);
    
    // Stage 4: ステレオ拡張
    lastNode.connect(stereo_splitter);
    stereo_splitter.connect(stereo_merger, 0, 0);
    stereo_splitter.connect(stereo_delay, 1).connect(stereo_merger, 0, 1);
    lastNode = stereo_merger;

    // Stage 5: アンビエンス
    const masterOutput = audioContext.createGain();
    lastNode.connect(dryGainNode).connect(masterOutput);
    lastNode.connect(preDelayNode).connect(reverbNode).connect(reverbDampFilter).connect(wetGainNode).connect(masterOutput);
    lastNode = masterOutput;
    
    // Stage 6: 最終出力
    lastNode.connect(analyser);
    analyser.connect(audioContext.destination);

    return true;
}

async function generateImpulseResponse() { if (!audioContext) return null; const sampleRate = audioContext.sampleRate; const duration = 2; const decay = 2; const length = sampleRate * duration; const impulse = audioContext.createBuffer(2, length, sampleRate); for (let channel = 0; channel < 2; channel++) { const channelData = impulse.getChannelData(channel); for (let i = 0; i < length; i++) { channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay); } } return impulse; }
export function setEqBandGain(bandIndex, gain) { currentGains[bandIndex] = gain; if(eqBands[bandIndex]) eqBands[bandIndex].gain.setTargetAtTime(gain, audioContext.currentTime, 0.01); }
export function resetEqGains() { currentGains.fill(0); if (eqBands.length > 0) eqBands.forEach(b => b.gain.setTargetAtTime(0, audioContext.currentTime, 0.01)); return true; }
export function applyEqPreset(preset) { if (preset && preset.gains) { currentGains = [...preset.gains]; if (eqBands.length) preset.gains.forEach((g,i) => { if(eqBands[i]) eqBands[i].gain.setTargetAtTime(g, audioContext.currentTime, 0.01); }); return true; } return false; }
export function setBassGain(gain) { currentTone.bass = gain; if (bassFilter) bassFilter.gain.setTargetAtTime(gain, audioContext.currentTime, 0.01); }
export function setTrebleGain(gain) { currentTone.treble = gain; if (trebleFilter) trebleFilter.gain.setTargetAtTime(gain, audioContext.currentTime, 0.01); }
export function setStereoWidth(width) { currentStereoDelay = width * 0.03; if (stereo_delay) stereo_delay.delayTime.setTargetAtTime(currentStereoDelay, audioContext.currentTime, 0.01); }
export function resetToneControls() { setBassGain(0); setTrebleGain(0); setStereoWidth(0); return true; }
export function setReverbMix(mix) { currentAmbience.mix = mix; if (dryGainNode && wetGainNode && audioContext) { dryGainNode.gain.setTargetAtTime(1.0 - mix, audioContext.currentTime, 0.01); wetGainNode.gain.setTargetAtTime(mix, audioContext.currentTime, 0.01); } }
export function setReverbPreDelay(delay) { currentAmbience.preDelay = delay; if (preDelayNode && audioContext) preDelayNode.delayTime.setTargetAtTime(delay, audioContext.currentTime, 0.01); }
export function setReverbDamp(frequency) { currentAmbience.damp = frequency; if (reverbDampFilter && audioContext) reverbDampFilter.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.01); }
export function resetAmbienceControls() { setReverbMix(0); setReverbPreDelay(0); setReverbDamp(22050); return true; }
export function applyAmbiencePreset(preset) { if (preset && preset.values) { setReverbMix(preset.values.mix); setReverbPreDelay(preset.values.preDelay); setReverbDamp(preset.values.damp); return true; } return false; }

export function setVocalCut(enabled) {
    isVocalCutEnabled = enabled;
    if (vocalCut_onGain && vocalCut_offGain && audioContext) {
        if (enabled) {
            vocalCut_onGain.gain.setTargetAtTime(1, audioContext.currentTime, 0.01);
            vocalCut_offGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);
        } else {
            vocalCut_onGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);
            vocalCut_offGain.gain.setTargetAtTime(1, audioContext.currentTime, 0.01);
        }
        console.log(`Vocal Cut Toggled: ${enabled}`);
    }
}

export function initVisualizerCanvas() { if (dom.visualizerCanvas) { visualizerCtx = dom.getVisualizerContext(); if (visualizerCtx) { resizeVisualizerCanvas(); window.addEventListener('resize', resizeVisualizerCanvas); } } }
export function resizeVisualizerCanvas() { if (dom.visualizerCanvas && visualizerCtx) { dom.visualizerCanvas.width = window.innerWidth; dom.visualizerCanvas.height = window.innerHeight; } }
export async function ensureAudioContextResumed() { if (!audioContext||audioContext.state==='closed') { try { audioContext = new (window.AudioContext||window.webkitAudioContext)(); } catch(e) {} } if (audioContext.state === 'suspended') { try { await audioContext.resume(); } catch(e) {} } }
export function setupVisualizer(audioElement) { if (!audioElement||!audioElement.src) return false; if (!createAudioGraph(audioElement)) return false; return true; }
function renderVisualizerFrameLoop() { if (!analyser||!visualizerCtx||!frequencyData||!dom.visualizerCanvas||!audioContext||audioContext.state!=='running'||!sourceNode) { if(renderFrameId){cancelAnimationFrame(renderFrameId);renderFrameId=null;} return; } renderFrameId=requestAnimationFrame(renderVisualizerFrameLoop); analyser.getByteFrequencyData(frequencyData); visualizerCtx.clearRect(0,0,dom.visualizerCanvas.width,dom.visualizerCanvas.height); const numBars=analyser.frequencyBinCount*0.7;const barWidth=dom.visualizerCanvas.width/numBars;let x=0; for(let i=0;i<numBars;i++){ const barHeightValue=frequencyData[i]; const barHeight=(barHeightValue/255)*(dom.visualizerCanvas.height*0.5); const hue=(i/numBars)*180+180; const saturation=70+(barHeightValue/255)*30; const lightness=Math.min(45+(barHeightValue/255)*30,75); visualizerCtx.fillStyle=`hsl(${hue%360}, ${saturation}%, ${lightness}%)`; visualizerCtx.fillRect(x,dom.visualizerCanvas.height-barHeight,Math.max(1,barWidth-1),barHeight); x+=barWidth; } }
export function stopVisualizerRender() { if (renderFrameId) { cancelAnimationFrame(renderFrameId); renderFrameId = null; if(visualizerCtx&&dom.visualizerCanvas) visualizerCtx.clearRect(0,0,dom.visualizerCanvas.width,dom.visualizerCanvas.height); } }
export function startVisualizerRender() { if (!renderFrameId && isVisualizerReady()) { renderVisualizerFrameLoop(); } }
export function getAudioContextSampleRate() { if (audioContext&&audioContext.state==='running') return audioContext.sampleRate; return null; }
export function resetVisualizerState() { 
    stopVisualizerRender(); 
    if (audioContext&&audioContext.state!=='closed') { 
        audioContext.close();
    } 
    audioContext=null;sourceNode=null;analyser=null;eqBands=[];bassFilter=null;trebleFilter=null;
    reverbNode=null;preDelayNode=null;reverbDampFilter=null;wetGainNode=null;dryGainNode=null;
    stereo_splitter=null; stereo_merger=null; stereo_delay=null;
    vocalCut_splitter=null; vocalCut_inverter=null; vocalCut_merger=null; vocalCut_onGain=null; vocalCut_offGain=null;
}
export function isVisualizerReady() { return !!(audioContext&&audioContext.state==='running'&&sourceNode&&analyser); }
export function closeAudioContext() { if (audioContext&&audioContext.state!=='closed') audioContext.close(); }