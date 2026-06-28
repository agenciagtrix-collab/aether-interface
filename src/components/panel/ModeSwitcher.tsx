import { MessageCircle, Sparkles } from "lucide-react";
import { usePanel, type ChatMode } from "./PanelContext";
import { cn } from "@/lib/utils";

const OPTIONS: { id: ChatMode; label: string; icon: typeof MessageCircle }[] = [
  { id: "chat", label: "Conversação", icon: MessageCircle },
  { id: "agent", label: "Agente Autônomo", icon: Sparkles },
];

export function ModeSwitcher() {
  const { mode, setMode } = usePanel();

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2/80 p-1 backdrop-blur-md shadow-lg">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => setMode(opt.id)}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-300",
              active
                ? "bg-primary text-primary-foreground shadow-[0_0_20px_-4px_var(--cyber)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
