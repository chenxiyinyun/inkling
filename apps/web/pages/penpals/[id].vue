<script setup lang="ts">
import type { PenPalSummary } from '@inkling/shared';

const api = useApi();
const route = useRoute();
const id = route.params.id as string;

const rel = ref<PenPalSummary | null>(null);
const letters = ref<any[]>([]);
const body = ref('');
const sending = ref(false);
const error = ref('');

async function load() {
  rel.value = await api.get<PenPalSummary>(`/penpals/${id}`);
  letters.value = await api.get<any[]>(`/penpals/${id}/letters`);
}
onMounted(load);

async function send() {
  if (!body.value.trim()) return;
  sending.value = true;
  error.value = '';
  try {
    await api.post(`/penpals/${id}/letters`, { body: body.value });
    body.value = '';
    await load();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="pt-4 pb-32">
    <div class="flex items-center gap-2">
      <NuxtLink to="/penpals" class="text-inkFaint">‹</NuxtLink>
      <h1 class="font-serif text-xl font-700">{{ rel?.partner.penName ?? '笔友' }}</h1>
    </div>

    <div class="mt-5 space-y-3">
      <div v-for="c in letters" :key="c.id" class="flex" :class="c.mine ? 'justify-end' : 'justify-start'">
        <div
          class="max-w-[80%] rounded-2xl px-4 py-3 text-sm"
          :class="c.mine ? 'bg-terraSoft text-ink' : 'bg-white border border-paperEdge'"
        >
          <template v-if="c.inTransit">
            <span class="text-inkFaint italic">{{ c.mine ? '信鸽已出发，在途中…' : '有一封信正在路上…' }}</span>
          </template>
          <template v-else>
            <p class="whitespace-pre-wrap">{{ c.body }}</p>
          </template>
        </div>
      </div>
    </div>

    <p v-if="error" class="mt-3 text-sm text-terra">{{ error }}</p>

    <div class="fixed bottom-16 inset-x-0 bg-paper/95 backdrop-blur border-t border-paperEdge">
      <div class="max-w-screen-sm mx-auto px-4 py-3 flex gap-2">
        <input v-model="body" class="input flex-1" placeholder="回一封信…" @keyup.enter="send" />
        <button class="btn-primary" :disabled="sending" @click="send">寄出</button>
      </div>
    </div>
  </div>
</template>
