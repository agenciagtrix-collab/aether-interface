// Persistência das preferências de layout da IDE em localStorage.
// react-resizable-panels usa sua própria chave (autoSaveId), aqui guardamos
// as toggles + último painel ativo.

const KEY = "jarvis_ide_ui_v1";

export interface IdeUiState {
  activityView: string;
  showChat: boolean;
  showTerminal: boolean | null; // null = segue o modo (agente)
  showSidebar: boolean;
}

const DEFAULT: IdeUiState = {
  activityView: "explorer",
  showChat: true,
  showTerminal: null,
  showSidebar: true,
};

export function loadIdeUiState(): IdeUiState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function saveIdeUiState(state: IdeUiState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function resetIdeLayout() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    // Limpa também os autoSaves internos do react-resizable-panels
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("react-resizable-panels:")) toRemove.push(k);
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
