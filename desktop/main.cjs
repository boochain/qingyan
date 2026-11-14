const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const PORT = 47321;
const HOST = "127.0.0.1";

function serverEntry() {
  const candidates = [
    path.join(process.resourcesPath, "app", ".output", "server", "index.mjs"),
    path.join(__dirname, "..", ".output", "server", "index.mjs"),
  ];
  return candidates.find((file) => fs.existsSync(file)) ?? candidates[0];
}

function waitFor(url) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      fetch(url)
        .then((response) => {
          if (response.status < 500) resolve();
          else retry();
        })
        .catch(retry);
    };
    const retry = () => {
      if (Date.now() - started > 20000) reject(new Error("青砚没有在本机起来"));
      else setTimeout(tick, 250);
    };
    tick();
  });
}

let child = null;

function startServer(entry) {
  child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOST,
      PORT: String(PORT),
      NITRO_HOST: HOST,
      NITRO_PORT: String(PORT),
    },
    stdio: "pipe",
    windowsHide: true,
  });
  let log = "";
  child.stdout?.on("data", (chunk) => {
    log = (log + chunk.toString()).slice(-4000);
  });
  child.stderr?.on("data", (chunk) => {
    log = (log + chunk.toString()).slice(-4000);
  });
  child.on("exit", (code) => {
    if (code && code !== 0 && !app.isQuitting) {
      dialog.showErrorBox("青砚退出了", log || `服务进程结束，代码 ${code}`);
    }
  });
}

async function openWindow() {
  const entry = serverEntry();
  if (!fs.existsSync(entry)) {
    dialog.showErrorBox("找不到程序", "安装包里没有本地服务。请重新下载发行版。");
    app.quit();
    return;
  }
  startServer(entry);
  try {
    await waitFor(`http://${HOST}:${PORT}/`);
  } catch (error) {
    dialog.showErrorBox("青砚没有打开", error instanceof Error ? error.message : "启动失败");
    app.quit();
    return;
  }
  const window = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 390,
    minHeight: 640,
    title: "青砚",
    autoHideMenuBar: true,
    backgroundColor: "#7ecfff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await window.loadURL(`http://${HOST}:${PORT}/`);
}

app.whenReady().then(() => {
  void openWindow();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (child && !child.killed) child.kill();
});

app.on("window-all-closed", () => {
  app.quit();
});
