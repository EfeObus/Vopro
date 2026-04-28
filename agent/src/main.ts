import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, clipboard } from 'electron';
import path from 'node:path';
import os from 'node:os';
import { loadConfig } from './config';
import { EventBuffer } from './buffer';
import { Capture } from './capture';
import { Syncer } from './sync';
import { Receiver } from './receiver';

let tray: Tray | null = null;
let win: BrowserWindow | null = null;

const { config, save } = loadConfig();
const buffer = new EventBuffer(path.join(os.homedir(), '.vopro', 'events.jsonl'));
const capture = new Capture(config, buffer);
const syncer = new Syncer(config, buffer);
const receiver = new Receiver(config, capture);

function createWindow() {
  win = new BrowserWindow({
    width: 380,
    height: 520,
    show: false,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
  win.on('blur', () => win?.hide());
}

function buildTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Vopro');
  tray.on('click', () => (win?.isVisible() ? win.hide() : win?.show()));
  refreshMenu();
}

function refreshMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    {
      label: config.capture.enabled ? 'Pause capture' : 'Resume capture',
      click: () => {
        save({ capture: { ...config.capture, enabled: !config.capture.enabled } });
        config.capture.enabled = !config.capture.enabled;
        refreshMenu();
      },
    },
    { type: 'separator' },
    { label: 'Sync now', click: () => void syncer.flush() },
    { label: 'Open dashboard', click: () => win?.show() },
    { type: 'separator' },
    { role: 'quit' },
  ]);
  tray.setContextMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  buildTray();
  syncer.start();
  receiver.start();

  ipcMain.handle('vopro:status', () => ({
    captureEnabled: config.capture.enabled,
    optedInApps: config.capture.optedInApps,
    deviceId: config.deviceId,
    receiverPort: config.receiver.port,
  }));

  ipcMain.handle('vopro:record', (_e, input) => capture.record(input));
  ipcMain.handle('vopro:flush', () => syncer.flush());
  ipcMain.handle('vopro:setCapture', (_e, enabled: boolean) => {
    save({ capture: { ...config.capture, enabled } });
    config.capture.enabled = enabled;
    refreshMenu();
    return enabled;
  });
  // Copy the extension pairing token to the clipboard so the user can paste
  // it into the Chrome extension popup.
  ipcMain.handle('vopro:copyPairingToken', () => {
    clipboard.writeText(config.receiver.sharedSecret);
    return true;
  });
});

app.on('window-all-closed', () => {
  // Keep the agent alive in the tray when the popover window is dismissed.
});
app.on('before-quit', () => {
  syncer.stop();
  receiver.stop();
});
