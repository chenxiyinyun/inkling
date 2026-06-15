// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  // 让 Vite 直接解析 @inkling/shared 的 TS 源码（而非 CJS dist），
  // 与 typecheck 路径一致，规避 Rollup 对 CJS barrel 具名导出的探测失败。
  alias: {
    '@inkling/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
  },
  // MVP 暂用 SPA（登录后应用，规避 SSR + 本地 token 复杂度）。
  // 生产期可切回 SSR 以获得分享秒开/SEO（详见 docs/产品设计文档.md）。
  ssr: false,

  modules: [
    '@pinia/nuxt',
    '@unocss/nuxt',
    // '@vite-pwa/nuxt', // TODO: 配齐图标后启用 PWA
  ],

  css: ['@unocss/reset/tailwind.css', '~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/v1',
      // 'auto'：开发态默认启用前端 Mock 后端；'1' 强制开启；'0' 接真实后端。
      useMock: process.env.NUXT_PUBLIC_USE_MOCK || 'auto',
    },
  },

  app: {
    head: {
      title: '信逢 Inkling · 漂流邮局',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: '让社交回归真诚与纯粹。慢，所以可贵。' },
        { name: 'theme-color', content: '#FAF6EE' },
      ],
    },
  },

  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
});
