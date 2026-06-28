import { useState } from "react";
import { ShieldAlert, X, KeyRound, Scale, Coins, FileWarning } from "lucide-react";
import { usePanel } from "@/components/panel/PanelContext";
import { useWorkspace } from "./WorkspaceContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Painel flutuante "Casos de Teste & Auditoria".
 * Injeta prompts estruturados no InputBox via PanelContext.pendingPrompt.
 * Vive sobreposto à IDE — pode ser arrastado para fora do caminho.
 */

interface Template {
  id: string;
  label: string;
  icon: typeof KeyRound;
  agentHint: string;
  build: (workspaceName: string | null, fileCount: number) => string;
}

const TEMPLATES: Template[] = [
  {
    id: "business-logic",
    label: "Análise de Business Logic",
    icon: Scale,
    agentHint: "🔍 Especialista em Business Logic",
    build: (ws) =>
      `[Auditoria de Business Logic — ${ws ?? "workspace atual"}]\n\n` +
      `Analise os arquivos do workspace procurando falhas em regras de negócio. Foque em:\n\n` +
      `1. **Validação de saldo / créditos / limites** — rotas onde o cliente pode informar valores sem checagem server-side, débitos sem lock, comparações com tipos errados (string vs number).\n` +
      `2. **Contorno de limites** — endpoints de quota/rate sem verificação atômica, bypass por header/parâmetro, validação só no front.\n` +
      `3. **Race conditions em chamadas assíncronas** — TOCTOU em débito de saldo, double-spending, falta de transação/lock pessimista, idempotência ausente em webhooks.\n` +
      `4. **Bypass de máquinas de estado** — pular etapas de checkout, refund duplo, cancelar pedido já enviado.\n\n` +
      `Para cada achado: arquivo:linha, cenário de exploração passo a passo, severidade (Crítico/Alto/Médio) e correção sugerida (transação atômica, validação server-side, lock).`,
  },
  {
    id: "secret-scan",
    label: "Varredura de Segredos",
    icon: KeyRound,
    agentHint: "🛡️ Auditor de Código & AppSec",
    build: (ws, count) =>
      `[Secret Scanning — ${ws ?? "workspace"} · ${count} arquivo(s)]\n\n` +
      `Varra todos os arquivos do workspace procurando segredos hardcoded:\n\n` +
      `- Chaves de API (AWS AKIA*, Google AIza*, OpenAI sk-*, GitHub ghp_*, Slack xox*, Stripe sk_live_*)\n` +
      `- Tokens JWT estáticos, refresh tokens, OAuth client secrets\n` +
      `- Strings de conexão (postgres://, mongodb://, mysql://, redis://) com credenciais embutidas\n` +
      `- Senhas em literal, certificados privados (-----BEGIN PRIVATE KEY-----)\n` +
      `- service_role/admin keys em código de cliente (.tsx, .jsx)\n` +
      `- Variáveis com prefixo errado (VITE_*/NEXT_PUBLIC_* contendo segredos server-only)\n\n` +
      `Para cada match: arquivo:linha, tipo do segredo, severidade, e plano de remediação (mover para env server-only, rotacionar a chave, adicionar ao .gitignore).`,
  },
  {
    id: "financial-resilience",
    label: "Simulação de Resiliência Financeira",
    icon: Coins,
    agentHint: "🔍 Especialista em Business Logic",
    build: (ws) =>
      `[Resiliência Financeira — ${ws ?? "workspace"}]\n\n` +
      `Avalie regras de validação de transações em código que simule plataformas financeiras, fintech ou jogos com moeda. Procure:\n\n` +
      `1. **Inputs negativos** — \`amount < 0\` permitido em transfer/deposit/bet (transferir -100 = creditar 100).\n` +
      `2. **Integer overflow / underflow** — multiplicações sem verificar MAX_SAFE_INTEGER, BigInt necessário e ausente, casts perigosos number↔string.\n` +
      `3. **Precisão decimal** — uso de Number/float para dinheiro em vez de inteiros de centavos ou Decimal.\n` +
      `4. **Validação só no cliente** — Zod/yup no front sem espelho server-side.\n` +
      `5. **Falta de idempotência** — retry de pagamento gera débito duplicado.\n` +
      `6. **Aprovação fora de ordem** — webhook de \`payment.success\` aceita sem verificar status anterior.\n\n` +
      `Para cada falha, monte um PoC mínimo (payload curl/fetch) que dispare o bug e proponha a correção.`,
  },
];

const POC_PROMPT =
  `[Gerar Relatório de PoC — Proof of Concept]\n\n` +
  `Com base nas vulnerabilidades identificadas até aqui nesta conversa, estruture um relatório técnico no formato padrão de Bug Bounty / responsible disclosure. Para CADA vulnerabilidade, retorne em Markdown:\n\n` +
  `## [SEV] Título curto da vulnerabilidade\n` +
  `**Severidade:** Crítica / Alta / Média / Baixa (CVSS 3.1: X.X)\n` +
  `**CWE:** CWE-XXX — Nome\n` +
  `**Componente afetado:** arquivo:linha ou endpoint\n\n` +
  `### Descrição\n` +
  `Explicação técnica clara do que é a falha e por que ela existe.\n\n` +
  `### Impacto\n` +
  `Consequência prática (perda financeira, exposição de dados, RCE, etc.) e quem é afetado.\n\n` +
  `### Passos para Reproduzir\n` +
  `1. Pré-requisitos (usuário, permissão, dados)\n` +
  `2. Request/comando exato (curl, payload JSON, etc.)\n` +
  `3. Resposta esperada vs. resposta vulnerável observada\n\n` +
  `### Mitigação / Solução\n` +
  `Correção técnica recomendada com snippet de código corrigido (em fence \`\`\`lang). Inclua mudanças de configuração, validação adicional e testes de regressão.\n\n` +
  `### Referências\n` +
  `- OWASP / CWE / RFC relevantes\n\n` +
  `---\n\n` +
  `Ao final, adicione um resumo executivo (1 parágrafo) e uma tabela com [Título | Severidade | Status sugerido].`;

export function AuditTemplatesPanel() {
  const [open, setOpen] = useState(false);
  const { setPendingPrompt, setActiveTab } = usePanel();
  const { rootName, adapter } = useWorkspace();

  const inject = (text: string, agentHint: string) => {
    setPendingPrompt(text);
    setActiveTab("chat");
    toast.success(`Prompt carregado · sugestão: ${agentHint}`, {
      description: "Selecione o agente no badge superior do chat antes de enviar.",
    });
    setOpen(false);
  };

  const fileCount =
    adapter && "allFiles" in adapter && typeof (adapter as { allFiles?: () => string[] }).allFiles === "function"
      ? (adapter as { allFiles: () => string[] }).allFiles().length
      : 0;

  return (
    <>
      {/* Toggle flutuante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Casos de Teste & Auditoria"
        className={cn(
          "fixed bottom-12 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-all",
          "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:scale-105",
          open && "ring-2 ring-red-500/40",
        )}
        aria-label="Abrir painel de auditoria"
      >
        <ShieldAlert className="h-5 w-5" />
      </button>

      {open && (
        <div
          className={cn(
            "fixed bottom-28 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-surface-1 shadow-2xl",
            "animate-in fade-in slide-in-from-bottom-2 duration-200",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-red-500/5 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              📋 Casos de Teste & Auditoria
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1 p-2">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => inject(t.build(rootName, fileCount), t.agentHint)}
                  className="flex w-full items-start gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-surface-2"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-400">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{t.label}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{t.agentHint}</div>
                  </div>
                </button>
              );
            })}

            <div className="my-1 border-t border-border" />

            <button
              type="button"
              onClick={() =>
                inject(POC_PROMPT, "🛡️ Auditor de Código & AppSec")
              }
              className="flex w-full items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-left transition-colors hover:bg-amber-500/10"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
                <FileWarning className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">📄 Gerar Relatório de PoC</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  Descrição · Impacto · Reprodução · Mitigação
                </div>
              </div>
            </button>
          </div>

          <div className="border-t border-border bg-surface-2/40 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
            ⚠ Use somente em projetos próprios ou com autorização explícita por escrito.
            Se a Lovable recusar, ative o modal Uncensored manualmente.
          </div>
        </div>
      )}
    </>
  );
}
