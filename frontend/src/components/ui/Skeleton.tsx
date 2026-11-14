import * as React from "react";

export type SkeletonVariant = "text" | "card" | "avatar" | "table";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
  rows?: number;
  columns?: number;
  shimmer?: boolean;
}

const ShimmerOverlay = () => (
  <div
    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-[shimmer_2s_infinite]"
    aria-hidden="true"
  />
);

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className = "",
      variant,
      width,
      height,
      lines = 3,
      rows = 4,
      columns = 4,
      shimmer = true,
      style,
      ...props
    },
    ref
  ) => {
    const inlineStyle: React.CSSProperties = {
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...style,
    };

    // Text variant (can render multiple lines)
    if (variant === "text") {
      if (lines > 1) {
        return (
          <div
            ref={ref}
            className={`flex flex-col gap-2.5 w-full ${className}`}
            style={inlineStyle}
            aria-busy="true"
            aria-live="polite"
            {...props}
          >
            {Array.from({ length: lines }).map((_, index) => {
              const isLast = index === lines - 1;
              return (
                <div
                  key={index}
                  className={`h-4 bg-slate-200 dark:bg-slate-700/60 rounded-md relative overflow-hidden ${
                    isLast ? "w-3/4" : "w-full"
                  }`}
                >
                  {shimmer && <ShimmerOverlay />}
                </div>
              );
            })}
          </div>
        );
      }

      return (
        <div
          ref={ref}
          className={`h-4 w-full bg-slate-200 dark:bg-slate-700/60 rounded-md relative overflow-hidden ${className}`}
          style={inlineStyle}
          aria-busy="true"
          aria-live="polite"
          {...props}
        >
          {shimmer && <ShimmerOverlay />}
        </div>
      );
    }

    // Avatar variant (circle)
    if (variant === "avatar") {
      return (
        <div
          ref={ref}
          className={`w-10 h-10 rounded-full shrink-0 bg-slate-200 dark:bg-slate-700/60 relative overflow-hidden ${className}`}
          style={inlineStyle}
          aria-busy="true"
          aria-live="polite"
          {...props}
        >
          {shimmer && <ShimmerOverlay />}
        </div>
      );
    }

    // Card variant (rectangle with optional content layout)
    if (variant === "card") {
      return (
        <div
          ref={ref}
          className={`w-full rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4 ${className}`}
          style={inlineStyle}
          aria-busy="true"
          aria-live="polite"
          {...props}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700/60 relative overflow-hidden shrink-0">
              {shimmer && <ShimmerOverlay />}
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700/60 rounded relative overflow-hidden">
                {shimmer && <ShimmerOverlay />}
              </div>
              <div className="h-3 w-1/4 bg-slate-200 dark:bg-slate-700/60 rounded relative overflow-hidden">
                {shimmer && <ShimmerOverlay />}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-700/60 rounded relative overflow-hidden">
              {shimmer && <ShimmerOverlay />}
            </div>
            <div className="h-3.5 w-5/6 bg-slate-200 dark:bg-slate-700/60 rounded relative overflow-hidden">
              {shimmer && <ShimmerOverlay />}
            </div>
            <div className="h-3.5 w-2/3 bg-slate-200 dark:bg-slate-700/60 rounded relative overflow-hidden">
              {shimmer && <ShimmerOverlay />}
            </div>
          </div>
        </div>
      );
    }

    // Table variant (multiple rows)
    if (variant === "table") {
      return (
        <div
          ref={ref}
          className={`w-full rounded-xl border border-slate-200/80 dark:border-slate-700/70 overflow-hidden bg-white dark:bg-slate-800 ${className}`}
          style={inlineStyle}
          aria-busy="true"
          aria-live="polite"
          {...props}
        >
          {/* Table Header */}
          <div className="grid gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/70"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, cIdx) => (
              <div
                key={`th-${cIdx}`}
                className="h-3.5 w-3/4 bg-slate-300/80 dark:bg-slate-700 rounded relative overflow-hidden"
              >
                {shimmer && <ShimmerOverlay />}
              </div>
            ))}
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <div
                key={`tr-${rIdx}`}
                className="grid gap-4 px-4 py-3.5 items-center"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: columns }).map((_, cIdx) => (
                  <div
                    key={`td-${rIdx}-${cIdx}`}
                    className={`h-3 bg-slate-200 dark:bg-slate-700/60 rounded relative overflow-hidden ${
                      cIdx === 0 ? "w-4/5" : cIdx === columns - 1 ? "w-1/2" : "w-3/5"
                    }`}
                  >
                    {shimmer && <ShimmerOverlay />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Default primitive rectangle skeleton
    return (
      <div
        ref={ref}
        className={`bg-slate-200 dark:bg-slate-700/60 rounded-md relative overflow-hidden ${className}`}
        style={inlineStyle}
        aria-busy="true"
        aria-live="polite"
        {...props}
      >
        {shimmer && <ShimmerOverlay />}
      </div>
    );
  }
);

Skeleton.displayName = "Skeleton";

export default Skeleton;
