<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const api = useApi();
const auth = useAuthStore();

const invisible = ref(false);
const guardianMode = ref(false);
const isMinor = computed(() => auth.me?.ageTier === 'TEEN');
const msg = ref('');

onMounted(async () => {
  if (!auth.me) auth.setMe(await api.get('/me'));
  invisible.value = auth.me?.invisible ?? false;
  guardianMode.value = auth.me?.guardianMode ?? false;
});

async function save() {
  msg.value = '';
  try {
    const me = await api.patch('/me/settings', { invisible: invisible.value, guardianMode: guardianMode.value });
    auth.setMe(me);
    msg.value = '已保存';
  } catch (e: any) {
    msg.value = e.message;
  }
}

async function exportData() {
  const data = await api.post('/me/export');
  msg.value = '已生成数据导出（见控制台）';
  console.log('数据导出', data);
}

async function requestDeletion() {
  if (!confirm('确定要注销账号吗？此操作将登记删除请求。')) return;
  const res = await api.del('/me');
  msg.value = (res as any)?.message ?? '已登记注销请求';
}

function logout() {
  auth.logout();
  navigateTo('/login');
}
</script>

<template>
  <div class="pt-4 pb-10">
    <div class="flex items-center gap-2">
      <NuxtLink to="/me" class="text-inkFaint">‹</NuxtLink>
      <h1 class="font-serif text-xl font-700">设置</h1>
    </div>

    <div class="card mt-5 space-y-4">
      <label class="flex items-center justify-between">
        <span>
          <span class="font-600">闭关（隐身）</span>
          <span class="block text-xs text-inkFaint">闭关时，你的信暂不漂入漂流海</span>
        </span>
        <input v-model="invisible" type="checkbox" class="w-5 h-5 accent-terra" />
      </label>

      <label class="flex items-center justify-between">
        <span>
          <span class="font-600">守护模式</span>
          <span class="block text-xs text-inkFaint">{{ isMinor ? '未成年用户不可关闭' : '更严格的内容与互动保护' }}</span>
        </span>
        <input v-model="guardianMode" type="checkbox" :disabled="isMinor" class="w-5 h-5 accent-terra disabled:opacity-50" />
      </label>

      <button class="btn-primary w-full" @click="save">保存设置</button>
      <p v-if="msg" class="text-sm text-terra text-center">{{ msg }}</p>
    </div>

    <div class="card mt-4 space-y-2">
      <div class="font-600 text-sm">账号与隐私</div>
      <button class="btn-ghost w-full text-sm" @click="exportData">导出我的数据（GDPR）</button>
      <button class="btn-ghost w-full text-sm" @click="requestDeletion">注销账号</button>
    </div>

    <button class="btn-ghost w-full mt-4" @click="logout">退出登录</button>
  </div>
</template>
