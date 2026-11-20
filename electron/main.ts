import { app, BrowserWindow, shell, Menu } from "electron";
import path from "node:path";
import { initDatabase } from "./db-init";
import { startNextServer, stopNextServer } from "./next-server";
import { pickFreePort } from "./port";
import { isDev } from "./paths";

// 单实例锁：防止多开导致 Next 端口冲突和数据库竞争
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let port = 0;
let isQuitting = false; // 防止 before-quit 递归

async function bootstrap(): Promise<void> {
  // 1. 初始化数据库（首次启动会跑 prisma db push）
  await initDatabase();

  // 2. 选端口
  port = isDev ? 3000 : await pickFreePort(17890, 18000);

  // 3. 启动 Next 服务（开发模式跳过，直接用 dev server）
  if (!isDev) {
    await startNextServer(port);
  }

  // 4. 创建窗口（手机竖屏比例，README 说"手机优先"）
  mainWindow = new BrowserWindow({
    width: 480,
    height: 900,
    minWidth: 420,
    minHeight: 720,
    title: "书入",
    backgroundColor: "#f7f3ea",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 5. 拦截外部链接：target=_blank / window.open 外部地址走系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e, url) => {
    const allowed = `http://127.0.0.1:${port}`;
    if (!url.startsWith(allowed) && !url.startsWith("http://localhost:3000")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // 6. 加载页面
  const url = isDev ? "http://127.0.0.1:3000" : `http://127.0.0.1:${port}`;
  if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
  mainWindow.loadURL(url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(bootstrap).catch((err) => {
  console.error("[main] bootstrap failed:", err);
  app.quit();
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// 退出时优雅终止 Next 子进程
app.on("before-quit", async (e) => {
  if (isQuitting) return;
  e.preventDefault();
  isQuitting = true;
  await stopNextServer();
  app.exit(0);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 生产模式移除应用菜单（保留快捷键）
if (!isDev) {
  Menu.setApplicationMenu(null);
}
