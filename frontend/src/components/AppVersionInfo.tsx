// トップページ必須表示項目（バージョン・更新日時）。
// dev-standards/docs/frontend-ui-conventions.md参照。値はvite.config.tsのdefineで
// ビルド時に埋め込まれる（__APP_VERSION__・__APP_UPDATED_AT__）。
export function AppVersionInfo() {
  return (
    <p style={{ fontSize: 12, color: "var(--text-h)", opacity: 0.7, margin: 0 }}>
      v{__APP_VERSION__}
      {__APP_UPDATED_AT__ && `（更新日時: ${__APP_UPDATED_AT__}）`}
    </p>
  );
}
