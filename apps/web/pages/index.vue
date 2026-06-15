<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
definePageMeta({ layout: 'blank' });
const auth = useAuthStore();
onMounted(() => navigateTo(auth.isAuthed ? '/ocean' : '/login'));
</script>

<template>
  <div class="text-center pt-24 text-inkSoft font-serif">正在为你打开漂流邮局…</div>
</template>
