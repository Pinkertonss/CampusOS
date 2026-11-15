import * as React from "react";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "primary";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]",
  primary:
    "bg-[var(--accent-badge-bg)] text-[var(--accent-badge-text)] border-[var(--accent-badge-border)]",
  success:
    "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  warning:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  danger:
    "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
  info:
    "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
};

const dotStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--text-muted)]",
  primary: "bg-[var(--action-primary)]",
  success: "bg-emerald-600 dark:bg-emerald-400",
  warning: "bg-amber-600 dark:bg-amber-400",
  danger: "bg-rose-600 dark:bg-rose-400",
  info: "bg-slate-600 dark:bg-slate-400",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "text-[11px] px-2 py-0.5 rounded-full gap-1",
  md: "text-xs px-2.5 py-1 rounded-full gap-1.5",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className = "",
      variant = "default",
      size = "sm",
      dot = false,
      icon,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={`inline-flex items-center font-medium border leading-none shrink-0 tracking-wide select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {dot && (
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles[variant]}`}
            aria-hidden="true"
          />
        )}
        {icon && (
          <span className="shrink-0 inline-flex items-center" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export default Badge;
