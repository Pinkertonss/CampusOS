import * as React from "react";
import Button from "./Button";

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  icon?: React.ReactNode;
}

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode | EmptyStateAction;
  compact?: boolean;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className = "",
      icon,
      title,
      description,
      action,
      compact = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`flex flex-col items-center justify-center text-center select-none ${
          compact ? "p-4 sm:p-6" : "p-8 sm:p-12"
        } ${className}`}
        {...props}
      >
        {icon && (
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center justify-center mb-4 shadow-xs">
            {React.isValidElement(icon) ? (
              React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
                className: `w-7 h-7 ${(icon as React.ReactElement<{ className?: string }>).props.className || ""}`,
              })
            ) : (
              icon
            )}
          </div>
        )}

        <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
          {title}
        </h3>

        {description && (
          <p className="mt-1.5 text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed">
            {description}
          </p>
        )}

        {action && (
          <div className="mt-6 flex items-center justify-center gap-3">
            {React.isValidElement(action) ? (
              action
            ) : typeof action === "object" && "label" in action ? (
              action.href ? (
                <a href={action.href}>
                  <Button
                    variant={action.variant || "primary"}
                    size="sm"
                    leftIcon={action.icon}
                  >
                    {action.label}
                  </Button>
                </a>
              ) : (
                <Button
                  variant={action.variant || "primary"}
                  size="sm"
                  onClick={action.onClick}
                  leftIcon={action.icon}
                >
                  {action.label}
                </Button>
              )
            ) : null}
          </div>
        )}

        {children && <div className="mt-6 w-full">{children}</div>}
      </div>
    );
  }
);

EmptyState.displayName = "EmptyState";

export default EmptyState;
