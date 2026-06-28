/**
 * AI Clients — chamadas REAIS para OpenRouter / Groq / Tavily, com STREAMING.
 *
 * Lê credenciais direto do localStorage:
 *   - jarvis_api_key     → chave do provedor (OpenRouter ou Groq)
 *   - jarvis_model       → modelo escolhido
 *   - jarvis_search_key  → chave do Tavily
 *   - jarvis_provider    → "openrouter" | "groq"
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
    provider: ls("jarvis_provider", "openrouter") as "openrouter" | "groq",
    apiKey: ls("jarvis_api_key"),
    model: ls("jarvis_model", "nousresearch/hermes-3-llama-3.1-8b"),
    searchKey: ls("jarvis_search_key"),
  };
}

function endpoint(provider: "openrouter" | "groq") {
  return provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
}

function authHeaders(provider: "openrouter" | "groq", apiKey: string) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === "openrouter" && typeof window !== "undefined") {
    h["HTTP-Referer"] = window.location.origin;
    h["X-Title"] = "Painel de IA Autônomo";
  }
  return h;
}

/** Chat completion não-stream (resposta completa). */
export async function callChatCompletion(
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; temperature?: number } = {},
): Promise<string> {
  const { provider, apiKey, model } = getCredentials();
  if (!apiKey) throw new Error("Nenhuma chave de API. Abra Configurações e salve sua chave.");
  if (!model) throw new Error("Nenhum modelo definido em Configurações.");

  const res = await fetch(endpoint(provider), {
    method: "POST",
    signal: opts.signal,
    headers: authHeaders(provider, apiKey),
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${provider} ${res.status}: ${text || res.statusText}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Resposta inesperada do provedor.");
  return content;
}

/** Chat completion COM STREAMING (SSE). Chama onDelta a cada token. */
export async function streamChatCompletion(
  messages: ChatMessage[],
  opts: {
    signal?: AbortSignal;
    temperature?: number;
    onDelta: (chunk: string) => void;
  },
): Promise<string> {
  const { provider, apiKey, model } = getCredentials();
  if (!apiKey) throw new Error("Nenhuma chave de API. Abra Configurações e salve sua chave.");
  if (!model) throw new Error("Nenhum modelo definido em Configurações.");

  const res = await fetch(endpoint(provider), {
    method: "POST",
    signal: opts.signal,
    headers: authHeaders(provider, apiKey),
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`${provider} ${res.status}: ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || !line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          full += delta;
          opts.onDelta(delta);
        }
      } catch {
        // ignora pedaços não-JSON
      }
    }
  }
  return full;
}

/** Pesquisa web via Tavily. */
export async function webSearch(
  query: string,
  opts: { signal?: AbortSignal; maxResults?: number } = {},
): Promise<SearchResult[]> {
  const { searchKey } = getCredentials();
  if (!searchKey) throw new Error("Nenhuma chave Tavily. Salve em Configurações.");

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
    throw new Error(`Tavily ${res.status}: ${text || res.statusText}`);
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
