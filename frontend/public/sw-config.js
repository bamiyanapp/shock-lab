// sw.js（dev-standardsからsymlink共有、shared/pwa/sw.js）が読み込むプロダクト固有設定。
// キャッシュ戦略・precacheUrls等を変更した際は必ずcacheVersionを上げ、activate時に
// 旧キャッシュを確実に破棄させること（詳細はdev-standards/docs/service-worker-update-pattern.md）。
self.SW_CONFIG = {
  cacheVersion: "v1",
  // GitHub Pagesのプロジェクトページ配信のため、パスは/shock-lab/サブパス基準にする。
  precacheUrls: ["/shock-lab/"],
  // バックエンドAPIを持たないため空。
  apiHostnames: [],
};
