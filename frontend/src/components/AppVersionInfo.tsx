import formatBuildTime from "./formatBuildTime.js"; // symlink

// トップページ必須表示項目（バージョン・更新日時）。
// dev-standards/docs/frontend-ui-conventions.md参照。値はvite.config.tsのdefineで
// ビルド時に埋め込まれる（__APP_VERSION__・__APP_BUILD_TIME__）。
export function AppVersionInfo() {
  return (
    <p className="text-body-secondary" style={{ fontSize: 12, margin: 0 }}>
      v{__APP_VERSION__}
      {__APP_BUILD_TIME__ && `（更新日時: ${formatBuildTime(__APP_BUILD_TIME__)}）`}
    </p>
  );
}
