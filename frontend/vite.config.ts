/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pagesのプロジェクトページ（https://bamiyanapp.github.io/shock-lab/）配下に
  // デプロイされるため、アセット参照をリポジトリ名のサブパスに合わせる。
  base: '/shock-lab/',
  // dev-standardsのshared/配下（issue #147・#148）をsymlinkで共有しているため、npmパッケージを
  // importするコンポーネント（react本体等）をViteがsymlinkの実体パス（dev-standards配下）
  // 起点でnode_modulesを探索してしまわないようにする。
  resolve: {
    preserveSymlinks: true,
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
