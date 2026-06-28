import { ModeSwitcher } from "./ModeSwitcher";
import { MessageList } from "./MessageList";
import { InputBox } from "./InputBox";
import { usePanel, type TerminalStep } from "./PanelContext";
import {
  callChatCompletion,
  webSearch,
  type ChatMessage,
} from "@/lib/ai-clients";

const uid = () => crypto.randomUUID();

export function ChatView() {
  const panel = usePanel();

  const buildHistory = (extra: ChatMessage[] = []): ChatMessage[] => {
    const history: ChatMessage[] = panel.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    return [...history, ...extra];
  };

  const pushStep = (step: Omit<TerminalStep, "id" | "timestamp">) => {
    const full: TerminalStep = { ...step, id: uid(), timestamp: Date.now() };
    panel.setTerminalSteps((prev) => [...prev, full]);
    return full.id;
  };

  const updateStep = (id: string, patch: Partial<TerminalStep>) => {
    panel.setTerminalSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  };

  const runChat = async (text: string) => {
    try {
      const reply = await callChatCompletion(
        buildHistory([{ role: "user", content: text }]),
      );
      panel.addMessage({ role: "assistant", mode: "chat", content: reply });
    } catch (err: any) {
      panel.addMessage({
        role: "assistant",
        mode: "chat",
        content: `❌ Erro: ${err?.message ?? String(err)}`,
      });
    }
  };

  const runAgent = async (text: string) => {
    panel.clearTerminal();
    try {
      // 1) Plano
      const planStep = pushStep({ status: "running", label: "Analisando a missão e gerando plano..." });
      const plan = await callChatCompletion([
        {
          role: "system",
          content:
            "Você é um agente autônomo. Receba uma missão do usuário e responda APENAS com uma lista numerada curta (3 a 6 passos) descrevendo como executá-la. Sem preâmbulo.",
        },
        { role: "user", content: text },
      ]);
      updateStep(planStep, { status: "done", detail: plan });

      // 2) Busca web (opcional)
      let searchContext = "";
      if (panel.webSearchEnabled) {
        const sId = pushStep({
          status: "running",
          label: "Pesquisando na web em tempo real...",
          detail: `query: ${text.slice(0, 120)}`,
        });
        try {
          const results = await webSearch(text, { maxResults: 5 });
          searchContext = results
            .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
            .join("\n\n");
          updateStep(sId, {
            status: "done",
            detail: results.length
              ? results.map((r) => `• ${r.title} — ${r.url}`).join("\n")
              : "Sem resultados.",
          });
        } catch (err: any) {
          updateStep(sId, { status: "error", detail: err?.message ?? String(err) });
        }
      }

      if (panel.attachedFiles.length > 0) {
        pushStep({
          status: "done",
          label: "Anexos registrados (somente nomes nesta versão)",
          detail: panel.attachedFiles.join(", "),
        });
      }

      // 3) Execução / síntese
      const execStep = pushStep({ status: "running", label: "Executando raciocínio e sintetizando resposta..." });
      const systemPrompt =
        "Você é um agente autônomo de alta performance. Execute a missão do usuário seguindo o plano. " +
        "Seja claro, objetivo e responda em português." +
        (searchContext
          ? `\n\nResultados de pesquisa web disponíveis:\n${searchContext}\n\nUse-os como fonte quando relevante e cite a URL.`
          : "");

      const finalAnswer = await callChatCompletion([
        { role: "system", content: systemPrompt },
        ...buildHistory(),
        { role: "user", content: `Missão: ${text}\n\nPlano sugerido:\n${plan}\n\nExecute agora e entregue a resposta final.` },
      ]);
      updateStep(execStep, { status: "done" });

      pushStep({ status: "done", label: "Missão concluída." });

      panel.addMessage({ role: "assistant", mode: "agent", content: finalAnswer });
    } catch (err: any) {
      panel.setTerminalSteps((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.status === "running") {
          return prev.map((s, i) =>
            i === prev.length - 1 ? { ...s, status: "error", detail: err?.message ?? String(err) } : s,
          );
        }
        return [
          ...prev,
          {
            id: uid(),
            status: "error",
            label: "Falha na execução",
            detail: err?.message ?? String(err),
            timestamp: Date.now(),
          },
        ];
      });
      panel.addMessage({
        role: "assistant",
        mode: "agent",
        content: `❌ Erro: ${err?.message ?? String(err)}`,
      });
    }
  };

  const handleSubmit = async (text: string) => {
    if (!text.trim() || panel.isRunning) return;
    panel.addMessage({ role: "user", content: text, mode: panel.mode });
    panel.setRunning(true);
    try {
      if (panel.mode === "agent") await runAgent(text);
      else await runChat(text);
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
