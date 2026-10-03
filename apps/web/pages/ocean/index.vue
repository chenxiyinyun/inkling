<script setup lang="ts">
import type { LetterPreview } from '@inkling/shared';
import { useQuotaStore } from '~/stores/quota';
import { useOceanStore } from '~/stores/ocean';

const api = useApi();
const quota = useQuotaStore();
const ocean = useOceanStore();

const fishing = ref(false);
const message = ref('');
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | undefined;

const previewExpired = () => !!ocean.preview && new Date(ocean.preview.lockUntil).getTime() <= now.value;
const activePreview = computed(() => (ocean.preview && !previewExpired() ? ocean.preview : null));
const previewMinutes = computed(() =>
  ocean.preview ? Math.max(0, Math.ceil((new Date(ocean.preview.lockUntil).getTime() - now.value) / 60000)) : 0,
);
const unsealedDaysLeft = computed(() =>
  ocean.unsealed ? Math.max(0, Math.ceil((new Date(ocean.unsealed.replyDeadline).getTime() - now.value) / 86400000)) : 0,
);

/** 预览锁过期即清理：离开页面再回来时，看到的是真实的「已漂走」状态而非幽灵入口。 */
function checkPreviewExpiry() {
  if (previewExpired()) {
    ocean.setPreview(null);
    message.value = '上一次打捞的信在犹豫中漂走了';
  }
}

onMounted(() => {
  quota.load().catch(() => {});
  checkPreviewExpiry();
  ticker = setInterval(() => {
    now.value = Date.now();
    checkPreviewExpiry();
  }, 15_000);
});
onBeforeUnmount(() => clearInterval(ticker));

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

    <!-- 未完成的相遇：离开后回来仍可继续（预览锁内 / 回信潮汐内） -->
    <div v-if="activePreview || ocean.unsealed" class="mt-6 space-y-2 text-left">
      <NuxtLink v-if="activePreview" to="/ocean/preview" class="card flex items-center justify-between">
        <div>
          <div class="text-sm font-600">你打捞到一封信，还在等你做决定</div>
          <div class="mt-0.5 text-xs text-inkFaint">预览锁剩 {{ previewMinutes }} 分钟</div>
        </div>
        <span class="text-terra text-sm font-600">继续查看 ›</span>
      </NuxtLink>
      <NuxtLink v-if="ocean.unsealed" to="/ocean/read" class="card flex items-center justify-between">
        <div>
          <div class="text-sm font-600">你有封已拆开的信，等待回信</div>
          <div class="mt-0.5 text-xs text-inkFaint">回信潮汐剩 {{ unsealedDaysLeft }} 天</div>
        </div>
        <span class="text-sea text-sm font-600">去回信 ›</span>
      </NuxtLink>
    </div>

    <div class="mt-8">
      <button class="btn-primary text-base px-10 py-4" :disabled="fishing || quota.fish <= 0" @click="fish">
        {{ fishing ? '抛竿入海…' : '打捞一封漂流信' }}
      </button>
      <p class="mt-4 text-xs text-inkFaint">今日还可打捞 {{ quota.fish }} 次 · 拆封 {{ quota.unseal }} 次</p>
    </div>

    <p v-if="quota.loaded && quota.fish <= 0" class="mt-10 text-inkSoft font-serif">今日漂流海已平静，明早信使再来。</p>
    <p v-if="message" class="mt-8 text-terra">{{ message }}</p>
  </div>
</template>
