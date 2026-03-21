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
    jobs.get(todoId).cancel();
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
    jobs.get(todoId).cancel();
    jobs.delete(todoId);
  }
}

module.exports = {
  initReminder,
  scheduleReminder,
  cancelReminder
};