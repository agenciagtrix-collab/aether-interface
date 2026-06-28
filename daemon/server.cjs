#!/usr/bin/env node
/* eslint-disable */
/**
 * Jarvis Local Daemon
 * --------------------
 * WebSocket server que executa comandos no terminal local com:
 *  - Token de autenticação (header "x-jarvis-token" OU query ?token=)
 *  - Autorização explícita (cada comando pede confirmação no painel)
 *  - Streaming de stdout/stderr em tempo real
 *  - Cancelamento (SIGTERM)
 *
 * Uso:
 *   JARVIS_TOKEN=meutoken JARVIS_PORT=17345 JARVIS_CWD=/caminho/projeto \
 *     node daemon/server.cjs
 *
 * Depois cole no painel (Configurações > Daemon Local):
 *   URL:   ws://localhost:17345
 *   Token: meutoken
 */
const http = require("http");
const { spawn } = require("child_process");
const crypto = require("crypto");

let WebSocketServer;
try {
  WebSocketServer = require("ws").WebSocketServer;
} catch {
  console.error('[jarvis-daemon] Dependência "ws" ausente. Rode:  npm i ws');
  process.exit(1);
}

const PORT = Number(process.env.JARVIS_PORT || 17345);
const TOKEN = process.env.JARVIS_TOKEN || crypto.randomBytes(16).toString("hex");
const ROOT = process.env.JARVIS_CWD || process.cwd();

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify({ ok: true, name: "jarvis-daemon", cwd: ROOT }));
});

const wss = new WebSocketServer({ server });
const procs = new Map(); // id -> ChildProcess

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", "http://x");
  const provided =
    req.headers["x-jarvis-token"] ||
    url.searchParams.get("token") ||
    "";
  if (provided !== TOKEN) {
    ws.send(JSON.stringify({ type: "error", message: "invalid token" }));
    ws.close(4001, "unauthorized");
    return;
  }
  ws.send(JSON.stringify({ type: "hello", cwd: ROOT, pid: process.pid }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return ws.send(JSON.stringify({ type: "error", message: "bad json" }));
    }

    if (msg.type === "exec") {
      const id = msg.id || crypto.randomUUID();
      const cmd = String(msg.command || "").trim();
      const cwd = msg.cwd || ROOT;
      if (!cmd) {
        return ws.send(JSON.stringify({ type: "exit", id, code: 1, error: "empty command" }));
      }
      const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
      const args = process.platform === "win32" ? ["/c", cmd] : ["-lc", cmd];
      const child = spawn(shell, args, { cwd, env: process.env });
      procs.set(id, child);
      ws.send(JSON.stringify({ type: "start", id, command: cmd, cwd, pid: child.pid }));

      child.stdout.on("data", (b) =>
        ws.send(JSON.stringify({ type: "stdout", id, data: b.toString("utf8") })),
      );
      child.stderr.on("data", (b) =>
        ws.send(JSON.stringify({ type: "stderr", id, data: b.toString("utf8") })),
      );
      child.on("close", (code) => {
        procs.delete(id);
        ws.send(JSON.stringify({ type: "exit", id, code }));
      });
      child.on("error", (err) => {
        procs.delete(id);
        ws.send(JSON.stringify({ type: "exit", id, code: -1, error: String(err) }));
      });
      return;
    }

    if (msg.type === "stdin" && msg.id) {
      const p = procs.get(msg.id);
      if (p && p.stdin.writable) p.stdin.write(String(msg.data ?? ""));
      return;
    }

    if (msg.type === "kill" && msg.id) {
      const p = procs.get(msg.id);
      if (p) p.kill("SIGTERM");
      return;
    }
  });

  ws.on("close", () => {
    for (const [, p] of procs) p.kill("SIGTERM");
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("┌─────────────────────────────────────────────────────────");
  console.log("│ 🛰  Jarvis Daemon escutando em ws://127.0.0.1:" + PORT);
  console.log("│ 📁 cwd:   " + ROOT);
  console.log("│ 🔑 token: " + TOKEN);
  console.log("└─────────────────────────────────────────────────────────");
});
