<script setup lang="ts">
import type { PublicProfile } from '@inkling/shared';

const api = useApi();
const route = useRoute();
const profile = ref<PublicProfile | null>(null);
const error = ref('');

onMounted(async () => {
  try {
    profile.value = await api.get<PublicProfile>(`/profiles/${route.params.publicId}`);
  } catch (e: any) {
    error.value = e.message;
  }
});
</script>

<template>
  <div class="pt-6">
    <NuxtLink to="#" class="text-inkFaint" @click.prevent="$router.back()">‹ 返回</NuxtLink>
    <div v-if="profile" class="card mt-4">
      <div class="font-serif text-xl font-700">{{ profile.penName }}</div>
      <div class="mt-1 text-xs text-inkFaint">{{ profile.region }}</div>
      <div class="mt-3 flex flex-wrap gap-1.5">
        <span class="chip">{{ profile.mbti }}</span>
        <span v-for="t in profile.interestTags" :key="t" class="chip bg-paperEdge text-inkSoft">{{ t }}</span>
      </div>
      <p v-if="profile.oneLiner" class="mt-3 text-sm italic text-inkSoft">「{{ profile.oneLiner }}」</p>
    </div>
    <p v-if="error" class="mt-6 text-center text-inkSoft">{{ error }}</p>
  </div>
</template>
