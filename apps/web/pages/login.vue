<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
definePageMeta({ layout: 'blank' });

const api = useApi();
const auth = useAuthStore();

const mode = ref<'login' | 'register'>('login');
const form = reactive({ email: '', password: '', penName: '', birthDate: '' });
const loading = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    if (mode.value === 'register') {
      const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/register', {
        email: form.email,
        password: form.password,
        penName: form.penName,
        birthDate: form.birthDate,
      });
      auth.setTokens(res.accessToken, res.refreshToken);
      auth.setMe(await api.get('/me'));
      await navigateTo('/onboarding/profile');
    } else {
      const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', {
        email: form.email,
        password: form.password,
      });
      auth.setTokens(res.accessToken, res.refreshToken);
      auth.setMe(await api.get('/me'));
      await navigateTo('/ocean');
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="pt-10">
    <h1 class="font-serif text-3xl font-700">信逢 <span class="text-terra">Inkling</span></h1>
    <p class="mt-2 text-inkSoft">让社交回归真诚与纯粹。慢，所以可贵。</p>

    <div class="card mt-8">
      <div class="flex gap-2 mb-5">
        <button class="flex-1 py-2 rounded-xl text-sm" :class="mode === 'login' ? 'bg-terra text-white' : 'bg-paperEdge text-inkSoft'" @click="mode = 'login'">登录</button>
        <button class="flex-1 py-2 rounded-xl text-sm" :class="mode === 'register' ? 'bg-terra text-white' : 'bg-paperEdge text-inkSoft'" @click="mode = 'register'">领取通行证</button>
      </div>

      <div class="space-y-3">
        <input v-model="form.email" class="input" type="email" placeholder="邮箱" autocomplete="email" />
        <input v-model="form.password" class="input" type="password" placeholder="密码（至少 8 位）" autocomplete="current-password" />
        <template v-if="mode === 'register'">
          <input v-model="form.penName" class="input" type="text" placeholder="笔名" />
          <label class="block text-xs text-inkSoft">出生日期（仅用于年龄保护）</label>
          <input v-model="form.birthDate" class="input" type="date" />
        </template>
      </div>

      <p v-if="error" class="mt-3 text-sm text-terra">{{ error }}</p>

      <button class="btn-primary w-full mt-5" :disabled="loading" @click="submit">
        {{ loading ? '邮局正在分拣…' : mode === 'login' ? '登录' : '开启航行' }}
      </button>
    </div>

    <p class="mt-6 text-center text-[11px] text-inkFaint">我们只保管你的真诚，不保管你的精确位置。</p>
  </div>
</template>
