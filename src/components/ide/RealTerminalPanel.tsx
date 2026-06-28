import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Trash2, ShieldAlert, Terminal as TerminalIcon, Plug, PlugZap } from "lucide-react";
import {
  connectDaemon,
  getDaemonConfig,
  hasElectronDaemon,
  type DaemonClient,
  type DaemonEvent,
} from "@/lib/daemon-client";
import { cn } from "@/lib/utils";

type Line = { id: string; stream: "info" | "stdout" | "stderr" | "exit"; text: string };

const HISTORY_KEY = "jarvis_daemon_history";
const AUTO_AUTHORIZE_KEY = "jarvis_daemon_auto_authorize";

export function RealTerminalPanel() {
  const [client, setClient] = useState<DaemonClient | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [cmd, setCmd] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [autoAuthorize, setAutoAuthorize] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(AUTO_AUTHORIZE_KEY) === "1",
  );
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const append = useCallback((stream: Line["stream"], text: string) => {
    setLines((prev) => [...prev.slice(-499), { id: crypto.randomUUID(), stream, text }]);
  }, []);

  const handleEvent = useCallback((e: DaemonEvent) => {
    if (e.type === "start") append("info", `\n$ ${e.command}  (pid ${e.pid ?? "?"} · ${e.cwd})\n`);
    else if (e.type === "stdout") append("stdout", e.data);
    else if (e.type === "stderr") append("stderr", e.data);
    else if (e.type === "exit") {
      append("exit", `\n[processo finalizado · code=${e.code}${e.error ? " · " + e.error : ""}]\n`);
      setRunningId(null);
    }
  }, [append]);

  const connect = useCallback(async () => {
    setConnecting(true); setConnError(null);
    try {
      const c = await connectDaemon();
      c.on(handleEvent);
      setClient(c);
      append("info", `✓ Conectado (${c.mode === "electron" ? "Electron" : "WebSocket"})\n`);
    } catch (err: any) {
      setConnError(err?.message ?? String(err));
    } finally {
      setConnecting(false);
    }
  }, [handleEvent, append]);

  useEffect(() => {
    if (hasElectronDaemon()) void connect();
    return () => client?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    const command = cmd.trim();
    if (!command || !client || runningId) return;
    if (!autoAuthorize) {
      const ok = window.confirm(
        `⚠️ AUTORIZAR execução real no terminal local?\n\n  $ ${command}\n\nClique OK para executar.`,
      );
      if (!ok) return;
    }
    try {
      const id = await client.start(command);
      setRunningId(id);
      const next = [command, ...history.filter((c) => c !== command)].slice(0, 50);
      setHistory(next);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      setCmd("");
    } catch (err: any) {
      append("stderr", `\n[erro: ${err?.message ?? String(err)}]\n`);
    }
  };

  const stop = () => {
    if (client && runningId) client.kill(runningId);
  };

  const cfg = getDaemonConfig();

  if (!client) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-xs text-muted-foreground">
        <ShieldAlert className="h-8 w-8 text-primary" />
        <p className="font-medium text-foreground">Terminal Real (Daemon Local)</p>
        <p className="max-w-sm">
          {hasElectronDaemon()
            ? "Detectei Electron — clique para conectar ao processo nativo."
            : cfg.url
              ? `Pronto para conectar em ${cfg.url}. Inicie o daemon com:  node daemon/server.cjs`
              : "Configure URL e token em Configurações → Daemon Local, OU rode dentro do Electron."}
        </p>
        {connError && <p className="text-destructive">{connError}</p>}
        <button
          onClick={connect}
          disabled={connecting}
          className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          {connecting ? <Plug className="h-3.5 w-3.5 animate-pulse" /> : <PlugZap className="h-3.5 w-3.5" />}
          {connecting ? "Conectando…" : "Conectar Daemon"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--terminal-bg,#0a0a0a)]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <TerminalIcon className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold uppercase tracking-wider">Terminal Real</span>
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-mono text-primary">
            {client.mode}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <label className="flex cursor-pointer items-center gap-1 text-muted-foreground">
            <input
              type="checkbox"
              checked={autoAuthorize}
              onChange={(e) => {
                setAutoAuthorize(e.target.checked);
                localStorage.setItem(AUTO_AUTHORIZE_KEY, e.target.checked ? "1" : "0");
              }}
              className="h-3 w-3"
            />
            auto-autorizar
          </label>
          <button
            onClick={() => setLines([])}
            title="Limpar"
            className="rounded p-1 text-muted-foreground hover:bg-primary/15 hover:text-primary"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
      >
        {lines.length === 0 ? (
          <p className="text-muted-foreground">$ pronto. digite um comando e pressione Enter.</p>
        ) : (
          lines.map((l) => (
            <pre
              key={l.id}
              className={cn(
                "whitespace-pre-wrap break-words",
                l.stream === "stderr" && "text-destructive",
                l.stream === "info" && "text-primary",
                l.stream === "exit" && "text-muted-foreground",
              )}
            >
              {l.text}
            </pre>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void run(); }}
        className="flex shrink-0 items-center gap-2 border-t border-border bg-surface-1 px-2 py-2"
      >
        <span className="font-mono text-xs text-primary">$</span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder={runningId ? "processo em execução…" : "ex: ls -la   |   npm install   |   git status"}
          disabled={!!runningId}
          className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/60"
          autoComplete="off"
          list="jarvis-cmd-history"
        />
        <datalist id="jarvis-cmd-history">
          {history.map((h) => <option key={h} value={h} />)}
        </datalist>
        {runningId ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/20"
          >
            <Square className="h-3 w-3" /> stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!cmd.trim()}
            className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] text-primary hover:bg-primary/20 disabled:opacity-40"
          >
            <Play className="h-3 w-3" /> run
          </button>
        )}
      </form>
    </div>
  );
}
