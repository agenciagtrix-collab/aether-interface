/**
 * AI Clients — funções de integração REAL (comentadas).
 *
 * Este arquivo é um esqueleto pronto para uso quando você baixar o projeto
 * e quiser conectar suas chaves reais. Descomente as funções abaixo e
 * importe-as nos handlers do ChatView / ThinkingTerminal.
 *
 * ⚠️ AVISO DE SEGURANÇA:
 *   Chamar APIs diretamente do navegador EXPÕE sua API key para qualquer
 *   pessoa que abrir o DevTools. Use isso apenas localmente. Para produção,
 *   coloque um proxy (Edge Function / backend) entre o front-end e o provedor.
 *
 * ⚠️ CORS:
 *   - OpenRouter: aceita chamadas diretas do browser (envie header
 *     `HTTP-Referer` e `X-Title`).
 *   - GroqCloud: aceita chamadas diretas do browser.
 *   - Tavily / Serper: aceitam chamadas diretas, mas leia a doc de cada um.
 */

import type { Settings } from "@/hooks/use-settings";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// -----------------------------------------------------------------------------
// 1) Chat completion (OpenRouter ou Groq — ambos seguem o esquema OpenAI)
// -----------------------------------------------------------------------------
//
// export async function callChatCompletion(
//   messages: ChatMessage[],
//   settings: Settings,
//   signal?: AbortSignal,
// ): Promise<string> {
//   const url =
//     settings.provider === "groq"
//       ? "https://api.groq.com/openai/v1/chat/completions"
//       : "https://openrouter.ai/api/v1/chat/completions";
//
//   const res = await fetch(url, {
//     method: "POST",
//     signal,
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${settings.apiKey}`,
//       // Headers extras recomendados pelo OpenRouter:
//       ...(settings.provider === "openrouter" && {
//         "HTTP-Referer": window.location.origin,
//         "X-Title": "Painel de IA Autônomo",
//       }),
//     },
//     body: JSON.stringify({
//       model: settings.model,
//       messages,
//       temperature: 0.7,
//       stream: false,
//     }),
//   });
//
//   if (!res.ok) {
//     const text = await res.text();
//     throw new Error(`Provedor retornou ${res.status}: ${text}`);
//   }
//
//   const data = await res.json();
//   return data.choices?.[0]?.message?.content ?? "";
// }

// -----------------------------------------------------------------------------
// 2) Web search (Tavily ou Serper)
// -----------------------------------------------------------------------------
//
// export interface SearchResult {
//   title: string;
//   url: string;
//   snippet: string;
// }
//
// export async function webSearch(
//   query: string,
//   settings: Settings,
// ): Promise<SearchResult[]> {
//   // --- Tavily ---
//   // const res = await fetch("https://api.tavily.com/search", {
//   //   method: "POST",
//   //   headers: { "Content-Type": "application/json" },
//   //   body: JSON.stringify({
//   //     api_key: settings.webSearchApiKey,
//   //     query,
//   //     max_results: 5,
//   //     search_depth: "basic",
//   //   }),
//   // });
//   // const data = await res.json();
//   // return (data.results ?? []).map((r: any) => ({
//   //   title: r.title, url: r.url, snippet: r.content,
//   // }));
//
//   // --- Serper ---
//   // const res = await fetch("https://google.serper.dev/search", {
//   //   method: "POST",
//   //   headers: {
//   //     "Content-Type": "application/json",
//   //     "X-API-KEY": settings.webSearchApiKey,
//   //   },
//   //   body: JSON.stringify({ q: query, num: 5 }),
//   // });
//   // const data = await res.json();
//   // return (data.organic ?? []).map((r: any) => ({
//   //   title: r.title, url: r.link, snippet: r.snippet,
//   // }));
//
//   throw new Error("webSearch não implementado — descomente o bloco do provedor escolhido.");
// }

// -----------------------------------------------------------------------------
// 3) Loop do agente autônomo (esqueleto)
// -----------------------------------------------------------------------------
//
// Pseudocódigo de orquestração:
//   1. recebe missão do usuário
//   2. pede ao LLM um plano em passos JSON
//   3. para cada passo:
//      - se requer busca, chama webSearch()
//      - injeta resultado como mensagem `system` no contexto
//      - chama callChatCompletion() pedindo a próxima ação
//   4. quando o LLM responder com {done:true}, retorna a síntese final
//
// Para alimentar o ThinkingTerminal, exporte um callback `onStep` que
// recebe { label, status } e use o context do painel para empilhar os steps.

export type { Settings };
