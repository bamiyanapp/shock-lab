import { describe, expect, it, vi, afterEach } from "vitest";

// AudioContextはjsdomに実装が無いため、テストごとに独自のフェイク実装を
// window.AudioContextへ差し込む。engineSound.tsはモジュールスコープの
// シングルトン（audioContext/oscillator/gainNode）を持つため、テストごとに
// vi.resetModules()して再importし、前のテストの状態を引き継がないようにする。
// resetModules後は../store/simulationStoreも新しいインスタンスになるため、
// engineSound.tsと同じインスタンスを参照させるよう、storeも同じタイミングで
// 動的importし直す（トップレベルで静的importしたstoreは別インスタンスのままになり、
// setMuted()の変更がengineSound.ts側から見えなくなるため使わない）。
class FakeAudioParam {
  value = 0;
  setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class FakeGainNode {
  gain = new FakeAudioParam();
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
}

class FakeOscillatorNode {
  type = "";
  frequency = new FakeAudioParam();
  detune = new FakeAudioParam();
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeBiquadFilterNode {
  type = "";
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
}

class FakeBufferSourceNode {
  buffer: unknown = null;
  loop = false;
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  // vi.fn()のmock.instancesはnewで呼ばれたクラスコンストラクタそのものには
  // 使えないため、生成されたインスタンスを自前で記録する。
  static readonly instances: FakeAudioContext[] = [];
  state: "running" | "suspended" | "interrupted" | "closed" = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  createOscillator = vi.fn(() => new FakeOscillatorNode());
  createGain = vi.fn(() => new FakeGainNode());
  createBiquadFilter = vi.fn(() => new FakeBiquadFilterNode());
  createBufferSource = vi.fn(() => new FakeBufferSourceNode());
  createBuffer = vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }));

  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

const originalAudioContext = window.AudioContext;

async function loadModules() {
  vi.resetModules();
  const [engineSound, storeModule] = await Promise.all([
    import("./engineSound"),
    import("../store/simulationStore"),
  ]);
  return { ...engineSound, useSimulationStore: storeModule.useSimulationStore };
}

describe("engineSound", () => {
  afterEach(() => {
    window.AudioContext = originalAudioContext;
  });

  it("Web Audio API非対応環境（AudioContext未定義）でも例外を投げず無音のまま動作する", async () => {
    // @ts-expect-error 非対応環境を模すため意図的にundefinedを代入する
    window.AudioContext = undefined;
    const { startEngineSound, setEngineSoundSpeed, stopEngineSound, applyEngineSoundMuted } = await loadModules();

    expect(() => {
      startEngineSound();
      setEngineSoundSpeed(10);
      applyEngineSoundMuted();
      stopEngineSound();
    }).not.toThrow();
  });

  it("開始すると、のこぎり波の3つのオシレータ（基音と倍音）と、ループするノイズが、生成・再生される（issue #511）", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound } = await loadModules();

    startEngineSound();

    const context = FakeAudioContext.instances.at(-1)!;
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    for (const result of context.createOscillator.mock.results) {
      const oscillator = result.value as FakeOscillatorNode;
      expect(oscillator.type).toBe("sawtooth");
      expect(oscillator.start).toHaveBeenCalledTimes(1);
    }
    // 倍音は、わずかにずらして（デチューン）重ねる
    const detunes = context.createOscillator.mock.results.map((r) => (r.value as FakeOscillatorNode).detune.value);
    expect(new Set(detunes).size).toBe(3);
    const noise = context.createBufferSource.mock.results[0]?.value as FakeBufferSourceNode;
    expect(noise.loop).toBe(true);
    expect(noise.start).toHaveBeenCalledTimes(1);
    // ノードは、10個前後に抑える（モバイルのCPU負荷）
    const nodeCount =
      context.createOscillator.mock.calls.length +
      context.createGain.mock.calls.length +
      context.createBiquadFilter.mock.calls.length +
      context.createBufferSource.mock.calls.length;
    expect(nodeCount).toBeLessThanOrEqual(12);
  });

  it("setEngineSoundSpeedで、速度に応じた回転数から求めた周波数へ更新される。極端な速度でも、レッドラインで頭打ち", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, setEngineSoundSpeed } = await loadModules();
    const { computeEngineSoundParams, ENGINE_PROFILES } = await import("./engineSoundParams");

    startEngineSound();
    const context = FakeAudioContext.instances.at(-1)!;
    const oscillators = context.createOscillator.mock.results.map((r) => r.value as FakeOscillatorNode);

    setEngineSoundSpeed(1000);

    const expected = computeEngineSoundParams(1000, ENGINE_PROFILES.sedan);
    expect(oscillators[0].frequency.setTargetAtTime).toHaveBeenCalled();
    expect(oscillators.map((o) => o.frequency.value)).toEqual([...expected.oscillatorHz]);
    expect(expected.rpm).toBe(ENGINE_PROFILES.sedan.redlineRpm);
  });

  it("音の更新は、10Hzに間引く（0.1秒より短い間隔の呼び出しは、無視する）", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, setEngineSoundSpeed } = await loadModules();

    startEngineSound();
    const context = FakeAudioContext.instances.at(-1)!;
    const oscillator = context.createOscillator.mock.results[0]?.value as FakeOscillatorNode;

    setEngineSoundSpeed(10);
    setEngineSoundSpeed(20);
    expect(oscillator.frequency.setTargetAtTime).toHaveBeenCalledTimes(1);

    context.currentTime = 0.05;
    setEngineSoundSpeed(20);
    expect(oscillator.frequency.setTargetAtTime).toHaveBeenCalledTimes(1);

    context.currentTime = 0.11;
    setEngineSoundSpeed(20);
    expect(oscillator.frequency.setTargetAtTime).toHaveBeenCalledTimes(2);
  });

  it("揺れ（上下G）が大きいと、ノイズの音量が上がる", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, setEngineSoundSpeed } = await loadModules();

    startEngineSound();
    const context = FakeAudioContext.instances.at(-1)!;
    // createGainの順: マスター、3つのオシレータ、ノイズ
    const noiseGain = context.createGain.mock.results[4]?.value as FakeGainNode;

    setEngineSoundSpeed(10, 0);
    const calm = noiseGain.gain.value;
    context.currentTime = 1;
    setEngineSoundSpeed(10, 1.5);

    expect(noiseGain.gain.value).toBeGreaterThan(calm);
  });

  it("開始時に渡した車種の特徴が、音に反映される（トラックは、スポーツカーより低い）", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, setEngineSoundSpeed } = await loadModules();
    const { ENGINE_PROFILES } = await import("./engineSoundParams");
    const frequencyAt = (profile: (typeof ENGINE_PROFILES)[string]) => {
      startEngineSound(profile);
      const context = FakeAudioContext.instances.at(-1)!;
      const oscillator = context.createOscillator.mock.results.at(-3)?.value as FakeOscillatorNode;
      context.currentTime += 1;
      setEngineSoundSpeed(15);
      return oscillator.frequency.value;
    };
    const { stopEngineSound } = await import("./engineSound");

    const truck = frequencyAt(ENGINE_PROFILES.truck);
    stopEngineSound();
    const sports = frequencyAt(ENGINE_PROFILES["sports-car"]);

    expect(truck).toBeLessThan(sports);
  });

  it("stopEngineSound後は、全てのオシレータとノイズを止めて切り離し、setEngineSoundSpeedを呼んでも何もしない", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, stopEngineSound, setEngineSoundSpeed } = await loadModules();

    startEngineSound();
    const context = FakeAudioContext.instances.at(-1)!;
    const oscillators = context.createOscillator.mock.results.map((r) => r.value as FakeOscillatorNode);
    const noise = context.createBufferSource.mock.results[0]?.value as FakeBufferSourceNode;

    stopEngineSound();
    for (const oscillator of oscillators) {
      expect(oscillator.stop).toHaveBeenCalledTimes(1);
      expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
    }
    expect(noise.stop).toHaveBeenCalledTimes(1);
    expect(noise.disconnect).toHaveBeenCalledTimes(1);

    expect(() => setEngineSoundSpeed(10)).not.toThrow();
  });

  it("ミュート中に開始するとgainが0になる", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, useSimulationStore } = await loadModules();
    useSimulationStore.getState().setMuted(true);

    startEngineSound();

    const context = FakeAudioContext.instances.at(-1)!;
    const gainNode = context.createGain.mock.results[0]?.value as FakeGainNode;
    expect(gainNode.gain.value).toBe(0);
  });

  it("applyEngineSoundMutedで再生中のgainがミュート状態に追従する", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, applyEngineSoundMuted, useSimulationStore } = await loadModules();

    startEngineSound();
    const context = FakeAudioContext.instances.at(-1)!;
    const gainNode = context.createGain.mock.results[0]?.value as FakeGainNode;

    useSimulationStore.getState().setMuted(true);
    applyEngineSoundMuted();
    expect(gainNode.gain.value).toBe(0);

    useSimulationStore.getState().setMuted(false);
    applyEngineSoundMuted();
    expect(gainNode.gain.value).toBeGreaterThan(0);
  });

  it("iOSのinterrupted状態からの開始でも、resumeして音を戻す", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, stopEngineSound } = await loadModules();

    startEngineSound();
    const context = FakeAudioContext.instances.at(-1)!;
    stopEngineSound();
    context.state = "interrupted";
    context.resume.mockClear();

    startEngineSound();

    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("running状態ではresumeを呼ばない", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound } = await loadModules();

    startEngineSound();

    expect(FakeAudioContext.instances.at(-1)!.resume).not.toHaveBeenCalled();
  });

  it("コンテキストがclosedなら作り直して再生する", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, stopEngineSound } = await loadModules();

    startEngineSound();
    const first = FakeAudioContext.instances.at(-1)!;
    stopEngineSound();
    first.state = "closed";

    startEngineSound();

    const second = FakeAudioContext.instances.at(-1)!;
    expect(second).not.toBe(first);
    expect(second.createOscillator).toHaveBeenCalledTimes(3);
  });

  it("開始と停止を繰り返しても、毎回新しいノードで再生され、音量が0のまま残らない", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, stopEngineSound } = await loadModules();

    for (let i = 0; i < 3; i += 1) {
      startEngineSound();
      stopEngineSound();
    }
    startEngineSound();

    const context = FakeAudioContext.instances.at(-1)!;
    // 1回の開始で、オシレータ3つ・ゲイン5つ（マスター・オシレータ3・ノイズ）を作る
    expect(context.createOscillator).toHaveBeenCalledTimes(12);
    const gain = context.createGain.mock.results[15]?.value as FakeGainNode;
    expect(gain.gain.value).toBeGreaterThan(0);
  });

  it("ミュート解除（ユーザー操作）で、止まっているコンテキストをresumeする", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, applyEngineSoundMuted } = await loadModules();

    startEngineSound();
    const context = FakeAudioContext.instances.at(-1)!;
    context.state = "interrupted";

    applyEngineSoundMuted();

    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("画面が再び見えたとき、再生中で止まっているコンテキストをresumeする", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound } = await loadModules();

    startEngineSound();
    const context = FakeAudioContext.instances.at(-1)!;
    context.state = "suspended";
    document.dispatchEvent(new Event("visibilitychange"));

    expect(context.resume).toHaveBeenCalledTimes(1);
  });
});
