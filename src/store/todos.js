// src/store/todos.js
export async function getTodos() {
  return await window.electronAPI.getTodos();
}

export async function saveTodos(date, todos) {
  return await window.electronAPI.saveTodos(date, todos);
}