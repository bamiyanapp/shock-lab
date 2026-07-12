# CI/CD Pipeline Specification（shock-lab）

共通のCI/CDパイプライン仕様（Architecture・各ワークフローの実行内容・リリース運用・自動マージ設定等）は [dev-standards/docs/cicd-pipeline-specification.md](../dev-standards/docs/cicd-pipeline-specification.md) を参照する。

本ドキュメントには、共通仕様に記載されていない shock-lab 固有のデプロイ内容のみを記載する。

## パッケージ構成

- `frontend/`: Vite + React + TypeScript（ShockLab本体）。`packages` 入力（`[{"dir":"frontend","build":true}]`）で `reusable-ci.yml` からlint・test・buildを実行する（backendパッケージは現時点で存在しないため、固定2パッケージ構成ではなく`packages`構成を使用する）。

## デプロイ

- デプロイ先は **GitHub Pages** のみ（AWSバックエンドは将来拡張であり現時点では未実装）。
- `.github/workflows/cd.yml` の `deploy` ジョブが `dev-standards/.github/actions/deploy-github-pages` を以下の設定で呼び出す。

  | 入力 | 値 |
  |---|---|
  | `working-directory` | `frontend` |
  | `build-command` | `npm run build`（既定） |
  | `artifact-path` | `frontend/dist` |

- `deploy` ジョブは `release` ジョブに従属し（`needs: release`）、`needs.release.outputs.new_release_published == 'true'` の場合のみ実行する（リリース対象のコミットがない push ではデプロイしない）。

## 環境変数・シークレット

現時点でプロダクト固有の環境変数・シークレットはない（AWSバックエンド導入時に追記する）。
