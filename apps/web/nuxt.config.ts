// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
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
