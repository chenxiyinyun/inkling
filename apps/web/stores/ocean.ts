import { defineStore } from 'pinia';
import type { LetterPreview } from '@inkling/shared';

export interface UnsealedLetter {
  unsealId: string;
  letterId: string;
  author: { publicId: string; penName: string; mbti: string; interestTags: string[]; oneLiner?: string };
  body: string;
  theme?: string;
  replyDeadline: string;
}

const KEY = 'inkling_ocean_flow';

interface OceanFlow {
  preview: LetterPreview | null;
  unsealed: UnsealedLetter | null;
}

function loadFlow(): OceanFlow {
  if (import.meta.client) {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as OceanFlow;
    } catch {
      /* ignore */
    }
  }
  return { preview: null, unsealed: null };
}

function persist(flow: OceanFlow) {
  if (!import.meta.client) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(flow));
  } catch {
    /* ignore */
  }
}

/**
 * 暂存当前打捞流程中的预览与已拆封信件（页面间传递）。
 * 持久化到 sessionStorage，刷新预览/读信/回信页不丢失流程。
 */
export const useOceanStore = defineStore('ocean', {
  state: (): OceanFlow => loadFlow(),
  actions: {
    setPreview(p: LetterPreview | null) {
      this.preview = p;
      persist(this.$state);
    },
    setUnsealed(u: UnsealedLetter | null) {
      this.unsealed = u;
      persist(this.$state);
    },
    clear() {
      this.preview = null;
      this.unsealed = null;
      persist(this.$state);
    },
  },
});
