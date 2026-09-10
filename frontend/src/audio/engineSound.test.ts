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
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  // vi.fn()のmock.instancesはnewで呼ばれたクラスコンストラクタそのものには
  // 使えないため、生成されたインスタンスを自前で記録する。
  static instances: FakeAudioContext[] = [];
  state: "running" | "suspended" = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  createOscillator = vi.fn(() => new FakeOscillatorNode());
  createGain = vi.fn(() => new FakeGainNode());

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

  it("開始するとsawtoothのoscillatorが生成・再生される", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound } = await loadModules();

    startEngineSound();

    const context = FakeAudioContext.instances.at(-1)!;
    const oscillator = context.createOscillator.mock.results[0]?.value as FakeOscillatorNode;
    expect(oscillator.type).toBe("sawtooth");
    expect(oscillator.start).toHaveBeenCalledTimes(1);
  });

  it("setEngineSoundSpeedで速度に応じてfrequencyが上限にクランプされて更新される", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, setEngineSoundSpeed } = await loadModules();

    startEngineSound();
    const context = FakeAudioContext.instances.at(-1)!;
    const oscillator = context.createOscillator.mock.results[0]?.value as FakeOscillatorNode;

    // 極端に大きな速度を渡しても上限（300Hz）でクランプされる
    setEngineSoundSpeed(1000);
    expect(oscillator.frequency.setTargetAtTime).toHaveBeenCalled();
    expect(oscillator.frequency.value).toBe(300);
  });

  it("stopEngineSound後はsetEngineSoundSpeedを呼んでも何もしない", async () => {
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    const { startEngineSound, stopEngineSound, setEngineSoundSpeed } = await loadModules();

    startEngineSound();
    const context = FakeAudioContext.instances.at(-1)!;
    const oscillator = context.createOscillator.mock.results[0]?.value as FakeOscillatorNode;

    stopEngineSound();
    expect(oscillator.stop).toHaveBeenCalledTimes(1);
    expect(oscillator.disconnect).toHaveBeenCalledTimes(1);

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
});
