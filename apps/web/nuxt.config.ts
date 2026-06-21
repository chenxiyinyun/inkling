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
    '@vite-pwa/nuxt',
  ],

  // PWA：可安装 + 离线壳（precache 构建产物 + 导航回退到 SPA 首页）。
  // SW 仅在生产构建注入；API(/v1) 走网络、不缓存。新版本 autoUpdate 自动激活。
  pwa: {
    // 'prompt'：新版本不强制刷新在用页面（避免写信途中被打断丢草稿），
    // 由 PwaUpdatePrompt 横幅让用户自行点「刷新启用」。
    registerType: 'prompt',
    manifest: {
      name: '信逢 Inkling · 漂流邮局',
      short_name: '信逢',
      description: '让社交回归真诚与纯粹。慢，所以可贵。',
      lang: 'zh-Hans',
      dir: 'ltr',
      theme_color: '#FAF6EE',
      background_color: '#FAF6EE',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        // PNG 兜底：部分浏览器/平台对 SVG maskable 支持不一
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      navigateFallback: '/',
      // API 与 SW 自身不应被 SPA 壳回退拦截
      navigateFallbackDenylist: [/^\/v1\//, /^\/sw\.js$/, /^\/workbox-/],
      cleanupOutdatedCaches: true,
      // 不设 skipWaiting/clientsClaim：新 SW 等待，由用户经 PwaUpdatePrompt 确认后再激活
    },
    // 开发态默认不启用 SW（避免干扰 HMR / 前端 Mock）；生产构建自动注入。
    devOptions: { enabled: false },
  },

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
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: '信逢' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // iOS Safari 不支持 SVG 的 apple-touch-icon，必须用 PNG，否则主屏回退为页面截图
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        // @vite-pwa/nuxt(ssr:false) 只注册 SW、不注入 manifest 链接，故在此静态声明，
        // 否则 Chrome/Android 探测不到 manifest 无法安装。
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
    },
  },

  devtools: { enabled: true },
  compatibilityDate: '2025-01-01',
});
