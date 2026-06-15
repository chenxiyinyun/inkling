<script setup lang="ts">
import type { MyLetter } from '@inkling/shared';

const api = useApi();
const letters = ref<MyLetter[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    letters.value = await api.get<MyLetter[]>('/letters');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="pt-4">
    <h1 class="font-serif text-2xl font-700">我的信件</h1>
    <p class="mt-1 text-sm text-inkSoft">你寄出的每一份心意，都在路上。</p>

    <div v-if="loading" class="mt-8 text-center text-inkFaint">展信中…</div>

    <div v-else-if="letters.length === 0" class="mt-16 text-center text-inkSoft font-serif">
      还没有寄出过信。<br />写下第一封，交给大海吧。
    </div>

    <div v-else class="mt-5 space-y-3">
      <div v-for="l in letters" :key="l.letterId" class="card">
        <div class="flex items-center justify-between">
          <span class="chip">{{ l.driftLabel }}</span>
          <span class="text-[11px] text-inkFaint">{{ new Date(l.createdAt).toLocaleDateString() }}</span>
        </div>
        <p class="mt-2 text-sm text-ink/90">{{ l.bodyExcerpt }}</p>
      </div>
    </div>

    <NuxtLink to="/letters/new" class="btn-primary fixed bottom-20 right-5 shadow-lg !rounded-full !px-5 !py-4">
      🖋 投递漂流瓶
    </NuxtLink>
  </div>
</template>
