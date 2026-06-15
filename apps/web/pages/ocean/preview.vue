<script setup lang="ts">
import { useQuotaStore } from '~/stores/quota';
import { useOceanStore, type UnsealedLetter } from '~/stores/ocean';

const api = useApi();
const quota = useQuotaStore();
const ocean = useOceanStore();

const busy = ref(false);
const error = ref('');

onMounted(() => {
  if (!ocean.preview) navigateTo('/ocean');
});

async function release() {
  if (!ocean.preview) return;
  busy.value = true;
  try {
    await api.post(`/fishing/${ocean.preview.fishingId}/release`);
    ocean.clear();
    await navigateTo('/ocean');
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function unseal() {
  if (!ocean.preview || quota.unseal <= 0) return;
  busy.value = true;
  error.value = '';
  try {
    const full = await api.post<UnsealedLetter>(`/fishing/${ocean.preview.fishingId}/unseal`);
    ocean.setUnsealed(full);
    await quota.load();
    await navigateTo('/ocean/read');
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="ocean.preview" class="pt-6">
    <LetterCard :preview="ocean.preview" />

    <p v-if="error" class="mt-3 text-sm text-terra">{{ error }}</p>

    <div class="mt-6 grid grid-cols-2 gap-3">
      <button class="btn-ghost" :disabled="busy" @click="release">放回海面</button>
      <button class="btn-primary" :disabled="busy || quota.unseal <= 0" @click="unseal">
        {{ quota.unseal > 0 ? '拆开火漆' : '今日拆封已用尽' }}
      </button>
    </div>
    <p class="mt-3 text-center text-[11px] text-inkFaint">每天只能认真拆开一封。拆封后，这封信将只属于你们俩。</p>
  </div>
</template>
