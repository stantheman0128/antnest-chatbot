'use client';

import { createContext, createElement, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// ── Shared getToken ──────────────────────────────────

export function getToken(): string {
  return localStorage.getItem('admin_token') || '';
}

// ── Toast System ─────────────────────────────────────

type ToastVariant = 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    const ms = variant === 'error' ? 5000 : 3000;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ms);
  }, []);

  const contextValue = { toast };

  return createElement(
    ToastContext.Provider,
    // eslint-disable-next-line react-hooks/refs
    { value: contextValue },
    children,
    /* Toast container — fixed above bottom nav */
    toasts.length > 0 &&
      createElement(
        'div',
        {
          className:
            'fixed left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none',
          style: { bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 12px)' },
        },
        toasts.map((t) =>
          createElement(
            'div',
            {
              key: t.id,
              className: `pointer-events-auto px-4 py-2.5 rounded-xl text-[11px] font-medium shadow-lg border transition-all animate-[fadeSlideUp_0.2s_ease-out] ${
                t.variant === 'error'
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`,
            },
            t.message,
          ),
        ),
      ),
  );
}
