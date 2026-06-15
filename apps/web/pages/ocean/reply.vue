<script setup lang="ts">
import { useOceanStore } from '~/stores/ocean';

const api = useApi();
const ocean = useOceanStore();

const body = ref('');
const sending = ref(false);
const error = ref('');

onMounted(() => {
  if (!ocean.unsealed) navigateTo('/ocean');
});

async function send() {
  if (!ocean.unsealed) return;
  if (body.value.trim().length < 50) {
    error.value = '回信也多写几句吧（至少 50 字）';
    return;
  }
  sending.value = true;
  error.value = '';
  try {
    await api.post(`/unseals/${ocean.unsealed.unsealId}/reply`, { body: body.value });
    ocean.clear();
    await navigateTo('/penpals');
  } catch (e: any) {
    error.value = e.message;
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div v-if="ocean.unsealed" class="pt-6">
    <h1 class="font-serif text-xl font-700">回信给 {{ ocean.unsealed.author.penName }}</h1>
    <textarea v-model="body" rows="12" maxlength="1000" class="letter-paper w-full rounded-2xl p-4 mt-4 outline-none border border-paperEdge" placeholder="亲爱的陌生人，读了你的信，我想说……" />
    <div class="mt-1 text-right text-[11px] text-inkFaint">{{ body.length }}/1000</div>
    <p v-if="error" class="text-sm text-terra">{{ error }}</p>
    <button class="btn-primary w-full mt-3" :disabled="sending" @click="send">{{ sending ? '盖上火漆，放飞信使…' : '封缄寄出' }}</button>
    <p class="mt-3 text-center text-[11px] text-inkFaint">寄出后，你们将结缘成为笔友。</p>
  </div>
</template>
