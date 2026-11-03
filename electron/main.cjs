// BillFlow POS Desktop Application Wrapper (Electron)
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 650,
    title: 'BillFlow POS',
    icon: path.join(__dirname, '../artifacts/billflow-pos/public/favicon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableWebSQL: false,
    },
  });

  // Remove default window menu bar for dedicated POS software terminal experience
  Menu.setApplicationMenu(null);

  const localDistHtml = path.join(__dirname, '../artifacts/billflow-pos/dist/index.html');
  if (fs.existsSync(localDistHtml)) {
    mainWindow.loadFile(localDistHtml);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
