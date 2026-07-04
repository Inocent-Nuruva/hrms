const { app, BrowserWindow, shell } = require("electron");
const { createServer } = require("node:http");
const path = require("node:path");
const next = require("next");

const HOSTNAME = "127.0.0.1";
const START_PATH = "/dashboard";

let nextServer;

async function startNextServer() {
  const appRoot = app.getAppPath();
  const dev = !app.isPackaged && process.env.NODE_ENV !== "production";
  const nextApp = next({
    dev,
    dir: appRoot,
    hostname: HOSTNAME,
    quiet: !dev,
  });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      handle(request, response);
    });

    server.on("error", reject);
    server.listen(0, HOSTNAME, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine desktop server address."));
        return;
      }

      nextServer = server;
      resolve(`http://${HOSTNAME}:${address.port}`);
    });
  });
}

function createMainWindow(startUrl) {
  const iconPath = path.join(app.getAppPath(), "desktop", "icon.png");
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 720,
    title: "HRMS",
    icon: iconPath,
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(startUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  window.loadURL(`${startUrl}${START_PATH}`);
}

app.whenReady().then(async () => {
  app.setName("HRMS");
  const startUrl = await startNextServer();
  createMainWindow(startUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(startUrl);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (nextServer) {
    nextServer.close();
  }
});
