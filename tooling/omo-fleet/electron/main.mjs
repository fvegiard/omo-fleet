import { app, BrowserWindow, session } from "electron";

const address = process.env.OMO_FLEET_URL;
if (!address) throw new Error("OMO_FLEET_URL must identify the local fleet server");
const target = new URL(address);
if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" ||
    target.username || target.password)
  throw new Error("Electron requires an explicit loopback HTTP fleet URL");

app.setName("OmO Fleet");
app.whenReady().then(async () => {
console.log('Fleet Electron ready');

const isolatedSession = session.fromPartition("omo-fleet-desktop");
if (process.env.OMO_FLEET_DAEMONS !== '1') {
const token = process.env.OMO_FLEET_BOOTSTRAP;
delete process.env.OMO_FLEET_BOOTSTRAP;
if (!token) throw new Error("Missing private transport bootstrap token");
const authentication = await fetch(new URL("/session", target), {
  method: "POST",
  headers: { origin: target.origin, "content-type": "application/json" },
  body: JSON.stringify({ token }),
});
if (!authentication.ok) throw new Error("Fleet transport authentication failed");
const cookie = authentication.headers.get("set-cookie")?.split(";")[0];
if (!cookie?.startsWith("omo_fleet_terminal=")) throw new Error("Missing transport session cookie");
await isolatedSession.cookies.set({
  url: target.origin, name: "omo_fleet_terminal", value: cookie.slice("omo_fleet_terminal=".length),
  httpOnly: true, sameSite: "strict", path: "/",
});
} else if (target.origin !== 'http://127.0.0.1:4310') {
  throw new Error('Daemon dashboard must use port 4310');
}
isolatedSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
isolatedSession.setPermissionCheckHandler(() => false);
isolatedSession.on("will-download", event => event.preventDefault());

const window = new BrowserWindow({
  title: "OmO Fleet",
  width: 1600,
  height: 1100,
  minWidth: 640,
  minHeight: 480,
  show: true,
  autoHideMenuBar: true,
  webPreferences: {
    session: isolatedSession,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  },
});
window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
window.webContents.on("will-navigate", (event, destination) => {
  if (new URL(destination).origin !== target.origin) event.preventDefault();
});
window.webContents.on("will-attach-webview", event => event.preventDefault());
window.webContents.on('did-fail-load', (_e,code,description) => console.error('load failed',code,description));
window.webContents.on('render-process-gone', (_e,detail) => console.error('renderer gone',detail.reason));
window.once("ready-to-show", () => window.show());
await window.loadURL(target.href);
window.show();
console.log('Fleet Electron loaded',target.origin,window.isVisible());
app.on("window-all-closed", () => app.quit());
}).catch(error => { console.error(error); app.exit(1); });
