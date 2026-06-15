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

/** 暂存当前打捞流程中的预览与已拆封信件（页面间传递，SPA 内存态）。 */
export const useOceanStore = defineStore('ocean', {
  state: () => ({
    preview: null as LetterPreview | null,
    unsealed: null as UnsealedLetter | null,
  }),
  actions: {
    setPreview(p: LetterPreview | null) {
      this.preview = p;
    },
    setUnsealed(u: UnsealedLetter | null) {
      this.unsealed = u;
    },
    clear() {
      this.preview = null;
      this.unsealed = null;
    },
  },
});
