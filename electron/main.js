const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { initReminder, scheduleReminder, cancelReminder } = require('./reminder.js');
const fs = require('fs');
const preloadPath = path.join(__dirname, 'preload.js');
console.log('Preload exists:', fs.existsSync(preloadPath));

// 数据存储
const store = new Store({
  name: 'todos',
  defaults: { todos: {} }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 开发环境加载 Vite 开发服务器
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  initReminder(store, mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC 通信：获取所有待办
ipcMain.handle('get-todos', () => {
  return store.get('todos');
});

// IPC 通信：保存某一天的待办列表
ipcMain.handle('save-todos', (event, date, todos) => {
  const allTodos = store.get('todos');
  allTodos[date] = todos;
  store.set('todos', allTodos);

  if (todos && Array.isArray(todos)) {
    todos.forEach(todo => {
      if (todo.reminder && !todo.completed) {
        scheduleReminder(todo.id, todo.reminder, todo.text, mainWindow);
      } else if (todo.reminder && todo.completed) {
        cancelReminder(todo.id);
      }
    });
  }
  return true;
});

ipcMain.handle('open-todo-editor', (event, date) => {
  return date;
});