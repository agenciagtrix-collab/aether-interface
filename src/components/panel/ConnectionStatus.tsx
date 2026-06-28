import { useSettings, isConnected } from "@/hooks/use-settings";
import { usePanel } from "./PanelContext";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const { settings } = useSettings();
  const { setActiveTab } = usePanel();
  const connected = isConnected(settings);

  const label = connected
    ? `Conectado · ${settings.provider === "groq" ? "GroqCloud" : "OpenRouter"}`
    : "Sem credenciais";

  return (
    <button
      onClick={() => setActiveTab("settings")}
      className="flex w-full items-center gap-3 rounded-md border border-sidebar-border bg-surface-2/50 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-2"
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full pulse-dot",
          connected ? "bg-[var(--status-online)] text-[var(--status-online)]" : "bg-[var(--status-offline)] text-[var(--status-offline)]",
        )}
      />
      <div className="flex flex-1 flex-col leading-tight">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground truncate">
          {connected ? settings.model : "Abrir configurações"}
        </span>
      </div>
    </button>
  );
}
