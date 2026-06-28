/**
 * Cliente do Daemon Local — funciona em 2 modos:
 *   1) Electron:  usa window.jarvisDaemon (preload.cjs)
 *   2) Browser:   conecta via WebSocket no daemon Node (daemon/server.cjs)
 *
 * API uniforme (start/kill/stdin/on) para o componente de terminal.
 */
export type DaemonEvent =
  | { id: string; type: "start"; command: string; cwd: string; pid?: number }
  | { id: string; type: "stdout"; data: string }
  | { id: string; type: "stderr"; data: string }
  | { id: string; type: "exit"; code: number; error?: string };

export interface DaemonClient {
  mode: "electron" | "ws";
  connected: boolean;
  start: (command: string, cwd?: string) => Promise<string>;
  kill: (id: string) => void;
  stdin: (id: string, data: string) => void;
  on: (fn: (e: DaemonEvent) => void) => () => void;
  close: () => void;
}

const URL_KEY = "jarvis_daemon_url";
const TOKEN_KEY = "jarvis_daemon_token";

export function getDaemonConfig() {
  if (typeof window === "undefined") return { url: "", token: "" };
  return {
    url: localStorage.getItem(URL_KEY) ?? "",
    token: localStorage.getItem(TOKEN_KEY) ?? "",
  };
}
export function saveDaemonConfig(url: string, token: string) {
  localStorage.setItem(URL_KEY, url);
  localStorage.setItem(TOKEN_KEY, token);
}

declare global {
  interface Window {
    jarvisDaemon?: {
      mode: "electron";
      exec: (command: string, cwd?: string) => Promise<string>;
      kill: (id: string) => Promise<boolean>;
      stdin: (id: string, data: string) => Promise<boolean>;
      on: (fn: (e: DaemonEvent) => void) => () => void;
    };
  }
}

export function hasElectronDaemon() {
  return typeof window !== "undefined" && !!window.jarvisDaemon;
}

export function connectDaemon(): Promise<DaemonClient> {
  // Electron mode (sempre preferido)
  if (hasElectronDaemon()) {
    const api = window.jarvisDaemon!;
    return Promise.resolve({
      mode: "electron",
      connected: true,
      start: (cmd, cwd) => api.exec(cmd, cwd),
      kill: (id) => void api.kill(id),
      stdin: (id, data) => void api.stdin(id, data),
      on: (fn) => api.on(fn),
      close: () => {},
    });
  }

  // WebSocket mode (daemon Node)
  const { url, token } = getDaemonConfig();
  if (!url) return Promise.reject(new Error("Daemon URL não configurada. Vá em Configurações → Daemon Local."));
  const full = url.includes("?") ? url : `${url}?token=${encodeURIComponent(token)}`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(full);
    const listeners = new Set<(e: DaemonEvent) => void>();
    let opened = false;
    const timeout = setTimeout(() => {
      if (!opened) { ws.close(); reject(new Error("Timeout conectando ao daemon")); }
    }, 4000);

    ws.onopen = () => { opened = true; clearTimeout(timeout); };
    ws.onerror = () => { if (!opened) reject(new Error("Falha ao conectar no daemon (verifique URL/token)")); };
    ws.onclose = (e) => {
      if (!opened) { clearTimeout(timeout); reject(new Error(`Daemon recusou conexão (${e.code})`)); }
    };
    ws.onmessage = (msg) => {
      let data: any; try { data = JSON.parse(msg.data); } catch { return; }
      if (data.type === "hello") {
        resolve({
          mode: "ws",
          connected: true,
          start: (command, cwd) =>
            new Promise<string>((res) => {
              const id = crypto.randomUUID();
              ws.send(JSON.stringify({ type: "exec", id, command, cwd }));
              res(id);
            }),
          kill: (id) => ws.send(JSON.stringify({ type: "kill", id })),
          stdin: (id, d) => ws.send(JSON.stringify({ type: "stdin", id, data: d })),
          on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
          close: () => ws.close(),
        });
        return;
      }
      if (data.type && data.id) for (const fn of listeners) fn(data as DaemonEvent);
    };
  });
}
