const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { initReminder, scheduleReminder, cancelJobsByDate } = require('./reminder.js');
const XLSX = require('xlsx');  // 新增
const fs = require('fs');       // 新增

const store = new Store({
  name: 'todos',
  defaults: { todos: {} }
});

let mainWindow;
let tray = null;

// 数据迁移：将旧版单次提醒字段转换为 reminders 数组
function migrateTodos() {
  const todosMap = store.get('todos') || {};
  let changed = false;
  for (const date in todosMap) {
    const dayTodos = todosMap[date];
    if (!Array.isArray(dayTodos)) continue;
    dayTodos.forEach(todo => {
      if (!todo.createdAt) {
        todo.createdAt = new Date().toISOString();
        changed = true;
      }
      // 备注迁移：将旧 remark 转为 remarks 数组
      if (todo.remark && !todo.remarks) {
        todo.remarks = [{ id: Date.now() + Math.random(), text: todo.remark }];
        delete todo.remark;
        changed = true;
      } else if (!todo.remarks) {
        todo.remarks = [];
        changed = true;
      }
      // 确保 remarks 是数组
      if (!Array.isArray(todo.remarks)) {
        todo.remarks = [];
        changed = true;
      }
      // 旧数据转换
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
      } else {
        // 清理无效提醒（时间为空或 yearly 的 repeatParam 无效）
        const originalLength = todo.reminders.length;
        todo.reminders = todo.reminders.filter(rem => {
          if (!rem.time || rem.time.trim() === '') return false;
          if (rem.type === 'yearly' && (!rem.repeatParam || typeof rem.repeatParam !== 'string' || !rem.repeatParam.includes('-'))) return false;
          if (rem.type === 'weekly' && (rem.repeatParam === undefined || rem.repeatParam < 0 || rem.repeatParam > 6)) return false;
          if (rem.type === 'monthly' && (!rem.repeatParam || rem.repeatParam < 1 || rem.repeatParam > 31)) return false;
          return true;
        });
        if (todo.reminders.length !== originalLength) changed = true;
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

// 创建系统托盘
function createTray() {
  // 托盘图标，支持 .png 或 .ico
  const iconPath = path.join(__dirname, '../public/icon.ico');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示日历',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    {
      label: '隐藏日历',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('绿能桌面日历');
  tray.setContextMenu(contextMenu);

  // 左键单击切换显示/隐藏
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
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
    skipTaskbar: true,   // 防止出现在任务栏中
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

  // 窗口关闭时，隐藏到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

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

// 退出应用时，标记为正在退出，允许正常关闭窗口并清除托盘
app.on('before-quit', () => {
  app.isQuitting = true;
  if (tray) {
    tray.destroy();
    tray = null;
  }
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

// IPC：导出 Excel
ipcMain.handle('export-to-excel', async (event, todosData) => {
  try {
    const data = todosData.map((item, index) => ({
      '序号': index + 1,
      '待办事项': item.text,
      '创建时间': item.createdAt || '',
      '完成时间': item.completedAt || '',
      '备注': item.remark || ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '待办事项');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const { filePath } = await dialog.showSaveDialog({
      title: '保存待办事项',
      defaultPath: `待办事项_${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
    });
    if (filePath) {
      fs.writeFileSync(filePath, buffer);
      return { success: true, path: filePath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    console.error('导出失败', error);
    return { success: false, error: error.message };
  }
});