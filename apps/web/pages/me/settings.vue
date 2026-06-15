<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const api = useApi();
const auth = useAuthStore();
const toast = useToast();

const invisible = ref(false);
const guardianMode = ref(false);
const isMinor = computed(() => auth.me?.ageTier === 'TEEN');
const loading = ref(!auth.me);
const saving = ref(false);

onMounted(async () => {
  if (!auth.me) {
    try {
      auth.setMe(await api.get('/me'));
    } finally {
      loading.value = false;
    }
  }
  invisible.value = auth.me?.invisible ?? false;
  guardianMode.value = auth.me?.guardianMode ?? false;
});

async function save() {
  saving.value = true;
  try {
    const me = await api.patch('/me/settings', { invisible: invisible.value, guardianMode: guardianMode.value });
    auth.setMe(me);
    toast.success('已保存');
  } catch (e: any) {
    toast.error(e.message);
  } finally {
    saving.value = false;
  }
}

async function exportData() {
  try {
    const data = await api.post('/me/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inkling-data.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('数据已导出下载');
  } catch (e: any) {
    toast.error(e.message);
  }
}

async function requestDeletion() {
  if (!confirm('确定要注销账号吗？此操作将登记删除请求。')) return;
  try {
    const res = await api.del('/me');
    toast.info((res as any)?.message ?? '已登记注销请求');
  } catch (e: any) {
    toast.error(e.message);
  }
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

    <PageLoading v-if="loading" />

    <template v-else>
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

        <button class="btn-primary w-full" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存设置' }}</button>
      </div>

      <div class="card mt-4 space-y-2">
        <div class="font-600 text-sm">账号与隐私</div>
        <button class="btn-ghost w-full text-sm" @click="exportData">导出我的数据（GDPR）</button>
        <button class="btn-ghost w-full text-sm" @click="requestDeletion">注销账号</button>
      </div>

      <button class="btn-ghost w-full mt-4" @click="logout">退出登录</button>
    </template>
  </div>
</template>
