<script setup lang="ts">
import { MBTI_TYPES, MBTI_LABELS_ZH, MBTI_UNKNOWN } from '@inkling/shared';
import { useAuthStore } from '~/stores/auth';
definePageMeta({ layout: 'blank' });

const api = useApi();
const auth = useAuthStore();

const PRESET_TAGS = ['阅读', '音乐', '旅行', '电影', '手作', '运动', '美食', '摄影', '写作', '哲学', '猫', '狗', '游戏', '茶', '咖啡', '诗', '独处', '徒步'];

const form = reactive({
  penName: auth.me?.penName ?? '',
  mbti: (auth.me?.mbti as string) ?? MBTI_UNKNOWN,
  tags: [] as string[],
  oneLiner: '',
  lat: undefined as number | undefined,
  lng: undefined as number | undefined,
});
const geoState = ref<'idle' | 'ok' | 'denied'>('idle');
const saving = ref(false);
const error = ref('');

function toggleTag(t: string) {
  const i = form.tags.indexOf(t);
  if (i >= 0) form.tags.splice(i, 1);
  else if (form.tags.length < 6) form.tags.push(t);
}

function locate() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.lat = pos.coords.latitude;
      form.lng = pos.coords.longitude;
      geoState.value = 'ok';
    },
    () => (geoState.value = 'denied'),
  );
}

async function save() {
  error.value = '';
  if (form.tags.length < 3) {
    error.value = '再选几个兴趣吧（至少 3 个）';
    return;
  }
  saving.value = true;
  try {
    const me = await api.patch('/me/profile', {
      penName: form.penName,
      mbti: form.mbti,
      interestTags: form.tags,
      oneLiner: form.oneLiner || undefined,
      lat: form.lat,
      lng: form.lng,
    });
    auth.setMe(me);
    await navigateTo('/ocean');
  } catch (e: any) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="pt-6 pb-16">
    <h1 class="font-serif text-2xl font-700">你的文字名片</h1>
    <p class="mt-1 text-sm text-inkSoft">这是别人打捞到你时最先看到的样子（不含照片）。</p>

    <div class="space-y-6 mt-6">
      <div>
        <label class="text-sm font-600">笔名</label>
        <input v-model="form.penName" class="input mt-2" placeholder="你想被怎样称呼" />
      </div>

      <div>
        <label class="text-sm font-600">MBTI（自报，不准也没关系）</label>
        <div class="mt-2 grid grid-cols-4 gap-2">
          <button
            v-for="t in MBTI_TYPES"
            :key="t"
            class="py-2 rounded-xl text-xs"
            :class="form.mbti === t ? 'bg-terra text-white' : 'bg-white border border-paperEdge text-inkSoft'"
            @click="form.mbti = t"
          >
            {{ t }}
          </button>
        </div>
        <button
          class="mt-2 w-full py-2 rounded-xl text-xs"
          :class="form.mbti === MBTI_UNKNOWN ? 'bg-terra text-white' : 'bg-white border border-paperEdge text-inkSoft'"
          @click="form.mbti = MBTI_UNKNOWN"
        >
          我还不确定
        </button>
        <p v-if="form.mbti !== MBTI_UNKNOWN" class="mt-1 text-[11px] text-inkFaint">{{ MBTI_LABELS_ZH[form.mbti as keyof typeof MBTI_LABELS_ZH] }}</p>
      </div>

      <div>
        <label class="text-sm font-600">兴趣标签 <span class="text-inkFaint">（{{ form.tags.length }}/6，至少 3 个）</span></label>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="t in PRESET_TAGS"
            :key="t"
            class="px-3 py-1.5 rounded-full text-xs"
            :class="form.tags.includes(t) ? 'bg-terra text-white' : 'bg-white border border-paperEdge text-inkSoft'"
            @click="toggleTag(t)"
          >
            {{ t }}
          </button>
        </div>
      </div>

      <div>
        <label class="text-sm font-600">一句话（会露在名片上）</label>
        <input v-model="form.oneLiner" maxlength="30" class="input mt-2" placeholder="此刻你想说的一句话" />
      </div>

      <div>
        <label class="text-sm font-600">所在区域</label>
        <p class="text-[11px] text-inkFaint mt-1">只取粗粒度区域（约 5 公里），用于决定信使快慢，绝不存精确位置。</p>
        <button class="btn-ghost mt-2 text-sm" @click="locate">
          {{ geoState === 'ok' ? '✓ 已记下你的大致海域' : geoState === 'denied' ? '未授权（将按兴趣匹配）' : '让信使知道我在哪片海' }}
        </button>
      </div>

      <p v-if="error" class="text-sm text-terra">{{ error }}</p>
      <button class="btn-primary w-full" :disabled="saving" @click="save">{{ saving ? '保存中…' : '进入漂流海' }}</button>
    </div>
  </div>
</template>
