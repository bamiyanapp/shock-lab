/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'

// トップページ必須表示項目（バージョン・更新日時）向けにビルド時へ埋め込む値。
// dev-standards/docs/frontend-ui-conventions.md参照。
// frontend/package.jsonのversionは"0.0.0"固定（このパッケージ自体はsemantic-releaseの
// バージョニング対象外）のため、リポジトリルートのpackage.json（semantic-releaseが
// 実際に更新する側）を参照する。
const rootPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8')
);

// 更新日時は「実際にデプロイされているバージョンの最終更新時点」を表す値として、
// ビルド対象コミット（semantic-releaseのリリースコミット）自体の日時を使う。
// CHANGELOG.md等のテキスト解析に依存せず、常にビルド元コミットと一致する。
function getLastCommitDate(): string {
  try {
    return execSync('git log -1 --format=%cd --date=short').toString().trim();
  } catch {
    // gitが使えない環境（一部のビルド環境等）でもビルド自体は継続させる。
    return '';
  }
}

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
    __APP_VERSION__: JSON.stringify(rootPackageJson.version as string),
    __APP_UPDATED_AT__: JSON.stringify(getLastCommitDate()),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
})
