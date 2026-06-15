import { defineStore } from 'pinia';
import type { MeProfile } from '@inkling/shared';

const TOKEN_KEY = 'inkling_token';
const REFRESH_KEY = 'inkling_refresh';

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
    logout() {
      this.token = null;
      this.refreshToken = null;
      this.me = null;
      if (import.meta.client) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
      }
    },
  },
});
