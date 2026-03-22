const schedule = require('node-schedule');
const { Notification } = require('electron');

const jobs = new Map();

function initReminder(store, win) {
  const todosMap = store.get('todos') || {};
  for (const date in todosMap) {
    const todos = todosMap[date];
    todos.forEach(todo => {
      if (todo.reminder && !todo.completed) {
        scheduleReminder(todo.id, todo.reminder, todo.text, win);
      }
    });
  }
}

function scheduleReminder(todoId, reminderTime, content, win) {
  if (jobs.has(todoId)) {
    const existing = jobs.get(todoId);
    if (existing && typeof existing.cancel === 'function') {
      existing.cancel();
    }
    jobs.delete(todoId);
  }
  const job = schedule.scheduleJob(new Date(reminderTime), () => {
    new Notification({
      title: '待办提醒',
      body: content,
      silent: false
    }).show();
    if (win && !win.isDestroyed()) {
      win.webContents.send('reminder-triggered', { todoId, content });
    }
  });
  jobs.set(todoId, job);
}

function cancelReminder(todoId) {
  if (jobs.has(todoId)) {
    const job = jobs.get(todoId);
    if (job && typeof job.cancel === 'function') {
      job.cancel();
    }
    jobs.delete(todoId);
  }
}

module.exports = {
  initReminder,
  scheduleReminder,
  cancelReminder
};