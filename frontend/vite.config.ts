/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pagesのプロジェクトページ（https://bamiyanapp.github.io/shock-lab/）配下に
  // デプロイされるため、アセット参照をリポジトリ名のサブパスに合わせる。
  base: '/shock-lab/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
