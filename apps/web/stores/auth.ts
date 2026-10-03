import { defineStore } from 'pinia';
import type { MeProfile } from '@inkling/shared';
import { useOceanStore } from './ocean';
import { useQuotaStore } from './quota';

const TOKEN_KEY = 'inkling_token';
const REFRESH_KEY = 'inkling_refresh';
const DRAFT_KEY = 'inkling_letter_draft';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: (import.meta.client ? localStorage.getItem(TOKEN_KEY) : null) as string | null,
    refreshToken: (import.meta.client ? localStorage.getItem(REFRESH_KEY) : null) as string | null,
    me: null as MeProfile | null,
  }),
  getters: {
    isAuthed: (s) => !!s.token,
  },
  actions: {
    setTokens(accessToken: string, refreshToken?: string) {
      this.token = accessToken;
      if (refreshToken) this.refreshToken = refreshToken;
      if (import.meta.client) {
        localStorage.setItem(TOKEN_KEY, accessToken);
        if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
      }
    },
    setMe(me: MeProfile) {
      this.me = me;
    },
    /** 登出必须「彻底」：否则同一标签页换账号可见上一账号的草稿 / 已拆封信件 / 配额角标。 */
    logout() {
      this.token = null;
      this.refreshToken = null;
      this.me = null;
      if (import.meta.client) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        // 本机残留：写信草稿 + 打捞流程（后者含已拆封信全文与作者名片）
        localStorage.removeItem(DRAFT_KEY);
        sessionStorage.removeItem('inkling_ocean_flow');
      }
      try {
        useOceanStore().clear();
      } catch { /* Pinia 未就绪时忽略（如极早的 401） */ }
      try {
        useQuotaStore().$reset();
      } catch { /* 同上 */ }
    },
  },
});
