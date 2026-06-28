/**
 * AI Clients — chamadas REAIS para OpenRouter / Groq / Tavily.
 *
 * Lê as credenciais diretamente do localStorage usando as chaves padrão:
 *   - jarvis_api_key     → chave do provedor (OpenRouter ou Groq)
 *   - jarvis_model       → modelo escolhido
 *   - jarvis_search_key  → chave do Tavily (busca web)
 *   - jarvis_provider    → "openrouter" | "groq"
 *
 * ⚠️ As chamadas saem direto do navegador → expõem a API key no DevTools.
 *    Use somente localmente. Em produção, coloque um proxy/Edge Function.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

function ls(key: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function getCredentials() {
  return {
    provider: (ls("jarvis_provider", "openrouter") as "openrouter" | "groq"),
    apiKey: ls("jarvis_api_key"),
    model: ls("jarvis_model", "nousresearch/hermes-3-llama-3.1-8b"),
    searchKey: ls("jarvis_search_key"),
  };
}

/** Chat completion contra OpenRouter ou Groq (ambos seguem o esquema OpenAI). */
export async function callChatCompletion(
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; temperature?: number } = {},
): Promise<string> {
  const { provider, apiKey, model } = getCredentials();
  if (!apiKey) {
    throw new Error(
      "Nenhuma chave de API encontrada. Abra Configurações e salve sua chave.",
    );
  }
  if (!model) throw new Error("Nenhum modelo definido em Configurações.");

  const url =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === "openrouter" && typeof window !== "undefined") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Painel de IA Autônomo";
  }

  const res = await fetch(url, {
    method: "POST",
    signal: opts.signal,
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${provider} retornou ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Resposta inesperada do provedor (sem choices[0].message.content).");
  }
  return content;
}

/** Pesquisa web via Tavily. */
export async function webSearch(
  query: string,
  opts: { signal?: AbortSignal; maxResults?: number } = {},
): Promise<SearchResult[]> {
  const { searchKey } = getCredentials();
  if (!searchKey) {
    throw new Error(
      "Nenhuma chave de busca web encontrada. Salve a chave Tavily em Configurações.",
    );
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal: opts.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: searchKey,
      query,
      max_results: opts.maxResults ?? 5,
      search_depth: "basic",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily retornou ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json();
  return (data?.results ?? []).map((r: any) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    content: String(r.content ?? ""),
  }));
}

export function hasCredentials(): boolean {
  return getCredentials().apiKey.trim().length > 0;
}
