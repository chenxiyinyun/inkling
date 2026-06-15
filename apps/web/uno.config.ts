import { defineConfig, presetUno, presetTypography } from 'unocss';

// 信逢视觉基调：宣纸米白 + 墨黑 + 朱砂红（火漆）+ 暮蓝（海）
export default defineConfig({
  presets: [presetUno(), presetTypography()],
  theme: {
    colors: {
      paper: '#FAF6EE',
      paperEdge: '#EFE7D6',
      ink: '#2C2C2A',
      inkSoft: '#73726C',
      inkFaint: '#B4B2A9',
      terra: '#D85A30',
      terraSoft: '#FAECE7',
      sea: '#378ADD',
      seaSoft: '#E6F1FB',
      jade: '#1D9E75',
      jadeSoft: '#E1F5EE',
    },
    fontFamily: {
      serif: '"Noto Serif SC", "Songti SC", serif',
    },
  },
  shortcuts: {
    'btn': 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-medium transition active:scale-97 disabled:opacity-40 disabled:pointer-events-none',
    'btn-primary': 'btn bg-terra text-white shadow-sm hover:brightness-105',
    'btn-ghost': 'btn bg-paperEdge text-ink hover:bg-paperEdge/70',
    'card': 'bg-white rounded-3xl border border-paperEdge p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]',
    'chip': 'inline-flex items-center px-3 py-1 rounded-full text-xs bg-terraSoft text-terra',
    'input': 'w-full px-4 py-3 rounded-2xl border border-paperEdge bg-white outline-none focus:border-terra/60',
    'page': 'min-h-screen bg-paper text-ink pb-24',
  },
});
