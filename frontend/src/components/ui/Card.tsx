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
        className={`bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200/80 dark:border-slate-700/70 shadow-sm transition-all duration-200 ${
          isHoverable
            ? "hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-600"
            : ""
        } ${className}`}
        {...props}
      >
        {hasStructuredHeader && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/60">
            {header}
            {title && (
              <h3 className="text-base font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        )}

        <div className={paddingStyles[padding]}>{children}</div>

        {footer && (
          <div className="px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/60 rounded-b-xl flex items-center justify-between gap-3">
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
    className={`px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 flex flex-col gap-1.5 ${className}`}
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
    className={`text-base font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100 ${className}`}
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
    className={`text-sm text-slate-500 dark:text-slate-400 ${className}`}
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
    className={`px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/60 rounded-b-xl flex items-center gap-3 ${className}`}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export default Card;
