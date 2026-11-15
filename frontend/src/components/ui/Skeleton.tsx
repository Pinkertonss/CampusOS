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
  rounded?: "none" | "sm" | "md" | "lg" | "full";
}

const roundedStyles = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

export const SkeletonShimmer: React.FC = () => (
  <div
    className="absolute inset-0 bg-[var(--surface-secondary)]/60 animate-pulse"
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
      rounded = "md",
      style,
      ...props
    },
    ref
  ) => {
    const inlineStyle: React.CSSProperties = {
      ...(width !== undefined ? { width: typeof width === "number" ? `${width}px` : width } : {}),
      ...(height !== undefined ? { height: typeof height === "number" ? `${height}px` : height } : {}),
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
                  className={`h-4 bg-[var(--surface-secondary)] rounded-md relative overflow-hidden ${
                    isLast ? "w-3/4" : "w-full"
                  }`}
                >
                  {shimmer && <SkeletonShimmer />}
                </div>
              );
            })}
          </div>
        );
      }

      return (
        <div
          ref={ref}
          className={`h-4 w-full bg-[var(--surface-secondary)] rounded-md relative overflow-hidden ${className}`}
          style={inlineStyle}
          aria-busy="true"
          aria-live="polite"
          {...props}
        >
          {shimmer && <SkeletonShimmer />}
        </div>
      );
    }

    // Avatar variant (circle)
    if (variant === "avatar") {
      return (
        <div
          ref={ref}
          className={`w-10 h-10 rounded-full shrink-0 bg-[var(--surface-secondary)] relative overflow-hidden ${className}`}
          style={inlineStyle}
          aria-busy="true"
          aria-live="polite"
          {...props}
        >
          {shimmer && <SkeletonShimmer />}
        </div>
      );
    }

    // Card variant (rectangle with optional content layout)
    if (variant === "card") {
      return (
        <div
          ref={ref}
          className={`w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] p-5 shadow-xs space-y-4 ${className}`}
          style={inlineStyle}
          aria-busy="true"
          aria-live="polite"
          {...props}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--surface-secondary)] relative overflow-hidden shrink-0">
              {shimmer && <SkeletonShimmer />}
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-1/3 bg-[var(--surface-secondary)] rounded relative overflow-hidden">
                {shimmer && <SkeletonShimmer />}
              </div>
              <div className="h-3 w-1/4 bg-[var(--surface-secondary)] rounded relative overflow-hidden">
                {shimmer && <SkeletonShimmer />}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3.5 w-full bg-[var(--surface-secondary)] rounded relative overflow-hidden">
              {shimmer && <SkeletonShimmer />}
            </div>
            <div className="h-3.5 w-5/6 bg-[var(--surface-secondary)] rounded relative overflow-hidden">
              {shimmer && <SkeletonShimmer />}
            </div>
            <div className="h-3.5 w-2/3 bg-[var(--surface-secondary)] rounded relative overflow-hidden">
              {shimmer && <SkeletonShimmer />}
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
          className={`w-full rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--surface-card)] ${className}`}
          style={inlineStyle}
          aria-busy="true"
          aria-live="polite"
          {...props}
        >
          {/* Table Header */}
          <div
            className="grid gap-4 px-4 py-3 bg-[var(--surface-secondary)] border-b border-[var(--border-color)]"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, cIdx) => (
              <div
                key={`th-${cIdx}`}
                className="h-3.5 w-3/4 bg-[var(--surface-secondary)]/80 rounded relative overflow-hidden"
              >
                {shimmer && <SkeletonShimmer />}
              </div>
            ))}
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <div
                key={`tr-${rIdx}`}
                className="grid gap-4 px-4 py-3.5 items-center"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: columns }).map((_, cIdx) => (
                  <div
                    key={`td-${rIdx}-${cIdx}`}
                    className={`h-3 bg-[var(--surface-secondary)] rounded relative overflow-hidden ${
                      cIdx === 0 ? "w-4/5" : cIdx === columns - 1 ? "w-1/2" : "w-3/5"
                    }`}
                  >
                    {shimmer && <SkeletonShimmer />}
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
        className={`bg-[var(--surface-secondary)] ${roundedStyles[rounded]} relative overflow-hidden ${className}`}
        style={inlineStyle}
        aria-busy="true"
        aria-live="polite"
        {...props}
      >
        {shimmer && <SkeletonShimmer />}
      </div>
    );
  }
);

Skeleton.displayName = "Skeleton";

export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  gap?: string;
}> = ({ lines = 3, className = "", gap = "gap-2" }) => {
  return (
    <div className={`flex flex-col ${gap} ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={16}
          className={index === lines - 1 && lines > 1 ? "w-3/4" : "w-full"}
        />
      ))}
    </div>
  );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  return (
    <Skeleton variant="card" className={className} />
  );
};

export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 4, className = "" }) => {
  return (
    <Skeleton variant="table" rows={rows} columns={columns} className={className} />
  );
};

export default Skeleton;
