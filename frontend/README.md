# ShockLab frontend

車両サスペンション物理シミュレータ（2D）のフロントエンド。React + TypeScript + Vite + Matter.js + Zustand + Recharts。

## ディレクトリ構成

```
src/
  components/   VehicleCanvas / ControlPanel / GraphPanel
  physics/      world / vehicle / suspension / terrain（Matter.jsラッパー）
  store/        simulationStore（Zustand）
  types/        vehicle（パラメータ・メトリクスの型定義）
  pages/        Home
  assets/
```

## コマンド

```
npm run dev      # 開発サーバー
npm run lint      # oxlint
npm run test      # vitest
npm run build     # 型チェック + 本番ビルド
npm run preview   # ビルド成果物のプレビュー
```
