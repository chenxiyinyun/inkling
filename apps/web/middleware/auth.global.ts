import { useAuthStore } from '~/stores/auth';

const PUBLIC_PATHS = ['/login'];

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (to.path === '/') return; // 首页自行分流
  if (!auth.isAuthed && !PUBLIC_PATHS.includes(to.path)) {
    return navigateTo('/login');
  }
  if (auth.isAuthed && to.path === '/login') {
    return navigateTo('/ocean');
  }
});
