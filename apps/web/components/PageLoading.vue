<script setup lang="ts">
defineProps<{ text?: string }>();
</script>

<template>
  <div class="py-16 flex flex-col items-center gap-3 text-inkFaint">
    <div class="loading-dots flex gap-1.5">
      <span /><span /><span />
    </div>
    <p class="font-serif text-sm">{{ text ?? '展信中…' }}</p>
  </div>
</template>

<style scoped>
.loading-dots span {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: currentColor;
  animation: ink-bounce 1s infinite ease-in-out both;
}
.loading-dots span:nth-child(1) {
  animation-delay: -0.3s;
}
.loading-dots span:nth-child(2) {
  animation-delay: -0.15s;
}
@keyframes ink-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.5);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading-dots span {
    animation: none;
    opacity: 0.6;
  }
}
</style>
