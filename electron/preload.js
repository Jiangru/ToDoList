// import { contextBridge, ipcRenderer } from 'electron';
const { contextBridge, ipcRenderer } = require('electron');
console.log('preload loaded')

contextBridge.exposeInMainWorld('electronAPI', {
  getTodos: () => ipcRenderer.invoke('get-todos'),
  saveTodos: (date, todos) => ipcRenderer.invoke('save-todos', date, todos),
  openTodoEditor: (date) => ipcRenderer.invoke('open-todo-editor', date)
});