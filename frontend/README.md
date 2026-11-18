# ShockLab frontend

車両サスペンション物理シミュレータ（2D）のフロントエンド。React + TypeScript + Vite + Matter.js + Zustand + Recharts。

## ディレクトリ構成

責務と依存の向きは[アーキテクチャ](../docs/architecture.md)を参照する。

```
src/
  components/   表示と操作（VehicleCanvas / ControlPanel / TestConditionsPanel / GraphPanel / ResultScreen 等）
  physics/      物理と判定の計算（SimulationSession / suspension / terrain / metrics / resultRank 等）
  store/        状態（simulationStore）・パラメータ範囲（parameterRanges）・共有URL（urlConfig）・プリセット
  audio/        効果音とエンジン音
  hooks/        画面の向き・バックグラウンド化のフック
  pages/        Home
  types/        vehicle（パラメータ・メトリクスの型定義）
  assets/
e2e/            Playwrightの画面テスト（fixtures.ts・screenshot.js）
public/         manifest・アイコン・Service Worker
```

## コマンド

```
npm run dev      # 開発サーバー
npm run lint      # eslint
npm run test      # vitest
npm run build     # 型チェック + 本番ビルド
npm run test:e2e  # Playwright（要build）
npm run preview   # ビルド成果物のプレビュー
```
