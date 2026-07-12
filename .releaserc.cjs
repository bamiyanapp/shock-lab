// reusable-cd.ymlのreleaseジョブがenable_shared_release_config: trueの場合、
// dev-standards/release-config.cjsをこのリポジトリのルートへコピーする
// （copy-release-config composite action）ため、ここでは相対パスでrequireする。
const { buildReleaseConfig } = require("./release-config.cjs");

module.exports = buildReleaseConfig({
  repositoryUrl: "https://github.com/bamiyanapp/shock-lab.git",
  gitAssets: ["CHANGELOG.md", "package.json", "package-lock.json"],
  // 現時点でCHANGELOG.mdのJSON変換（enable_changelog_json）は使用しないためno-opにする。
  changelogPrepareCmd: "true",
});
