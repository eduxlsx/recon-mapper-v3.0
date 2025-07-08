const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  startScan: (options) => ipcRenderer.invoke("start-scan", options),
  stopScan: () => ipcRenderer.send("stop-scan"),
  onScanUpdate: (callback) =>
    ipcRenderer.on("scan-update", (_event, value) => callback(value)),
  generatePdf: (scanData) => ipcRenderer.invoke("generate-pdf", scanData),
});
