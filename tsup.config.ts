import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/ui/index.ts', 'core/index': 'src/core/index.ts', 'editor/index': 'src/editor/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  target: 'es2020',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'linkshelf'],
  // Next.js の App Router でも、そのまま使えるように（画面はブラウザで動く）
  banner: { js: "'use client'" },
})
