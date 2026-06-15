<script setup lang="ts">
const { toasts } = useToast();
</script>

<template>
  <div class="fixed top-3 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto max-w-[90%] px-4 py-2.5 rounded-2xl text-sm shadow-lg backdrop-blur"
        :class="t.type === 'error' ? 'bg-terra text-white' : t.type === 'success' ? 'bg-jade text-white' : 'bg-ink/90 text-white'"
      >
        {{ t.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
