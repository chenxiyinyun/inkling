<script setup lang="ts">
import { MBTI_LABELS_ZH } from '@inkling/shared';
import { useAuthStore } from '~/stores/auth';

const api = useApi();
const auth = useAuthStore();
const loading = ref(!auth.me);

onMounted(async () => {
  if (!auth.me) {
    try {
      auth.setMe(await api.get('/me'));
    } finally {
      loading.value = false;
    }
  }
});

const ageTierLabel: Record<string, string> = { ADULT: '成年', TEEN: '未成年（守护中）', CHILD: '受限' };
</script>

<template>
  <div class="pt-4">
    <h1 class="font-serif text-2xl font-700">我的</h1>

    <PageLoading v-if="loading" />

    <div v-else-if="auth.me" class="card mt-5">
      <div class="font-serif text-xl font-700">{{ auth.me.penName }}</div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <span class="chip">{{ auth.me.mbti === 'UNKNOWN' ? '型号待解' : auth.me.mbti }}</span>
        <span v-for="t in auth.me.interestTags" :key="t" class="chip bg-paperEdge text-inkSoft">{{ t }}</span>
      </div>
      <p v-if="auth.me.oneLiner" class="mt-3 text-sm italic text-inkSoft">「{{ auth.me.oneLiner }}」</p>
      <div class="mt-4 text-xs text-inkFaint">账号状态：{{ ageTierLabel[auth.me.ageTier] ?? auth.me.ageTier }}</div>
    </div>

    <div class="mt-5 space-y-2">
      <NuxtLink to="/me/notifications" class="card block">通知中心 ›</NuxtLink>
      <NuxtLink to="/onboarding/profile" class="card block">编辑文字名片 ›</NuxtLink>
      <NuxtLink to="/me/settings" class="card block">设置（守护模式 · 闭关 · 隐私）›</NuxtLink>
    </div>
  </div>
</template>
