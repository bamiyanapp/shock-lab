import { useSimulationStore } from "../store/simulationStore";
import {
  ENGINE_PROFILES,
  HARMONIC_ORDERS,
  computeEngineSoundParams,
  type EngineSoundParams,
  type EngineSoundProfile,
} from "./engineSoundParams";

// 車速に連動して回転数・音色が変わるエンジン音（issue #53・#511）。効果音（soundEffects.ts）と異なり
// 持続音のため、外部音源ファイルではなくWeb Audio APIで合成する。
// 構成: 基音と2・3・4倍音のオシレータ（のこぎり波・わずかなデチューン）→ローパスフィルタ（回転数に連動）、
// ホワイトノイズ→バンドパスフィルタ（ざらつき・ロードノイズ）、の2系統を、マスターの音量へ合流する。
// 速度→回転数→各パラメータの計算は、純粋関数（engineSoundParams.ts）にある。
// iOS Safari等、AudioContext自体が使えない・ユーザー操作前でsuspended状態のままの環境でも
// 例外を投げず無音のまま動作し続けることを優先する（開発環境の制約「スマホオンリー」対応）。
const ENGINE_VOLUME = 0.12; // のこぎり波は倍音が強く耳障りになりやすいため控えめにする
const OSCILLATOR_LEVEL = 0.4; // 3つのオシレータの合計が、大きくなりすぎないようにする
const NOISE_LEVEL = 0.5;
const DETUNE_CENTS = [-7, 0, 6] as const;
const GAIN_RAMP_SECONDS = 0.05;
const PARAM_RAMP_SECONDS = 0.08;
/** パラメータの更新間隔（秒）。10Hzで足りる（モバイルのCPU負荷を抑える） */
const UPDATE_INTERVAL_SECONDS = 0.1;
const DEFAULT_PROFILE = ENGINE_PROFILES.sedan;

interface EngineGraph {
  master: GainNode;
  lowpass: BiquadFilterNode;
  oscillators: OscillatorNode[];
  oscillatorGains: GainNode[];
  noiseSource: AudioBufferSourceNode;
  noiseBand: BiquadFilterNode;
  noiseGain: GainNode;
  profile: EngineSoundProfile;
  lastUpdateTime: number;
}

let audioContext: AudioContext | null = null;
let graph: EngineGraph | null = null;

function getAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  // SafariはベンダープレフィックスのwebkitAudioContextのみを提供していたことがある
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function targetGain(): number {
  return useSimulationStore.getState().isMuted ? 0 : ENGINE_VOLUME;
}

/**
 * 止まっているAudioContextを再開する。iOS Safariは、画面ロック・別アプリへの切り替え・
 * 電話等の割り込みで"suspended"だけでなく"interrupted"（標準のstate型に無い値）にもする。
 * "suspended"だけを見ると、復帰後に無音のままになる（issue #514）。
 */
function resumeIfNotRunning(context: AudioContext) {
  if (context.state === "running") return;
  context.resume().catch(() => {});
}

/** ホワイトノイズの、1秒ぶんのループ用バッファ */
function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  // 音のざらつきに使う乱数のため、暗号用でなくてよい。線形合同法で、再現できる値を作る。
  let seed = 12345;
  for (let i = 0; i < samples.length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    samples[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

function createOscillatorChain(context: AudioContext, lowpass: BiquadFilterNode) {
  const oscillators: OscillatorNode[] = [];
  const oscillatorGains: GainNode[] = [];
  HARMONIC_ORDERS.forEach((_, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sawtooth";
    oscillator.detune.value = DETUNE_CENTS[index];
    oscillator.connect(gain).connect(lowpass);
    oscillators.push(oscillator);
    oscillatorGains.push(gain);
  });
  return { oscillators, oscillatorGains };
}

function buildGraph(context: AudioContext, profile: EngineSoundProfile): EngineGraph {
  const master = context.createGain();
  master.gain.value = targetGain();
  master.connect(context.destination);

  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.Q.value = 0.7;
  lowpass.connect(master);
  const { oscillators, oscillatorGains } = createOscillatorChain(context, lowpass);

  const noiseSource = context.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(context);
  noiseSource.loop = true;
  const noiseBand = context.createBiquadFilter();
  noiseBand.type = "bandpass";
  noiseBand.Q.value = 0.8;
  const noiseGain = context.createGain();
  noiseSource.connect(noiseBand).connect(noiseGain).connect(master);

  return { master, lowpass, oscillators, oscillatorGains, noiseSource, noiseBand, noiseGain, profile, lastUpdateTime: -1 };
}

/** 計算したパラメータを、ノードへ反映する。初回は即座に、以降はなめらかに近づける */
function applyParams(target: EngineGraph, params: EngineSoundParams, now: number, immediate: boolean) {
  const set = (param: AudioParam, value: number) => {
    if (immediate) param.value = value;
    else param.setTargetAtTime(value, now, PARAM_RAMP_SECONDS);
  };
  target.oscillators.forEach((oscillator, index) => {
    set(oscillator.frequency, params.oscillatorHz[index]);
    set(target.oscillatorGains[index].gain, params.harmonicGains[index] * OSCILLATOR_LEVEL);
  });
  set(target.lowpass.frequency, params.cutoffHz);
  set(target.noiseBand.frequency, params.noiseBandHz);
  set(target.noiseGain.gain, params.noiseGain * NOISE_LEVEL);
}

/** ユーザー操作イベント内（開始ボタン押下等）から呼ぶこと。AudioContextの生成・resumeにはユーザー操作の文脈が必要。 */
export function startEngineSound(profile: EngineSoundProfile = DEFAULT_PROFILE) {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) return; // Web Audio API非対応環境では何もしない

  try {
    if (audioContext?.state === "closed") {
      // closedは再開できない。古いノードごと捨てて作り直す。
      stopEngineSound();
      audioContext = null;
    }
    if (!audioContext) {
      audioContext = new AudioContextConstructor();
    }
    resumeIfNotRunning(audioContext);
    if (graph) return; // 既に再生中

    const built = buildGraph(audioContext, profile);
    applyParams(built, computeEngineSoundParams(0, profile), audioContext.currentTime, true);
    built.oscillators.forEach((oscillator) => oscillator.start());
    built.noiseSource.start();
    graph = built;
  } catch {
    // Web Audio APIの一部のみ非対応・実行時エラーとなる環境でも、シミュレーション自体は
    // 無音のまま継続させる。
  }
}

export function stopEngineSound() {
  if (!graph) return;
  const stopping = graph;
  graph = null;
  for (const source of [...stopping.oscillators, stopping.noiseSource]) {
    try {
      source.stop();
    } catch {
      // 既に停止済み等は無視する
    }
    source.disconnect();
  }
  for (const node of [...stopping.oscillatorGains, stopping.lowpass, stopping.noiseBand, stopping.noiseGain, stopping.master]) {
    node.disconnect();
  }
}

/**
 * 物理演算ループから毎tick呼び、実際の走行速度(m/s)と揺れ（上下Gの絶対値）を音へ反映する。
 * 反映は、10Hzに間引く。
 */
export function setEngineSoundSpeed(speedMetersPerSecond: number, roughnessG = 0) {
  if (!graph || !audioContext) return;
  const now = audioContext.currentTime;
  if (now - graph.lastUpdateTime < UPDATE_INTERVAL_SECONDS) return;
  graph.lastUpdateTime = now;
  applyParams(graph, computeEngineSoundParams(speedMetersPerSecond, graph.profile, roughnessG), now, false);
}

/** ミュートトグル操作時に呼び、再生中のエンジン音の音量へ即座に反映する */
export function applyEngineSoundMuted() {
  if (!graph || !audioContext) return;
  // ミュート解除はユーザー操作なので、止まっていれば再開できる。
  resumeIfNotRunning(audioContext);
  graph.master.gain.setTargetAtTime(targetGain(), audioContext.currentTime, GAIN_RAMP_SECONDS);
}

// 画面が再び見えるようになったとき、再生中なのに止まっているコンテキストを再開する。
// 再開はユーザー操作外だと拒否されることがあるが、拒否されても無害（無音のまま）なので試す。
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && graph && audioContext) resumeIfNotRunning(audioContext);
  });
}
