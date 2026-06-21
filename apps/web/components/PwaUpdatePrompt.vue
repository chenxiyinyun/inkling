<script setup lang="ts">
// 新版本可用时的克制横幅（registerType: 'prompt'）。用户点「刷新启用」才激活新 SW，
// 不会在写信途中被强制刷新。草稿另有本地持久化兜底（pages/letters/new.vue）。
const { $pwa } = useNuxtApp() as unknown as { $pwa?: { needRefresh: boolean; updateServiceWorker: (reload?: boolean) => void } };
const dismissed = ref(false);
</script>

<template>
  <ClientOnly>
    <div v-if="$pwa?.needRefresh && !dismissed" class="pwa-banner" role="status">
      <span>邮局有了新版本</span>
      <button class="pwa-banner__go" @click="$pwa!.updateServiceWorker(true)">刷新启用</button>
      <button class="pwa-banner__later" aria-label="稍后再说" @click="dismissed = true">稍后</button>
    </div>
  </ClientOnly>
</template>

<style scoped>
.pwa-banner {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + 76px);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100vw - 24px);
  padding: 10px 14px;
  border-radius: 14px;
  background: #5b4b3a;
  color: #faf6ee;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  font-size: 14px;
}
.pwa-banner__go {
  background: #c2703d;
  color: #fff;
  border: 0;
  border-radius: 9px;
  padding: 6px 12px;
  font-weight: 600;
  cursor: pointer;
}
.pwa-banner__later {
  background: transparent;
  color: #d8cdbb;
  border: 0;
  cursor: pointer;
  font-size: 13px;
}
</style>
