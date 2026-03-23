const schedule = require('node-schedule');
const { Notification } = require('electron');

// 存储所有调度任务，key 为 `${todoId}_${reminderId}`
const jobs = new Map();

/**
 * 初始化所有提醒（应用启动时调用）
 * @param {ElectronStore} store - electron-store 实例
 * @param {Electron.BrowserWindow} win - 主窗口对象
 */
function initReminder(store, win) {
  const todosMap = store.get('todos') || {};
  for (const date in todosMap) {
    const todos = todosMap[date];
    if (!Array.isArray(todos)) continue;
    todos.forEach(todo => {
      if (todo.reminders && todo.reminders.length) {
        todo.reminders.forEach(reminder => {
          scheduleReminder(date, todo, reminder, win);
        });
      }
    });
  }
}

/**
 * 调度一个提醒规则
 * @param {Object} todo - 待办对象
 * @param {Object} reminder - 提醒规则对象
 * @param {Electron.BrowserWindow} win - 主窗口
 */
function scheduleReminder(date, todo, reminder, win) {
  // 关键修复：检查 time 字段是否有效
  if (!reminder.time || reminder.time.trim() === '') {
    return;
  }
  const jobKey = `${date}_${todo.id}_${reminder.id}`;
  // 取消已存在的相同规则的任务
  if (jobs.has(jobKey)) {
    jobs.get(jobKey).cancel();
    jobs.delete(jobKey);
  }
  // 如果规则未启用，则不调度
  if (!reminder.enabled) return;

  let rule;
  if (reminder.type === 'single') {
    const dt = parseLocalDateTime(reminder.time);
    if (isNaN(dt.getTime()) || dt <= new Date()) {
      // 时间无效或已过期，不调度
      return;
    }
    rule = dt;
  } else {
    const cron = reminderToCron(reminder.type, reminder.time);
    if (!cron) return;
    rule = cron;
  }

  const job = schedule.scheduleJob(rule, () => {
    triggerReminder(todo, reminder, win);
  });
  jobs.set(jobKey, job);
}

/**
 * 将重复类型转换为 cron 表达式
 * @param {string} type - 'daily' | 'weekly' | 'monthly' | 'yearly'
 * @param {string} timeStr - 'HH:MM' 格式的时间字符串
 * @returns {string|null} cron 表达式
 */
function reminderToCron(type, timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  if (isNaN(hour) || isNaN(minute)) return null;
  const sec = 0;
  switch (type) {
    case 'daily':
      return `${sec} ${minute} ${hour} * * *`;
    case 'weekly':
      // 每周日 0 点（星期天为 0，星期一为 1，依此类推）
      return `${sec} ${minute} ${hour} * * 0`;
    case 'monthly':
      // 每月 1 号
      return `${sec} ${minute} ${hour} 1 * *`;
    case 'yearly':
      // 每年 1 月 1 日
      return `${sec} ${minute} ${hour} 1 1 *`;
    default:
      return null;
  }
}

/**
 * 解析 datetime-local 字符串为本地时间 Date 对象
 * @param {string} str - 'YYYY-MM-DDTHH:MM'
 * @returns {Date}
 */
function parseLocalDateTime(str) {
  const [datePart, timePart] = str.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  // 注意：月份从 0 开始
  return new Date(year, month - 1, day, hour, minute);
}

/**
 * 触发提醒：窗口闪烁、播放声音、显示通知、处理稍后/完成
 * @param {Object} todo - 待办对象
 * @param {Object} reminder - 触发此提醒的规则
 * @param {Electron.BrowserWindow} win - 主窗口
 */
function triggerReminder(todo, reminder, win) {
  // 1. 窗口闪烁
  if (win && !win.isDestroyed()) {
    win.flashFrame(true);
    setTimeout(() => {
      if (win && !win.isDestroyed()) win.flashFrame(false);
    }, 3000);
  }

  // 2. 发送事件让渲染进程播放声音
  if (win && !win.isDestroyed()) {
    win.webContents.send('play-sound');
  }

  // 3. 创建系统通知（带两个操作按钮）
  const notification = new Notification({
    title: '待办提醒',
    body: todo.text,
    silent: false,
    actions: [
      { type: 'button', text: '稍后提醒' },
      { type: 'button', text: '完成' }
    ]
  });

  notification.on('action', (event, index) => {
    if (index === 0) {
      // 稍后提醒
      snoozeReminder(todo, reminder, win);
    } else if (index === 1) {
      // 标记完成
      if (win && !win.isDestroyed()) {
        win.webContents.send('mark-todo-complete', todo.id);
      }
    }
  });

  notification.show();
}

/**
 * 稍后提醒：5 分钟后再次提醒
 * @param {Object} todo - 待办对象
 * @param {Object} originalReminder - 原始提醒规则（用于稍后）
 * @param {Electron.BrowserWindow} win - 主窗口
 */
function snoozeReminder(todo, originalReminder, win) {
  const delay = 5 * 60 * 1000; // 5分钟
  setTimeout(() => {
    triggerReminder(todo, originalReminder, win);
  }, delay);
}

function cancelJobsByDate(date) {
  const prefix = `${date}_`;
  for (const [key, job] of jobs.entries()) {
    if (key.startsWith(prefix)) {
      job.cancel();
      jobs.delete(key);
    }
  }
}

/**
 * 取消一个特定的提醒任务
 * @param {number|string} todoId - 待办ID
 * @param {string} reminderId - 提醒规则ID
 */
function cancelReminder(todoId, reminderId) {
  const jobKey = `${todoId}_${reminderId}`;
  if (jobs.has(jobKey)) {
    jobs.get(jobKey).cancel();
    jobs.delete(jobKey);
  }
}

module.exports = {
  initReminder,
  scheduleReminder,
  cancelReminder,
  // 我们也可以将 jobs 导出以便 main.js 访问
  getJobs: () => jobs,
  // 取消所有任务
  cancelJobsByDate
};