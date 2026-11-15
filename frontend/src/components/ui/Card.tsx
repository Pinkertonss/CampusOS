import * as React from "react";

export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  padding?: CardPadding;
  hover?: boolean;
  hoverEffect?: boolean;
}

const paddingStyles: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-6",
  lg: "p-6 sm:p-8",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className = "",
      header,
      footer,
      title,
      description,
      padding = "md",
      hover = false,
      hoverEffect = false,
      children,
      ...props
    },
    ref
  ) => {
    const isHoverable = hover || hoverEffect;
    const hasStructuredHeader = header || title || description;

    return (
      <div
        ref={ref}
        className={`bg-[var(--surface-card)] text-[var(--text-primary)] rounded-xl border border-[var(--border-color)] shadow-xs transition-all duration-150 ${
          isHoverable
            ? "hover:border-[var(--text-muted)]/40 hover:shadow-sm"
            : ""
        } ${className}`}
        {...props}
      >
        {hasStructuredHeader && (
          <div className="px-5 py-4 border-b border-[var(--border-color)]">
            {header}
            {title && (
              <h3 className="text-base font-semibold leading-none tracking-tight text-[var(--text-primary)]">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                {description}
              </p>
            )}
          </div>
        )}

        <div className={paddingStyles[padding]}>{children}</div>

        {footer && (
          <div className="px-5 py-3.5 bg-[var(--surface-secondary)] border-t border-[var(--border-color)] rounded-b-xl flex items-center justify-between gap-3">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`px-5 py-4 border-b border-[var(--border-color)] flex flex-col gap-1.5 ${className}`}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className = "", ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-base font-semibold leading-none tracking-tight text-[var(--text-primary)] ${className}`}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", ...props }, ref) => (
  <p
    ref={ref}
    className={`text-sm text-[var(--text-secondary)] ${className}`}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div ref={ref} className={`p-5 sm:p-6 ${className}`} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`px-5 py-3.5 bg-[var(--surface-secondary)] border-t border-[var(--border-color)] rounded-b-xl flex items-center gap-3 ${className}`}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export default Card;
