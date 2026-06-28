import { Check, Loader2, Circle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TerminalStep as Step } from "./PanelContext";

export function TerminalStepRow({ step, index }: { step: Step; index: number }) {
  const Icon =
    step.status === "done"
      ? Check
      : step.status === "running"
        ? Loader2
        : step.status === "error"
          ? AlertTriangle
          : Circle;

  const color =
    step.status === "done"
      ? "text-[var(--status-online)]"
      : step.status === "running"
        ? "text-primary"
        : step.status === "error"
          ? "text-[var(--status-offline)]"
          : "text-muted-foreground";

  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <Icon className={cn("h-4 w-4", color, step.status === "running" && "animate-spin")} />
      </div>
      <div className="flex-1 font-mono text-xs leading-relaxed">
        <div className="flex items-baseline gap-2">
          <span className="text-muted-foreground">
            [{String(index + 1).padStart(2, "0")}]
          </span>
          <span className={cn("font-medium", color)}>{step.label}</span>
        </div>
        {step.detail && (
          <p className="mt-1 text-muted-foreground whitespace-pre-wrap pl-1 border-l border-border ml-1 pl-3">
            {step.detail}
          </p>
        )}
      </div>
    </div>
  );
}
