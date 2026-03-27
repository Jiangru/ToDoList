const schedule = require('node-schedule');
const { Notification } = require('electron');

// 存储所有调度任务，key 为 `${todoId}_${reminderId}`
const jobs = new Map();
let globalStore = null; // 用于在 triggerReminder 中获取数据

/**
 * 初始化所有提醒（应用启动时调用）
 * @param {ElectronStore} store - electron-store 实例
 * @param {Electron.BrowserWindow} win - 主窗口对象
 */
function initReminder(store, win) {
  globalStore = store; // 保存 store 引用，供 triggerReminder 使用
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
 * @param {string} date - 待办所在日期 YYYY-MM-DD
 * @param {Object} todo - 待办对象
 * @param {Object} reminder - 提醒规则对象
 * @param {Electron.BrowserWindow} win - 主窗口
 */
function scheduleReminder(date, todo, reminder, win) {
  // 如果待办已完成，则不调度任何提醒
  if (todo.completed) {
    console.log(`待办 "${todo.text}" 已完成，跳过提醒调度`);
    return;
  }
  // 关键修复：严格校验 time 字段
  if (!reminder.time || typeof reminder.time !== 'string' || reminder.time.trim() === '') {
    console.warn(`提醒规则 ${reminder.id} 缺少有效时间，跳过调度`);
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
    const cron = reminderToCron(reminder.type, reminder.time, reminder.repeatParam);
    if (!cron) return;
    rule = cron;
  }

  const job = schedule.scheduleJob(rule, () => {
    triggerReminder(todo, reminder, win);
  });
  jobs.set(jobKey, job);
}

/**
 * 生成 cron 表达式
 * @param {string} type - 'daily' | 'weekly' | 'monthly' | 'yearly'
 * @param {string} timeStr - 'HH:MM'
 * @param {any} repeatParam - 根据类型不同存储：weekly: 0-6 (周日-周六)；monthly: 1-31；yearly: 'MM-DD'
 */
function reminderToCron(type, timeStr, repeatParam) {
  // 增加防御
  if (!timeStr || typeof timeStr !== 'string') {
    console.warn(`提醒时间无效: ${timeStr}`);
    return null;
  } else if (type === 'yearly' && !repeatParam) {
    console.warn(`yearly 提醒缺少重复参数: ${repeatParam}`);
    return null;
  }
  const parts = timeStr.split(':');
  if (parts.length !== 2) {
    console.warn(`时间格式错误: ${timeStr}`);
    return null;
  }
  const [hour, minute] = parts.map(Number);
  if (isNaN(hour) || isNaN(minute)) return null;
  const sec = 0;

  switch (type) {
    case 'daily':
      return `${sec} ${minute} ${hour} * * *`;
    case 'weekly': {
      const dayOfWeek = repeatParam;
      if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) return null;
      return `${sec} ${minute} ${hour} * * ${dayOfWeek}`;
    }
    case 'monthly': {
      const dayOfMonth = repeatParam;
      if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return null;
      return `${sec} ${minute} ${hour} ${dayOfMonth} * *`;
    }
    case 'yearly': {
      // 关键修复：确保 repeatParam 存在且为字符串
      if (!repeatParam || typeof repeatParam !== 'string') return null;
      const [month, day] = repeatParam.split('-').map(Number);
      if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
      return `${sec} ${minute} ${hour} ${day} ${month} *`;
    }
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
  // 防御：确保 str 是有效的非空字符串
  if (!str || typeof str !== 'string' || str.trim() === '') {
    return new Date(NaN); // 返回无效日期
  }
  // 检查是否包含 'T'
  if (!str.includes('T')) {
    return new Date(NaN);
  }
  const [datePart, timePart] = str.split('T');
  if (!datePart || !timePart) {
    return new Date(NaN);
  }
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
    return new Date(NaN);
  }
  return new Date(year, month - 1, day, hour, minute);
}

/**
 * 触发提醒：窗口闪烁、播放声音、显示通知、处理稍后/完成
 * @param {Object} todo - 待办对象
 * @param {Object} reminder - 触发此提醒的规则
 * @param {Electron.BrowserWindow} win - 主窗口
 */
function triggerReminder(todo, reminder, win) {
  // 如果待办已完成，则忽略提醒
  if (todo.completed) {
    console.log(`待办 "${todo.text}" 已完成，忽略提醒`);
    return;
  }

  // 获取待办所在的日期和序号
  let dateStr = '';
  let index = -1;
  if (globalStore) {
    const todosMap = globalStore.get('todos') || {};
    for (const date in todosMap) {
      const dayTodos = todosMap[date];
      if (Array.isArray(dayTodos)) {
        const foundIndex = dayTodos.findIndex(t => t.id === todo.id);
        if (foundIndex !== -1) {
          dateStr = date;
          index = foundIndex + 1; // 序号从1开始
          break;
        }
      }
    }
  }

  // 构建通知标题和内容
  const title = '待办提醒';
  let body = todo.text;
  if (dateStr && index !== -1) {
    body = `【${dateStr} 第${index}条】 ${todo.text}`;
  } else {
    body = `【待办】 ${todo.text}`;
  }

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
    title,
    body,
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
 * @param {string} date - 日期字符串，例如 '2023-10-01'
 * @param {number|string} todoId - 待办ID
 * @param {string} reminderId - 提醒规则ID
 */
function cancelReminder(date, todoId, reminderId) {
  const jobKey = `${date}_${todoId}_${reminderId}`;
  if (jobs.has(jobKey)) {
    jobs.get(jobKey).cancel();
    jobs.delete(jobKey);
  }
}

module.exports = {
  initReminder,
  scheduleReminder,
  cancelReminder,
  cancelJobsByDate
};