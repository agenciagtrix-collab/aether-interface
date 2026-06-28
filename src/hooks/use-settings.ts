import { useCallback, useSyncExternalStore } from "react";

export type AIProvider = "openrouter" | "groq";

export interface Settings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  webSearchApiKey: string;
}

// Chaves padrão (compatíveis com leitura direta em src/lib/ai-clients.ts)
const KEYS = {
  provider: "jarvis_provider",
  apiKey: "jarvis_api_key",
  model: "jarvis_model",
  webSearchApiKey: "jarvis_search_key",
} as const;

const DEFAULT_SETTINGS: Settings = {
  provider: "openrouter",
  apiKey: "",
  model: "deepseek/deepseek-chat-v3.1:free",
  webSearchApiKey: "",
};

const listeners = new Set<() => void>();

function read(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const provider = (window.localStorage.getItem(KEYS.provider) as AIProvider) || DEFAULT_SETTINGS.provider;
    return {
      provider: provider === "groq" ? "groq" : "openrouter",
      apiKey: window.localStorage.getItem(KEYS.apiKey) ?? "",
      model: window.localStorage.getItem(KEYS.model) ?? DEFAULT_SETTINGS.model,
      webSearchApiKey: window.localStorage.getItem(KEYS.webSearchApiKey) ?? "",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Cache estável para useSyncExternalStore (precisa retornar a mesma ref se nada mudou)
let snapshot: Settings = DEFAULT_SETTINGS;
let snapshotInit = false;
function getSnapshot(): Settings {
  const next = read();
  if (
    !snapshotInit ||
    next.provider !== snapshot.provider ||
    next.apiKey !== snapshot.apiKey ||
    next.model !== snapshot.model ||
    next.webSearchApiKey !== snapshot.webSearchApiKey
  ) {
    snapshot = next;
    snapshotInit = true;
  }
  return snapshot;
}

function write(next: Settings) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEYS.provider, next.provider);
      window.localStorage.setItem(KEYS.apiKey, next.apiKey);
      window.localStorage.setItem(KEYS.model, next.model);
      window.localStorage.setItem(KEYS.webSearchApiKey, next.webSearchApiKey);
    } catch {
      // ignora erros de quota
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SETTINGS);

  const update = useCallback((patch: Partial<Settings>) => {
    write({ ...read(), ...patch });
  }, []);

  const reset = useCallback(() => {
    write(DEFAULT_SETTINGS);
  }, []);

  return { settings, update, reset };
}

export function isConnected(s: Settings): boolean {
  return s.apiKey.trim().length > 0 && s.model.trim().length > 0;
}
