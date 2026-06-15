export type ToastType = 'info' | 'error' | 'success';
export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

/** 轻量全局 toast：克制地提示一次性操作结果（保存/导出/寄信失败等）。 */
export function useToast() {
  const toasts = useState<Toast[]>('inkling_toasts', () => []);

  function push(message: string, type: ToastType) {
    if (!message) return;
    const id = Date.now() + Math.floor(Math.random() * 1000);
    toasts.value = [...toasts.value, { id, message, type }];
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 2800);
  }

  return {
    toasts,
    info: (m: string) => push(m, 'info'),
    error: (m: string) => push(m, 'error'),
    success: (m: string) => push(m, 'success'),
  };
}
