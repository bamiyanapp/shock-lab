import { useSimulationStore } from "../store/simulationStore";

// 車速に連動してピッチが変わるエンジン音（issue #53）。効果音（soundEffects.ts）と異なり
// 持続音のため、外部音源ファイルではなくWeb Audio APIのOscillatorNodeで合成する。
// iOS Safari等、AudioContext自体が使えない・ユーザー操作前でsuspended状態のままの環境でも
// 例外を投げず無音のまま動作し続けることを優先する（開発環境の制約「スマホオンリー」対応）。
const IDLE_FREQUENCY_HZ = 60;
const FREQUENCY_PER_MPS = 12;
const MAX_FREQUENCY_HZ = 300;
const ENGINE_VOLUME = 0.06; // オシレータのsawtoothは倍音が強く耳障りになりやすいため控えめにする
const GAIN_RAMP_SECONDS = 0.05;

let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

function getAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  // SafariはベンダープレフィックスのwebkitAudioContextのみを提供していたことがある
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function targetGain(): number {
  return useSimulationStore.getState().isMuted ? 0 : ENGINE_VOLUME;
}

/** ユーザー操作イベント内（開始ボタン押下等）から呼ぶこと。AudioContextの生成・resumeにはユーザー操作の文脈が必要。 */
export function startEngineSound() {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) return; // Web Audio API非対応環境では何もしない

  try {
    if (!audioContext) {
      audioContext = new AudioContextConstructor();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    if (oscillator) return; // 既に再生中

    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = IDLE_FREQUENCY_HZ;
    gainNode.gain.value = targetGain();
    oscillator.connect(gainNode).connect(audioContext.destination);
    oscillator.start();
  } catch {
    // Web Audio APIの一部のみ非対応・実行時エラーとなる環境でも、シミュレーション自体は
    // 無音のまま継続させる。
  }
}

export function stopEngineSound() {
  try {
    oscillator?.stop();
  } catch {
    // 既に停止済み等は無視する
  }
  oscillator?.disconnect();
  oscillator = null;
  gainNode?.disconnect();
  gainNode = null;
}

/** 物理演算ループから毎tick呼び、実際の走行速度(m/s)をピッチへ反映する */
export function setEngineSoundSpeed(speedMetersPerSecond: number) {
  if (!oscillator || !audioContext) return;
  const frequency = Math.min(
    IDLE_FREQUENCY_HZ + Math.abs(speedMetersPerSecond) * FREQUENCY_PER_MPS,
    MAX_FREQUENCY_HZ
  );
  oscillator.frequency.setTargetAtTime(frequency, audioContext.currentTime, GAIN_RAMP_SECONDS);
}

/** ミュートトグル操作時に呼び、再生中のエンジン音の音量へ即座に反映する */
export function applyEngineSoundMuted() {
  if (!gainNode || !audioContext) return;
  gainNode.gain.setTargetAtTime(targetGain(), audioContext.currentTime, GAIN_RAMP_SECONDS);
}
