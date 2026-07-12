@dev-standards/CLAUDE.md

# ShockLabについて

車両サスペンション物理シミュレータ（2D、React + TypeScript + Vite + Matter.js）。詳細な製品仕様は要相談の上で `docs/` 配下に随時追加する。

# プロジェクト固有ルール

## 対象パッケージ

- 本リポジトリは `frontend` 単一パッケージ構成（`frontend/` 配下にVite + React + TypeScriptプロジェクトを配置）。
- `reusable-ci.yml` の `frontend_dir` は既定値 `frontend` をそのまま使用する。

## CI/自動マージ構成

- `.github/workflows/ci.yml` / `cd.yml` は `dev-standards` の `reusable-ci.yml` / `reusable-cd.yml` を `@vX.Y.Z` タグ固定で呼び出す（`@main` 等のブランチ参照は使用しない）。
- `enable_auto_merge` はデフォルト（`true`）のまま使用し、CI成功後に`base_branch`（`main`）へ自動マージする。
- GitHub Pagesへのデプロイは `dev-standards/.github/actions/deploy-github-pages` を利用する。
- CI/CDパイプラインの詳細仕様は `docs/cicd-pipeline-specification.md` を参照する。
