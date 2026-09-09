/// <reference types="vitest/config" />
import { configDefaults } from 'vitest/config'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import getAppVersionDefine from './getAppVersionDefine.js' // symlink

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
  define: {
    // トップページ必須表示項目（バージョン・更新日時）。dev-standards/docs/frontend-ui-conventions.md
    // 「トップページの必須構成」参照。frontend/package.jsonのversionは"0.0.0"固定
    // （semantic-releaseのバージョニング対象外）のため、リポジトリルートのpackage.jsonを参照する。
    ...getAppVersionDefine(new URL('../package.json', import.meta.url)),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    // e2e/配下はPlaywright（test:e2e）が実行するスペックのため、vitestの既定glob
    // （*.spec.ts等）から除外する（issue #105）。
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
