/* eslint-disable */
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const crypto = require("crypto");

const procs = new Map();

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Em produção (após `vite build` com base:'./'): carrega dist/index.html
  // Em dev você pode apontar pra http://localhost:8080
  const devUrl = process.env.JARVIS_DEV_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

ipcMain.handle("jarvis:pickCwd", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle("jarvis:exec", (evt, { command, cwd }) => {
  const id = crypto.randomUUID();
  const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
  const args = process.platform === "win32" ? ["/c", command] : ["-lc", command];
  const child = spawn(shell, args, { cwd: cwd || process.cwd(), env: process.env });
  procs.set(id, child);
  const send = (type, payload) =>
    evt.sender.send("jarvis:event", { id, type, ...payload });
  send("start", { command, cwd: cwd || process.cwd(), pid: child.pid });
  child.stdout.on("data", (b) => send("stdout", { data: b.toString("utf8") }));
  child.stderr.on("data", (b) => send("stderr", { data: b.toString("utf8") }));
  child.on("close", (code) => { procs.delete(id); send("exit", { code }); });
  child.on("error", (err) => { procs.delete(id); send("exit", { code: -1, error: String(err) }); });
  return id;
});

ipcMain.handle("jarvis:kill", (_e, id) => {
  const p = procs.get(id); if (p) p.kill("SIGTERM"); return true;
});

ipcMain.handle("jarvis:stdin", (_e, { id, data }) => {
  const p = procs.get(id); if (p && p.stdin.writable) p.stdin.write(String(data ?? "")); return true;
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
