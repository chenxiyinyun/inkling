<script setup lang="ts">
const route = useRoute();
const tabs = [
  { to: '/ocean', label: '漂流海', icon: '🌊' },
  { to: '/letters', label: '我的信件', icon: '📨' },
  { to: '/penpals', label: '笔友信匣', icon: '🕊' },
  { to: '/me', label: '我的', icon: '🪔' },
];
const isActive = (to: string) => route.path === to || route.path.startsWith(to + '/');
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 z-10 bg-paper/95 backdrop-blur border-t border-paperEdge pb-[env(safe-area-inset-bottom)]">
    <div class="max-w-screen-sm mx-auto flex items-stretch">
      <NuxtLink
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px]"
        :class="isActive(t.to) ? 'text-terra' : 'text-inkFaint'"
      >
        <span class="text-lg leading-none">{{ t.icon }}</span>
        <span>{{ t.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
