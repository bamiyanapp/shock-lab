# アーキテクチャ

`frontend/`の構成と、責務・依存の向きを定める。画面の仕様は[プロダクト仕様](product-specification.md)を参照する。

## ディレクトリの責務

| ディレクトリ | 責務 |
|---|---|
| `src/components/` | 表示と操作。ストアを購読し、物理の結果を描く |
| `src/physics/` | 物理と判定の計算。React・Zustand・DOM・Audioに依存しない |
| `src/store/` | 状態（Zustand）、パラメータの範囲と検証、共有URL、プリセット |
| `src/audio/` | 効果音とエンジン音 |
| `src/hooks/` | 画面の向き・バックグラウンド化などのフック |
| `src/pages/` | 画面全体の組み立て（`Home`） |
| `src/types/` | 車両パラメータ・メトリクスの型 |
| `e2e/` | Playwrightの画面テスト。共通フィクスチャは`fixtures.ts` |

## 依存の向き

- `physics`は`store`・`components`の値を参照しない。型だけ`store`から読む（`import type`）。
- `components`は`physics`と`store`を使う。`store`は`physics/units.ts`の定数と`parameterRanges`を使う。
- 効果音とストアへの書き込みは`components`が行う。`physics`は結果（メトリクス・イベント）を返すだけである。
- `physics`の単体テストはMatter.jsだけで動く。描画は使わない。

## 1tickの処理の流れ

`Matter.Runner`が1/60秒ごとにエンジンを進める。1tickは次の順で進む。

1. `beforeUpdate`: `SuspensionAxle`がバネ・ダンパーの力を車体とタイヤへ加える。
2. 物理更新: Matter.jsが位置を積分し、衝突を解決する。
3. `afterUpdate`（セッション内）: ストローク制限と横方向の拘束を適用する。
4. `afterUpdate`（`VehicleCanvas`経由）: `SimulationSession.afterUpdate()`を呼ぶ。
   - 駆動制御（試験速度を直接与える）、メトリクス、砂埃、履歴、ゴール・リタイア判定を行う。
   - 戻り値の`events`を見て、効果音と`finishRun`を呼ぶ。
   - 履歴のサンプルが確定したtick（10Hz）だけ、ストアへ反映する。
5. 描画: `beforeRender`でカメラを動かし、`afterRender`で背景・砂埃・車両・バネ・オーバーレイを描く。

canvasの描画（底付きのフラッシュ・カメラ振動）は、ストアではなく`SimulationSession.latestMetrics`を直接読む。

## 走行状態

状態は`phase`（idle・running・paused・finished）の1つの値で持つ。遷移はストアのアクションに限る。

- 車両・路面・速度の変更は、ストア内でidleへ戻し、`runToken`を進める。
- `VehicleCanvas`は`runToken`が変わったときだけ物理ワールドを作り直す。

## dev-standardsとの共有

`sync-manifest.local.json`で、次のファイルを`dev-standards/shared/`からsymlinkで共有している。

| ファイル | 内容 |
|---|---|
| `public/sw.js` | Service Worker |
| `src/components/UpdateNotifier.jsx` | 更新通知 |
| `src/components/ShareButton.jsx` | 共有ボタン |
| `src/components/ErrorBoundary.jsx` | 描画例外時の再読み込み画面 |
| `src/components/formatBuildTime.js` | ビルド時刻の表示 |
| `src/common-theme.css`・`src/bootstrap-theme.css` | 共通テーマ |
| `getAppVersionDefine.js` | バージョン情報の注入 |
| `src/assets/sounds/*.mp3` | 効果音（クリック・衝撃・成功） |
| `e2e/screenshot.js` | E2Eのスクリーンショット記録 |

共有していない`ServiceWorkerRegistration.tsx`は、プロダクト側でコピーして個別に管理している。Service Workerの登録と更新確認が、このアプリの構成に合わせてあるためである。

CIは`dev-standards`の再利用ワークフローを、タグ固定で呼ぶ。詳細は[CI/CDパイプライン仕様](cicd-pipeline-specification.md)を参照する。
