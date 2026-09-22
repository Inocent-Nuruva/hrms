const { app, BrowserWindow, shell } = require("electron");
const { createServer } = require("node:http");
const path = require("node:path");
const next = require("next");

const HOSTNAME = "127.0.0.1";
const START_PATH = "/dashboard";
const DEV_NODE_HEAP_LIMIT_MB = 1280;
const isDevelopment = !app.isPackaged && process.env.NODE_ENV !== "production";

let nextServer;

// In development Electron hosts Next in its main process. Without a cap, the
// V8 heap can expand toward several GB while its compiler watches the project.
if (isDevelopment) {
  app.commandLine.appendSwitch(
    "js-flags",
    `--max-old-space-size=${DEV_NODE_HEAP_LIMIT_MB}`,
  );
}

async function startNextServer() {
  const appRoot = app.getAppPath();
  const dev = isDevelopment;
  const nextApp = next({
    dev,
    dir: appRoot,
    hostname: HOSTNAME,
    quiet: !dev,
    // This custom server must opt in explicitly. Turbopack compiles lazily and
    // uses less memory than the previous forced Webpack development server.
    turbopack: dev,
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
