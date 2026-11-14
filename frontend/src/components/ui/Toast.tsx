"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: React.ReactNode;
  description?: React.ReactNode;
  duration?: number;
}

export interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  type?: ToastType;
  duration?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  toast: {
    (options: ToastOptions | string): string;
    success: (
      title: React.ReactNode,
      options?: Omit<ToastOptions, "title" | "type">
    ) => string;
    error: (
      title: React.ReactNode,
      options?: Omit<ToastOptions, "title" | "type">
    ) => string;
    info: (
      title: React.ReactNode,
      options?: Omit<ToastOptions, "title" | "type">
    ) => string;
    warning: (
      title: React.ReactNode,
      options?: Omit<ToastOptions, "title" | "type">
    ) => string;
    dismiss: (id: string) => void;
    clear: () => void;
  };
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined
);

const typeConfig: Record<
  ToastType,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    border: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200/80 dark:border-emerald-800/60",
  },
  error: {
    icon: AlertCircle,
    iconColor: "text-red-600 dark:text-red-400",
    border: "border-red-200/80 dark:border-red-800/60",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200/80 dark:border-amber-800/60",
  },
  info: {
    icon: Info,
    iconColor: "text-primary-600 dark:text-primary-400",
    border: "border-primary-200/80 dark:border-primary-800/60",
  },
};

export interface ToastProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ item, onDismiss }) => {
  const { icon: Icon, iconColor, border } = typeConfig[item.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/10 text-slate-900 dark:text-slate-100 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${border}`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
          {item.title}
        </h4>
        {item.description && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {item.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer -mr-1 -mt-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = React.useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = React.useCallback(
    (options: ToastOptions | string): string => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 9);

      const parsed: ToastItem =
        typeof options === "string"
          ? { id, title: options, type: "info", duration: 4000 }
          : {
              id,
              title: options.title || "",
              description: options.description,
              type: options.type || "info",
              duration: options.duration !== undefined ? options.duration : 4000,
            };

      setToasts((prev) => [...prev, parsed]);

      if (parsed.duration && parsed.duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, parsed.duration);
      }

      return id;
    },
    [dismiss]
  );

  const toastMethods = React.useMemo(() => {
    const fn = (options: ToastOptions | string) => addToast(options);

    fn.success = (
      title: React.ReactNode,
      options?: Omit<ToastOptions, "title" | "type">
    ) => addToast({ ...options, title, type: "success" });

    fn.error = (
      title: React.ReactNode,
      options?: Omit<ToastOptions, "title" | "type">
    ) => addToast({ ...options, title, type: "error" });

    fn.info = (
      title: React.ReactNode,
      options?: Omit<ToastOptions, "title" | "type">
    ) => addToast({ ...options, title, type: "info" });

    fn.warning = (
      title: React.ReactNode,
      options?: Omit<ToastOptions, "title" | "type">
    ) => addToast({ ...options, title, type: "warning" });

    fn.dismiss = dismiss;
    fn.clear = clear;

    return fn;
  }, [addToast, dismiss, clear]);

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toasts,
      toast: toastMethods,
      dismiss,
      clear,
    }),
    [toasts, toastMethods, dismiss, clear]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            aria-atomic="true"
            className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-4 sm:p-0"
          >
            {toasts.map((item) => (
              <Toast key={item.id} item={item} onDismiss={dismiss} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export default ToastProvider;
