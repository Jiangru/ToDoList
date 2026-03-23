const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { initReminder, scheduleReminder, cancelJobsByDate } = require('./reminder.js');

const store = new Store({
  name: 'todos',
  defaults: { todos: {} }
});

let mainWindow;

// 数据迁移：将旧版单次提醒字段转换为 reminders 数组
function migrateTodos() {
  const todosMap = store.get('todos') || {};
  let changed = false;
  for (const date in todosMap) {
    const dayTodos = todosMap[date];
    if (!Array.isArray(dayTodos)) continue;
    dayTodos.forEach(todo => {
      if (todo.reminder && !todo.reminders) {
        todo.reminders = [{
          id: `rem_${todo.id}_${Date.now()}`,
          type: 'single',
          time: todo.reminder,
          enabled: true
        }];
        delete todo.reminder;
        changed = true;
      } else if (!todo.reminders) {
        todo.reminders = [];
      }
    });
  }
  if (changed) store.set('todos', todosMap);
}

// 重新调度某一天的所有待办的提醒
function rescheduleTodosForDate(date, todos) {
  cancelJobsByDate(date);          // 取消该日期所有旧任务
  todos.forEach(todo => {
    if (todo.reminders && todo.reminders.length) {
      todo.reminders.forEach(reminder => {
        scheduleReminder(date, todo, reminder, mainWindow);
      });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

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
  migrateTodos();
  createWindow();
  initReminder(store, mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC：获取所有待办
ipcMain.handle('get-todos', () => {
  return store.get('todos');
});

// IPC：保存某一天的待办列表
ipcMain.handle('save-todos', (event, date, todos) => {
  const allTodos = store.get('todos');
  allTodos[date] = todos;
  store.set('todos', allTodos);
  rescheduleTodosForDate(date, todos);
  return true;
});