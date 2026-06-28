import { useCallback, useState } from "react";
import { ModeSwitcher } from "./ModeSwitcher";
import { MessageList } from "./MessageList";
import { InputBox } from "./InputBox";
import { usePanel, type TerminalStep } from "./PanelContext";
import type { AttachedFile } from "./PanelContext";
import { buildAttachmentContext } from "@/lib/file-readers";
import { CodeContextBar } from "@/components/ide/CodeContextBar";
import {
  callChatCompletion,
  streamChatCompletion,
  webSearch,
  type ChatMessage,
  type OpenAIContentPart,
} from "@/lib/ai-clients";

const uid = () => crypto.randomUUID();

// extrai blocos <think>...</think> separando raciocínio da resposta final
function splitThinking(raw: string): { thinking: string; answer: string } {
  const re = /<think>([\s\S]*?)<\/think>/gi;
  const thinks: string[] = [];
  const answer = raw.replace(re, (_, inner) => {
    thinks.push(String(inner).trim());
    return "";
  }).trim();
  return { thinking: thinks.join("\n\n"), answer: answer || raw.trim() };
}

function buildUserContent(text: string, attachments: AttachedFile[]): ChatMessage["content"] {
  const attachmentContext = buildAttachmentContext(attachments);
  const contentText = attachmentContext
    ? `${text}\n\n[Contexto real dos arquivos anexados]\n${attachmentContext}`
    : text;
  const images = attachments.filter((file) => file.kind === "image" && file.dataUrl);

  if (images.length === 0) return contentText;

  return [
    { type: "text", text: contentText },
    ...images.map<OpenAIContentPart>((file) => ({
      type: "image_url",
      image_url: { url: file.dataUrl! },
    })),
  ];
}

export function ChatView() {
  const panel = usePanel();
  const [codeCtx, setCodeCtx] = useState("");
  const handleCodeCtx = useCallback((s: string) => setCodeCtx(s), []);

  const buildHistory = (extra: ChatMessage[] = []): ChatMessage[] => {
    const history: ChatMessage[] = panel.messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim().length > 0)
      .map((m) => {
        return {
          role: m.role as "user" | "assistant",
          content: m.role === "user" ? buildUserContent(m.content, m.attachments ?? []) : m.content,
        };
      });
    return [...history, ...extra];
  };

  const pushStep = (step: Omit<TerminalStep, "id" | "timestamp">) => {
    const full: TerminalStep = { ...step, id: uid(), timestamp: Date.now() };
    panel.setTerminalSteps((prev) => [...prev, full]);
    return full.id;
  };
  const updateStep = (id: string, patch: Partial<TerminalStep>) => {
    panel.setTerminalSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const REASONING_SYSTEM_BASE =
    "Você é um pair-programmer dentro de uma IDE (estilo VSCode) com acesso ao código do usuário. " +
    "Antes de responder, pense passo a passo dentro de um bloco <think>...</think> explicando seu raciocínio. " +
    "Depois, FORA do bloco, escreva a resposta final clara e em português. " +
    "Quando mostrar código, use Markdown com fences triplas indicando linguagem e, quando estiver alterando um arquivo do projeto, " +
    "use o formato ```lang:caminho/do/arquivo.tsx para o usuário poder aplicar a mudança.";

  const getReasoningSystem = () => {
    const custom = typeof window !== "undefined" ? (localStorage.getItem("jarvis_system_prompt") ?? "").trim() : "";
    return custom ? `${custom}\n\n---\n${REASONING_SYSTEM_BASE}` : REASONING_SYSTEM_BASE;
  };

  const runChat = async (
    text: string,
    attachments: AttachedFile[],
    opts: { modelOverride?: string; extraSystem?: string } = {},
  ) => {
    panel.setStatusText(opts.modelOverride ? "Reenviando para modelo uncensored" : "Pensando");
    const asstId = panel.addMessage({ role: "assistant", mode: "chat", content: "", streaming: true });

    const userTurn: ChatMessage = {
      role: "user",
      content: buildUserContent(text, attachments),
    };

    let buffer = "";
    let inThink = false;
    let thinkText = "";
    let answerText = "";

    const flush = (chunk: string) => {
      buffer += chunk;
      while (true) {
        if (!inThink) {
          const open = buffer.indexOf("<think>");
          if (open === -1) {
            answerText += buffer;
            buffer = "";
            break;
          }
          answerText += buffer.slice(0, open);
          buffer = buffer.slice(open + 7);
          inThink = true;
          panel.setStatusText("Raciocinando");
        } else {
          const close = buffer.indexOf("</think>");
          if (close === -1) {
            thinkText += buffer;
            buffer = "";
            break;
          }
          thinkText += buffer.slice(0, close);
          buffer = buffer.slice(close + 8);
          inThink = false;
          panel.setStatusText("Escrevendo resposta");
        }
      }
      panel.updateMessage(asstId, { content: answerText.trim(), thinking: thinkText.trim() });
    };

    try {
      await streamChatCompletion(
        [
          { role: "system", content: getReasoningSystem() + codeCtx + (opts.extraSystem ?? "") },
          ...buildHistory(),
          userTurn,
        ],
        { onDelta: flush, temperature: 0.7, modelOverride: opts.modelOverride },
      );

      if (buffer) answerText += buffer;
      const finalParsed = splitThinking((thinkText ? `<think>${thinkText}</think>` : "") + answerText);
      panel.updateMessage(asstId, {
        content: finalParsed.answer,
        thinking: finalParsed.thinking,
        streaming: false,
      });
    } catch (err: any) {
      panel.updateMessage(asstId, {
        content: `❌ Erro: ${err?.message ?? String(err)}`,
        streaming: false,
      });
    } finally {
      panel.setStatusText("");
    }
  };

  const resendWithUncensored = useCallback(
    async (assistantId: string) => {
      if (panel.isRunning) return;
      const idx = panel.messages.findIndex((m) => m.id === assistantId);
      if (idx < 0) return;
      // localiza a última mensagem do usuário antes deste assistant
      let userMsg: typeof panel.messages[number] | undefined;
      for (let i = idx - 1; i >= 0; i--) {
        if (panel.messages[i].role === "user") {
          userMsg = panel.messages[i];
          break;
        }
      }
      if (!userMsg) return;
      const uncensoredModel =
        (typeof window !== "undefined" && localStorage.getItem("jarvis_uncensored_model")) ||
        "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";
      panel.setRunning(true);
      try {
        await runChat(userMsg.content, userMsg.attachments ?? [], {
          modelOverride: uncensoredModel,
          extraSystem: "\n\n[Reenvio em motor alternativo escolhido pelo usuário]",
        });
      } finally {
        panel.setRunning(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel.messages, panel.isRunning, codeCtx],
  );

  const runAgent = async (text: string, attachments: AttachedFile[]) => {
    panel.clearTerminal();
    panel.setStatusText("Analisando missão");

    try {
      // 1) Plano
      const planStep = pushStep({ status: "running", label: "Analisando a missão e gerando plano..." });
      const plan = await callChatCompletion([
        {
          role: "system",
          content:
            "Você é um agente autônomo. Responda APENAS com uma lista numerada curta (3 a 6 passos) descrevendo como executar a missão. Sem preâmbulo.",
        },
        { role: "user", content: buildUserContent(text, attachments) },
      ]);
      updateStep(planStep, { status: "done", detail: plan });

      // 2) Busca web (opcional)
      let searchContext = "";
      if (panel.webSearchEnabled) {
        panel.setStatusText("Pesquisando na web");
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

      if (attachments.length > 0) {
        pushStep({
          status: "done",
          label: "Arquivos lidos e enviados ao modelo",
          detail: attachments.map((file) => `• ${file.name}: ${file.summary}`).join("\n"),
        });
      }

      // 3) Execução com streaming + raciocínio visível
      panel.setStatusText("Raciocinando e respondendo");
      const execStep = pushStep({ status: "running", label: "Raciocinando e sintetizando resposta..." });
      const asstId = panel.addMessage({ role: "assistant", mode: "agent", content: "", streaming: true });

      const systemPrompt =
        getReasoningSystem() +
        codeCtx +
        "\n\nVocê é um agente autônomo executando a missão do usuário seguindo o plano abaixo." +
        (searchContext
          ? `\n\nResultados de pesquisa web disponíveis (use e cite URLs quando relevante):\n${searchContext}`
          : "");

      let buffer = "";
      let inThink = false;
      let thinkText = "";
      let answerText = "";

      const flush = (chunk: string) => {
        buffer += chunk;
        while (true) {
          if (!inThink) {
            const open = buffer.indexOf("<think>");
            if (open === -1) { answerText += buffer; buffer = ""; break; }
            answerText += buffer.slice(0, open);
            buffer = buffer.slice(open + 7);
            inThink = true;
          } else {
            const close = buffer.indexOf("</think>");
            if (close === -1) { thinkText += buffer; buffer = ""; break; }
            thinkText += buffer.slice(0, close);
            buffer = buffer.slice(close + 8);
            inThink = false;
          }
        }
        panel.updateMessage(asstId, { content: answerText.trim(), thinking: thinkText.trim() });
        // espelha raciocínio no terminal lateral
        if (thinkText.trim()) {
          updateStep(execStep, { detail: thinkText.trim().slice(-600) });
        }
      };

      await streamChatCompletion(
        [
          { role: "system", content: systemPrompt },
          ...buildHistory(),
          {
            role: "user",
            content: buildUserContent(`Missão: ${text}\n\nPlano:\n${plan}\n\nExecute agora.`, attachments),
          },
        ],
        { onDelta: flush, temperature: 0.7 },
      );

      if (buffer) answerText += buffer;
      const finalParsed = splitThinking((thinkText ? `<think>${thinkText}</think>` : "") + answerText);
      panel.updateMessage(asstId, {
        content: finalParsed.answer,
        thinking: finalParsed.thinking,
        streaming: false,
      });
      updateStep(execStep, { status: "done" });
      pushStep({ status: "done", label: "Missão concluída." });
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
          { id: uid(), status: "error", label: "Falha na execução", detail: err?.message ?? String(err), timestamp: Date.now() },
        ];
      });
      panel.addMessage({
        role: "assistant",
        mode: "agent",
        content: `❌ Erro: ${err?.message ?? String(err)}`,
      });
    } finally {
      panel.setStatusText("");
    }
  };

  const handleSubmit = async (text: string) => {
    if (!text.trim() || panel.isRunning) return;
    const attachments = [...panel.attachedFiles];
    panel.addMessage({ role: "user", content: text, mode: panel.mode, attachments });
    panel.clearAttachedFiles();
    panel.setRunning(true);
    try {
      if (panel.mode === "agent") await runAgent(text, attachments);
      else await runChat(text, attachments);
    } finally {
      panel.setRunning(false);
    }
  };

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight">Chat</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {panel.mode === "agent" ? "Modo Agente · multi-etapas" : "Modo Conversação"}
          </p>
        </div>
        <ModeSwitcher />
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <MessageList onResendUncensored={resendWithUncensored} />
      </div>

      <CodeContextBar onContextChange={handleCodeCtx} />
      <InputBox onSubmit={handleSubmit} />
    </div>
  );
}
