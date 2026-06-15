<script setup lang="ts">
import { useQuotaStore } from '~/stores/quota';

const api = useApi();
const quota = useQuotaStore();

const THEMES = ['写给同样在异乡的人', '最近一件让你慢下来的小事', '你书架上最旧的那本书', '一个想去却还没去的地方'];
const body = ref('');
const theme = ref(THEMES[0]);
const sending = ref(false);
const error = ref('');

onMounted(() => quota.load().catch(() => {}));

async function send() {
  if (body.value.trim().length < 50) {
    error.value = '再多写几句，让信更有分量（至少 50 字）';
    return;
  }
  sending.value = true;
  error.value = '';
  try {
    await api.post('/letters/compose', { body: body.value, theme: theme.value });
    await quota.load();
    await navigateTo('/letters');
  } catch (e: any) {
    error.value = e.message;
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="pt-4 pb-10">
    <div class="flex items-center justify-between">
      <h1 class="font-serif text-xl font-700">投递漂流瓶</h1>
      <span class="text-xs text-inkFaint">今日投递 {{ quota.send }}</span>
    </div>

    <div v-if="quota.loaded && quota.send <= 0" class="mt-10 text-center text-inkSoft font-serif">
      今日漂流瓶已用尽，明日潮汐再启。
    </div>

    <template v-else>
      <label class="text-sm font-600 mt-4 block">今日信笺主题</label>
      <select v-model="theme" class="input mt-2">
        <option v-for="t in THEMES" :key="t" :value="t">{{ t }}</option>
      </select>

      <textarea v-model="body" rows="12" maxlength="1000" class="letter-paper w-full rounded-2xl p-4 mt-4 outline-none border border-paperEdge" placeholder="亲爱的陌生人，此刻我想说……" />
      <div class="mt-1 text-right text-[11px] text-inkFaint">{{ body.length }}/1000</div>

      <p v-if="error" class="text-sm text-terra">{{ error }}</p>
      <button class="btn-primary w-full mt-3" :disabled="sending" @click="send">{{ sending ? '邮局正在分拣…' : '封缄寄出' }}</button>
      <p class="mt-3 text-center text-[11px] text-inkFaint">信一旦寄出，便无法召回，会随车马漂向远方。</p>
    </template>
  </div>
</template>
