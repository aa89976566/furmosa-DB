import * as React from "react";
import { cn } from "@/lib/utils";
import { sectionToneStyles, type SectionTone } from "@/lib/section-tone";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: SectionTone;
  compact?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  tone,
  compact = false,
}: PageHeaderProps) {
  const styles = tone ? sectionToneStyles[tone] : null;

  return (
    <div
      className={cn(
        "border-b-2 border-foreground bg-card px-4 sm:px-6",
        compact ? "py-3 sm:py-4" : "py-3 sm:py-6 md:py-7",
        tone && "border-l-4",
        tone && styles?.cardBorder,
      )}
    >
      <div className={cn(
        "flex gap-4",
        compact ? "flex-row items-center justify-between" : "flex-col md:flex-row md:items-end md:justify-between",
      )}>
        <div className={compact ? "space-y-0.5" : "space-y-2"}>
          {styles?.label !== title ? (
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.14em]",
                styles?.eyebrow ?? "text-primary",
              )}
            >
              {styles?.label ?? "Furmosa HQ"}
            </p>
          ) : null}
          <h1 className={cn(
            "font-semibold tracking-tight text-navy",
            compact ? "text-xl sm:text-2xl" : "text-2xl md:text-3xl",
          )}>
            {title}
          </h1>
          {description ? (
            <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
