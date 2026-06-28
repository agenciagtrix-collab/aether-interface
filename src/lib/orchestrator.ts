import { callChatCompletion } from "./ai-clients";
import { AGENTS, ROUTABLE_AGENTS, type AgentId } from "./agents";

/** Frases típicas de recusa em PT / EN. */
const REFUSAL_PATTERNS: RegExp[] = [
  /n[ãa]o posso (te )?(ajudar|fazer|fornecer|gerar)/i,
  /n[ãa]o consigo (ajudar|fazer|fornecer)/i,
  /(desculpe|sinto muito).{0,40}(n[ãa]o)/i,
  /n[ãa]o (irei|vou) (ajudar|fornecer|gerar)/i,
  /viola (as |a |minhas |as minhas )?(diretrizes|pol[ií]ticas|regras)/i,
  /pol[ií]tica de uso/i,
  /i\s?can(?:'|no)?t (help|assist|do that|provide|comply|generate)/i,
  /i(?:'|\s+a)m (sorry|unable|not able)/i,
  /against (my|our|the) (guidelines|policy|policies|values|rules)/i,
  /not able to (help|assist|provide|comply|generate)/i,
  /i (won'?t|will not) (help|assist|provide|generate)/i,
  /unsafe|harmful content|cannot fulfill/i,
];

export function isRefusal(text: string): boolean {
  const t = text.trim();
  if (t.length < 15) return false;
  const head = t.slice(0, 800);
  return REFUSAL_PATTERNS.some((re) => re.test(head));
}

/** Pergunta ao próprio LLM qual especialista deve responder. Retorna "orquestrador" em caso de falha. */
export async function routeToAgent(userText: string): Promise<AgentId> {
  try {
    const raw = await callChatCompletion(
      [
        {
          role: "system",
          content:
            "Você é um roteador de especialistas. Classifique a mensagem do usuário em UM destes IDs e responda APENAS com o ID, sem mais nenhuma palavra ou pontuação:\n" +
            "- dev — programação, código, bugs, arquitetura, testes, devops\n" +
            "- designer — UI, UX, layout, CSS, cores, acessibilidade\n" +
            "- pesquisador — precisa buscar/citar informação atualizada ou fontes\n" +
            "- redator — documentação, README, textos, explicações didáticas\n" +
            "- orquestrador — conversa geral, planejamento, decisão multi-domínio",
        },
        { role: "user", content: userText.slice(0, 4000) },
      ],
      { temperature: 0 },
    );
    const id = raw.trim().toLowerCase().replace(/[^a-z]/g, "");
    if ((ROUTABLE_AGENTS as string[]).includes(id)) return id as AgentId;
    return "orquestrador";
  } catch {
    return "orquestrador";
  }
}

export function getAgent(id: AgentId) {
  return AGENTS[id];
}
