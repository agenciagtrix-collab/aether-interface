import { useCallback, useSyncExternalStore } from "react";

export type AIProvider = "openrouter" | "groq";

export interface Settings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  webSearchApiKey: string;
}

const STORAGE_KEY = "lovable.ai-panel.settings.v1";

const DEFAULT_SETTINGS: Settings = {
  provider: "openrouter",
  apiKey: "",
  model: "nousresearch/hermes-3-llama-3.1-8b",
  webSearchApiKey: "",
};

const listeners = new Set<() => void>();
let cache: Settings | null = null;

function read(): Settings {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = DEFAULT_SETTINGS;
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    cache = DEFAULT_SETTINGS;
  }
  return cache;
}

function write(next: Settings) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS);

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
