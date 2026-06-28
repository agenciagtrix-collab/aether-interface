import { ModeSwitcher } from "./ModeSwitcher";
import { MessageList } from "./MessageList";
import { InputBox } from "./InputBox";
import { usePanel } from "./PanelContext";
import { runAgentSimulation, runChatSimulation } from "./simulation";

export function ChatView() {
  const panel = usePanel();

  const handleSubmit = async (text: string) => {
    if (!text.trim() || panel.isRunning) return;
    panel.addMessage({ role: "user", content: text, mode: panel.mode });
    panel.setRunning(true);

    try {
      if (panel.mode === "agent") {
        await runAgentSimulation(text, panel);
      } else {
        await runChatSimulation(text, panel);
      }
    } finally {
      panel.setRunning(false);
      panel.clearAttachedFiles();
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Chat Principal</h1>
          <p className="text-xs text-muted-foreground">
            {panel.mode === "agent"
              ? "Modo Agente · raciocínio multi-etapas no terminal à direita"
              : "Modo Conversação · respostas diretas"}
          </p>
        </div>
        <ModeSwitcher />
      </header>

      <div className="flex-1 overflow-hidden">
        <MessageList />
      </div>

      <InputBox onSubmit={handleSubmit} />
    </div>
  );
}
