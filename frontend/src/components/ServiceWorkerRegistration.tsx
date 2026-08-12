import { useEffect } from "react";

// iOS PWA（ホーム画面から起動したスタンドアロン表示）はブラウザの自動的な
// Service Worker更新チェック（ページ遷移時・約24時間おき）が働きにくく、
// アプリを終了せずバックグラウンドへ回して再度開いただけでは新バージョンに
// 気づかないことがある。アプリがフォアグラウンドに戻るたびに明示的に
// registration.update()を呼び、新バージョンの検知（UpdateNotifierが拾う
// controllerchangeイベント）を確実にする。詳細な経緯・キャッシュ戦略の全体像は
// dev-standards/docs/service-worker-update-pattern.mdを参照
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// dev-standardsのshared/pwa/ServiceWorkerRegistration.jsxを元にしているが、
// register("/sw.js")が絶対パス固定のため、GitHub Pagesのプロジェクトページ配信
// （/shock-lab/ サブパス）では実際に配信されているsw.jsのURLと一致しない。
// import.meta.env.BASE_URL（vite.config.tsのbase設定に連動）を使う形に変更する
// 必要があり、symlink化を見送りコピーして個別管理している（issue #147）。
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        registration = reg;
      })
      .catch((error: unknown) => {
        console.error("Service Worker registration failed", error);
      });

    function checkForUpdate() {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => {
          // オフライン等での更新チェック失敗は致命的ではないため無視する
        });
      }
    }

    document.addEventListener("visibilitychange", checkForUpdate);
    const intervalId = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", checkForUpdate);
      clearInterval(intervalId);
    };
  }, []);

  return null;
}
