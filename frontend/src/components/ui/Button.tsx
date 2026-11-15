"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--action-primary)] text-[var(--action-primary-text)] hover:bg-[var(--action-primary-hover)] active:bg-[var(--action-primary-active)] border border-transparent shadow-xs focus-visible:ring-[var(--focus-ring)]",
  secondary:
    "bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--surface-secondary)] active:bg-[var(--border-color)] shadow-xs focus-visible:ring-[var(--focus-ring)]",
  ghost:
    "bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] active:bg-[var(--border-color)] border border-transparent focus-visible:ring-[var(--focus-ring)]",
  danger:
    "bg-rose-700 text-white hover:bg-rose-800 active:bg-rose-900 border border-transparent shadow-xs focus-visible:ring-rose-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-xs px-2.5 py-1.5 h-8 rounded-lg gap-1.5",
  md: "text-sm px-4 py-2 h-10 rounded-lg gap-2",
  lg: "text-base px-5 py-2.5 h-11 rounded-xl gap-2.5",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled = false,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={`inline-flex items-center justify-center font-medium transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
          variantStyles[variant]
        } ${sizeStyles[size]} ${
          fullWidth ? "w-full" : ""
        } ${
          isDisabled
            ? "opacity-50 cursor-not-allowed pointer-events-none shadow-none"
            : "cursor-pointer"
        } ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="shrink-0 inline-flex items-center" aria-hidden="true">
                {leftIcon}
              </span>
            )}
            {children && <span>{children}</span>}
            {rightIcon && (
              <span className="shrink-0 inline-flex items-center" aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
