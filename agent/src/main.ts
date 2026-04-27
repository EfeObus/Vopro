import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';
import { loadConfig } from './config';
import { EventBuffer } from './buffer';
import { Capture } from './capture';
import { Syncer } from './sync';

let tray: Tray | null = null;
let win: BrowserWindow | null = null;

const { config, save } = loadConfig();
const buffer = new EventBuffer(path.join(os.homedir(), '.vopro', 'events.jsonl'));
const capture = new Capture(config, buffer);
const syncer = new Syncer(config, buffer);

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

  ipcMain.handle('vopro:status', () => ({
    captureEnabled: config.capture.enabled,
    optedInApps: config.capture.optedInApps,
    deviceId: config.deviceId,
  }));

  ipcMain.handle('vopro:record', (_e, input) => capture.record(input));
  ipcMain.handle('vopro:flush', () => syncer.flush());
  ipcMain.handle('vopro:setCapture', (_e, enabled: boolean) => {
    save({ capture: { ...config.capture, enabled } });
    config.capture.enabled = enabled;
    refreshMenu();
    return enabled;
  });
});

app.on('window-all-closed', (e: Electron.Event) => e.preventDefault());
app.on('before-quit', () => syncer.stop());
