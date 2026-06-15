<script setup lang="ts">
import type { LetterPreview } from '@inkling/shared';
import { useQuotaStore } from '~/stores/quota';
import { useOceanStore } from '~/stores/ocean';

const api = useApi();
const quota = useQuotaStore();
const ocean = useOceanStore();

const fishing = ref(false);
const message = ref('');

onMounted(() => quota.load().catch(() => {}));

async function fish() {
  if (quota.fish <= 0) return;
  message.value = '';
  fishing.value = true;
  try {
    // 抛竿动画与请求并行，给涟漪一点露出时间
    const [preview] = await Promise.all([
      api.post<LetterPreview>('/ocean/fish'),
      new Promise((r) => setTimeout(r, 700)),
    ]);
    ocean.setPreview(preview);
    await quota.load();
    await navigateTo('/ocean/preview');
  } catch (e: any) {
    message.value = e.message;
    await quota.load();
  } finally {
    fishing.value = false;
  }
}
</script>

<template>
  <div class="pt-8 text-center">
    <OceanScene :fishing="fishing" class="mb-4" />
    <h1 class="font-serif text-2xl font-700">漂流海</h1>
    <p class="mt-2 text-sm text-inkSoft">每一次打捞，都是一次未知的相遇。</p>

    <div class="mt-10">
      <button class="btn-primary text-base px-10 py-4" :disabled="fishing || quota.fish <= 0" @click="fish">
        {{ fishing ? '抛竿入海…' : '打捞一封漂流信' }}
      </button>
      <p class="mt-4 text-xs text-inkFaint">今日还可打捞 {{ quota.fish }} 次 · 拆封 {{ quota.unseal }} 次</p>
    </div>

    <p v-if="quota.loaded && quota.fish <= 0" class="mt-10 text-inkSoft font-serif">今日漂流海已平静，明早信使再来。</p>
    <p v-if="message" class="mt-8 text-terra">{{ message }}</p>
  </div>
</template>
