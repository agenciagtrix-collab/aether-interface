/* eslint-disable */
const { contextBridge, ipcRenderer } = require("electron");

const listeners = new Set();
ipcRenderer.on("jarvis:event", (_e, payload) => {
  for (const fn of listeners) {
    try { fn(payload); } catch {}
  }
});

contextBridge.exposeInMainWorld("jarvisDaemon", {
  mode: "electron",
  pickCwd: () => ipcRenderer.invoke("jarvis:pickCwd"),
  exec: (command, cwd) => ipcRenderer.invoke("jarvis:exec", { command, cwd }),
  kill: (id) => ipcRenderer.invoke("jarvis:kill", id),
  stdin: (id, data) => ipcRenderer.invoke("jarvis:stdin", { id, data }),
  on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
});
