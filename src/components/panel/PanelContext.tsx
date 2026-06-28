import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type PanelTab = "chat" | "agents" | "history" | "memory" | "settings";
export type ChatMode = "chat" | "agent";
export type StepStatus = "pending" | "running" | "done" | "error";

export interface TerminalStep {
  id: string;
  label: string;
  detail?: string;
  status: StepStatus;
  timestamp: number;
}

export interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  mode: ChatMode;
  attachments?: string[];
  thinking?: string;
  streaming?: boolean;
}

interface PanelState {
  activeTab: PanelTab;
  setActiveTab: (t: PanelTab) => void;

  mode: ChatMode;
  setMode: (m: ChatMode) => void;

  webSearchEnabled: boolean;
  toggleWebSearch: () => void;

  attachedFiles: string[];
  addAttachedFile: (name: string) => void;
  clearAttachedFiles: () => void;

  messages: ChatMsg[];
  addMessage: (m: Omit<ChatMsg, "id" | "timestamp">) => string;
  updateMessage: (id: string, patch: Partial<ChatMsg> | ((m: ChatMsg) => Partial<ChatMsg>)) => void;
  clearMessages: () => void;

  terminalSteps: TerminalStep[];
  setTerminalSteps: (s: TerminalStep[] | ((prev: TerminalStep[]) => TerminalStep[])) => void;
  clearTerminal: () => void;

  isRunning: boolean;
  setRunning: (b: boolean) => void;

  statusText: string;
  setStatusText: (s: string) => void;
}

const Ctx = createContext<PanelState | null>(null);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<PanelTab>("chat");
  const [mode, setMode] = useState<ChatMode>("chat");
  const [webSearchEnabled, setWebSearch] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [terminalSteps, setTerminalSteps] = useState<TerminalStep[]>([]);
  const [isRunning, setRunning] = useState(false);
  const [statusText, setStatusText] = useState("");

  const value = useMemo<PanelState>(
    () => ({
      activeTab,
      setActiveTab,
      mode,
      setMode,
      webSearchEnabled,
      toggleWebSearch: () => setWebSearch((v) => !v),
      attachedFiles,
      addAttachedFile: (name) => setAttachedFiles((f) => [...f, name]),
      clearAttachedFiles: () => setAttachedFiles([]),
      messages,
      addMessage: (m) => {
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev, { ...m, id, timestamp: Date.now() }]);
        return id;
      },
      updateMessage: (id, patch) =>
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === id ? { ...msg, ...(typeof patch === "function" ? patch(msg) : patch) } : msg,
          ),
        ),
      clearMessages: () => setMessages([]),
      terminalSteps,
      setTerminalSteps,
      clearTerminal: () => setTerminalSteps([]),
      isRunning,
      setRunning,
      statusText,
      setStatusText,
    }),
    [activeTab, mode, webSearchEnabled, attachedFiles, messages, terminalSteps, isRunning, statusText],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePanel() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePanel deve ser usado dentro de <PanelProvider>");
  return ctx;
}
