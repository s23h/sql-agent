import type { PropsWithChildren, ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";

import { cn } from "../../../lib/utils";

type ToolSummaryProps = PropsWithChildren<{
  isOpen: boolean;
  onToggle?: () => void;
  status?: ReactNode;
  resultSummary?: string;
}>;

export function ToolSummary({
  children,
  isOpen,
  onToggle,
  status,
  resultSummary,
}: ToolSummaryProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-2",
        onToggle && "cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded"
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-2">
        {onToggle && (
          <ChevronRightIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform flex-shrink-0",
              isOpen && "rotate-90"
            )}
          />
        )}
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          {children}
        </span>
        {status}
      </div>
      {resultSummary && (
        <span className="text-sm text-muted-foreground flex-shrink-0">
          {resultSummary}
        </span>
      )}
    </div>
  );
}
