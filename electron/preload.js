const { contextBridge, ipcRenderer } = require('electron');

console.log('preload loaded');

contextBridge.exposeInMainWorld('electronAPI', {
  // 数据操作
  getTodos: () => ipcRenderer.invoke('get-todos'),
  saveTodos: (date, todos) => ipcRenderer.invoke('save-todos', date, todos),
  // 事件监听（由主进程触发）
  onPlaySound: (callback) => ipcRenderer.on('play-sound', callback),
  onMarkTodoComplete: (callback) => ipcRenderer.on('mark-todo-complete', callback),
  exportExcel: (todosData) => ipcRenderer.invoke('export-to-excel', todosData)  // 导出 Excel 文件
});