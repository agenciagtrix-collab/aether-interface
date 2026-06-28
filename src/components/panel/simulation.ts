import type { PanelTab } from "./PanelContext";

// Tipo mínimo do contexto necessário para a simulação
interface SimCtx {
  webSearchEnabled: boolean;
  attachedFiles: string[];
  addMessage: (m: { role: "assistant" | "system" | "user"; content: string; mode: "chat" | "agent" }) => void;
  setTerminalSteps: (s: any) => void;
  clearTerminal: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => crypto.randomUUID();

export async function runChatSimulation(text: string, ctx: SimCtx) {
  await sleep(600 + Math.random() * 400);
  ctx.addMessage({
    role: "assistant",
    mode: "chat",
    content:
      `Resposta simulada para: "${text}".\n\n` +
      "Esta é uma demonstração do Modo Conversação. Para gerar respostas reais, " +
      "preencha sua API key em Configurações e descomente as chamadas em src/lib/ai-clients.ts.",
  });
}

export async function runAgentSimulation(text: string, ctx: SimCtx) {
  ctx.clearTerminal();

  const baseSteps = [
    { label: "Analisando a missão recebida...", detail: `Missão: ${text}` },
    { label: "Decompondo em sub-tarefas executáveis..." },
    ...(ctx.webSearchEnabled
      ? [
          { label: "Pesquisando na web em tempo real...", detail: `query: "${text.slice(0, 80)}"` },
          { label: "Lendo e ranqueando 5 resultados..." },
        ]
      : []),
    ...(ctx.attachedFiles.length > 0
      ? [{ label: "Indexando anexos...", detail: ctx.attachedFiles.join(", ") }]
      : []),
    { label: "Executando raciocínio em cadeia..." },
    { label: "Validando consistência das respostas..." },
    { label: "Sintetizando resposta final..." },
  ];

  const ids = baseSteps.map(() => uid());

  // Inicializa todos como pending
  ctx.setTerminalSteps(
    baseSteps.map((s, i) => ({
      id: ids[i],
      label: s.label,
      detail: s.detail,
      status: "pending" as const,
      timestamp: Date.now(),
    })),
  );

  for (let i = 0; i < baseSteps.length; i++) {
    ctx.setTerminalSteps((prev: any[]) =>
      prev.map((p, idx) => (idx === i ? { ...p, status: "running" } : p)),
    );
    await sleep(500 + Math.random() * 600);
    ctx.setTerminalSteps((prev: any[]) =>
      prev.map((p, idx) => (idx === i ? { ...p, status: "done" } : p)),
    );
  }

  await sleep(300);
  ctx.addMessage({
    role: "assistant",
    mode: "agent",
    content:
      `Missão concluída: "${text}".\n\n` +
      `Etapas executadas: ${baseSteps.length}.\n` +
      `${ctx.webSearchEnabled ? "Pesquisa web foi utilizada nesta execução.\n" : ""}` +
      `${ctx.attachedFiles.length > 0 ? `Anexos processados: ${ctx.attachedFiles.length}.\n` : ""}` +
      "\nEsta é uma simulação local. Para conectar com OpenRouter/Groq + Tavily reais, " +
      "abra src/lib/ai-clients.ts e descomente as funções de fetch.",
  });
}

// Helper exportado para futuras integrações com navegação por aba
export const SETTINGS_TAB: PanelTab = "settings";
