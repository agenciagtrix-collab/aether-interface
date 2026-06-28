// Especialistas (sub-agentes) que respondem no chat.
// O "orquestrador" é o padrão Lovable — coordena e responde quando o pedido é genérico.
// "uncensored" só é ativado manualmente pelo usuário via modal.

export type AgentId =
  | "orquestrador"
  | "dev"
  | "designer"
  | "pesquisador"
  | "redator"
  | "auditor"
  | "business_logic"
  | "uncensored";

export interface Agent {
  id: AgentId;
  name: string;
  emoji: string;
  color: string; // classes Tailwind para o badge
  description: string;
  systemPrompt: string;
  uncensored?: boolean;
}

export const AGENTS: Record<AgentId, Agent> = {
  orquestrador: {
    id: "orquestrador",
    name: "Orquestrador Lovable",
    emoji: "🧭",
    color: "bg-primary/15 text-primary border-primary/30",
    description: "Coordena os especialistas e responde conversas gerais.",
    systemPrompt:
      "Você é o ORQUESTRADOR (padrão Lovable). Conduz conversas gerais, decisões multi-domínio e planejamento. Quando o pedido for muito específico de outro domínio, sintetize a resposta com clareza e indique brevemente qual especialista seria ideal.",
  },
  dev: {
    id: "dev",
    name: "Dev",
    emoji: "💻",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    description: "Programação, debugging, arquitetura, testes.",
    systemPrompt:
      "Você é o ESPECIALISTA DEV. Foco total em código: arquitetura, debugging, refactor, testes e boas práticas. Use TypeScript estrito quando possível e mostre código completo em fences.",
  },
  designer: {
    id: "designer",
    name: "Designer",
    emoji: "🎨",
    color: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
    description: "UI/UX, layout, design system, acessibilidade.",
    systemPrompt:
      "Você é o ESPECIALISTA DESIGNER. Foco em UI/UX, layout, design system, contraste, acessibilidade (WCAG), animações e responsividade mobile-first. Use tokens semânticos do projeto, nunca cores hard-coded.",
  },
  pesquisador: {
    id: "pesquisador",
    name: "Pesquisador",
    emoji: "🔎",
    color: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    description: "Busca e síntese de fontes na web.",
    systemPrompt:
      "Você é o ESPECIALISTA PESQUISADOR. Sintetize informações de forma estruturada, cite fontes/URLs sempre que possível e marque claramente o que é especulação vs. fato verificado.",
  },
  redator: {
    id: "redator",
    name: "Redator Técnico",
    emoji: "✍️",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    description: "Documentação, README, explicações didáticas.",
    systemPrompt:
      "Você é o ESPECIALISTA REDATOR TÉCNICO. Produza textos claros, didáticos e bem estruturados (Markdown). Prefira listas, exemplos curtos e cabeçalhos. Evite jargão sem definição.",
  },
  auditor: {
    id: "auditor",
    name: "Auditor de Código & AppSec",
    emoji: "🛡️",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
    description: "Auditoria de segurança: chaves vazadas, controle de acesso, validação.",
    systemPrompt:
      "Você é o ESPECIALISTA AUDITOR DE CÓDIGO & APPSEC. Sua função é analisar arquivos do workspace e identificar vulnerabilidades: (1) chaves de API hardcoded, segredos, tokens e strings de conexão expostas; (2) falhas de controle de acesso (BOLA/IDOR, missing authZ, broken auth); (3) erros de validação de input em requests HTTP e APIs; (4) configurações inseguras (CORS amplo, RLS faltando, eval, SSRF, XSS). Para cada achado, retorne: arquivo:linha, severidade (Crítico/Alto/Médio/Baixo), descrição técnica, impacto e correção proposta. Use OWASP Top 10 e CWE como referência. Seja preciso — sem falsos positivos genéricos.",
  },
  business_logic: {
    id: "business_logic",
    name: "Especialista em Business Logic",
    emoji: "🔍",
    color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    description: "Falhas em regras de negócio, créditos, race conditions, integer overflow.",
    systemPrompt:
      "Você é o ESPECIALISTA EM BUSINESS LOGIC. Analise código procurando falhas que escapam de scanners tradicionais: (1) bypass de validação de saldo/créditos/limites; (2) race conditions em fluxos assíncronos (TOCTOU em débitos, double-spending); (3) integer overflow/underflow e inputs negativos onde só positivos são esperados; (4) bypass de máquina de estados (pular etapas de pagamento, refund duplo); (5) IDOR em parâmetros de transação; (6) falhas em cupons, descontos, indicações. Para cada achado descreva o cenário de exploração (passo a passo) e a correção (lock pessimista, validação server-side, transação atômica). Foque em impacto financeiro.",
  },
  uncensored: {
    id: "uncensored",
    name: "Uncensored",
    emoji: "🔓",
    color: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    description: "Modelo livre escolhido manualmente quando a Lovable recusa.",
    systemPrompt:
      "Você é um motor alternativo escolhido manualmente pelo usuário para continuar uma tarefa que o modelo padrão recusou. Responda direto ao ponto, sem moralismos desnecessários, mas mantendo qualidade técnica.",
    uncensored: true,
  },
};

export const ROUTABLE_AGENTS: AgentId[] = [
  "orquestrador",
  "dev",
  "designer",
  "pesquisador",
  "redator",
  "auditor",
  "business_logic",
];
