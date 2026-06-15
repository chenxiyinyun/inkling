import { defineStore } from 'pinia';
import type { QuotaToday } from '@inkling/shared';

export const useQuotaStore = defineStore('quota', {
  state: (): QuotaToday & { loaded: boolean } => ({ send: 0, fish: 0, unseal: 0, resetsAt: '', loaded: false }),
  actions: {
    async load() {
      const api = useApi();
      const q = await api.get<QuotaToday>('/quota/today');
      this.send = q.send;
      this.fish = q.fish;
      this.unseal = q.unseal;
      this.resetsAt = q.resetsAt;
      this.loaded = true;
    },
  },
});
