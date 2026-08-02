import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'

export default defineConfig({
  // GitHub Pages 子路径部署：https://silen2.github.io/youzhongpaidan/
  // 仓库名变更时需同步修改；本地开发不受影响
  base: '/youzhongpaidan/',
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: '有种排单 - 插画师排单管理',
        short_name: '有种排单',
        description: 'Mohyeh 的独立插画师本地接单日程排单管理工具',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '.',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    transformer: 'lightningcss',
    // 目标锁定现代浏览器：Lightning CSS 才会保留标准 backdrop-filter 属性。
    // 默认（兼容老浏览器）会把 backdrop-filter 降级为仅 -webkit-backdrop-filter，
    // 现代 Chrome 不认该前缀 → 磨砂玻璃在生产构建中失效（本地 dev 加载源码不受影响）。
    lightningcss: {
      // 版本号需 32 位编码（major << 16 | minor << 8 | patch）
      targets: {
        chrome: 120 << 16,
        safari: 16 << 16,
        firefox: 120 << 16,
        edge: 120 << 16,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/main.ts', 'src/db/**', 'src/test/**'],
    },
  },
})
