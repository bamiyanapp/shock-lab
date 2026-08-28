import clickSoundUrl from "../assets/sounds/click.mp3";
import shockSoundUrl from "../assets/sounds/shock.mp3";
import successSoundUrl from "../assets/sounds/success.mp3";

interface SoundEffect {
  play: () => void;
  unlock: () => void;
}

function createSoundEffect(url: string): SoundEffect {
  const audio = new Audio(url);
  return {
    play: () => {
      audio.currentTime = 0;
      // 自動再生ブロック・テスト実行環境（jsdom）等でaudio.play()が例外を投げる、
      // またはPromiseを返さないことがあるため、いずれの場合もシミュレーションは
      // 無音のまま継続させる。
      try {
        audio.play()?.catch(() => {});
      } catch {
        // 無視する。
      }
    },
    unlock: () => {
      // iOS Safari等は音声要素ごとに、ユーザー操作の文脈内で一度再生されるまで
      // プログラム的な再生を許可しない。ユーザー操作起点のイベント内で再生後すぐ
      // 停止・巻き戻すことで「再生済み」の状態にし、以降の非同期な再生を可能にする。
      try {
        audio
          .play()
          ?.then(() => {
            audio.pause();
            audio.currentTime = 0;
          })
          .catch(() => {});
      } catch {
        // 無視する。
      }
    },
  };
}

export const clickSound = createSoundEffect(clickSoundUrl);
export const shockSound = createSoundEffect(shockSoundUrl);
export const successSound = createSoundEffect(successSoundUrl);

let hasUnlockedNonInteractiveSounds = false;

/**
 * ユーザー操作イベントハンドラ内から呼ぶ。ボタン押下時のclickSoundはその操作自体が
 * 直接の再生トリガーになるため対象外で、後から非同期（物理演算ループ内）に再生する
 * shock/successのみをアンロックする。
 */
export function unlockNonInteractiveSoundEffects() {
  if (hasUnlockedNonInteractiveSounds) return;
  hasUnlockedNonInteractiveSounds = true;
  shockSound.unlock();
  successSound.unlock();
}
