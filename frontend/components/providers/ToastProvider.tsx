"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastTone = "info" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const toneClasses: Record<ToastTone, string> = {
  info: "border-white/10 text-fog-100",
  success: "border-emerald-400/40 text-emerald-400",
  error: "border-rose-500/40 text-rose-400",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-24 right-4 z-[95] flex w-[min(92vw,360px)] flex-col gap-2 md:bottom-8"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`glass animate-rise pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] ${toneClasses[item.tone]}`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
