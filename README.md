# ShockLab

車両サスペンション物理シミュレータ（2D、React + TypeScript + Vite + Matter.js）。

巨大なスピードバンプ、段差、ジャンプ台などの過酷な路面を車両が走行した際の挙動を検証するインタラクティブな物理シミュレーションアプリです。車重・サスペンション硬さ・ダンパー特性・車高などを調整し、乗り心地や衝撃、底付きなどを検証できます。

## セットアップ

```
git submodule update --init
node dev-standards/scripts/bootstrap.js
cd frontend
npm install
npm run dev
```

## ドキュメント

- [CI/CDパイプライン仕様](docs/cicd-pipeline-specification.md)
- [frontend README](frontend/README.md)
