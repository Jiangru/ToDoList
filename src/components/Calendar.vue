<template>
  <div class="calendar-container">
    <FullCalendar
      ref="fullCalendar"
      :options="calendarOptions"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import zhLocale from '@fullcalendar/core/locales/zh-cn';  // 引入中文语言包
// import { getTodosForDate } from '../store/todos'; // 从主进程获取

const openEditor = inject('openEditor');
const todosMap = ref({});

// 加载所有待办数据
async function loadTodos() {
  const data = await window.electronAPI.getTodos();
  todosMap.value = data || {};
}

// 获取某一天的待办数量，用于日历上显示徽章
function getEventForDate(date) {
  const dateStr = date.toISOString().slice(0,10);
  const todos = todosMap.value[dateStr] || [];
  if (todos.length === 0) return [];
  // 返回一个虚拟事件，显示待办数量
  return [{
    title: `${todos.length} 项待办`,
    start: dateStr,
    display: 'background',
    color: 'rgba(255,193,7,0.3)',
    classNames: ['todo-badge']
  }];
}

const calendarOptions = {
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  locale: zhLocale, 
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: ''
  },
  height: 'auto',
  dateClick: (info) => {
    // 单击也可以处理，但要求双击，我们使用 dateDoubleClick
  },
  dateDoubleClick: (info) => {
    const dateStr = info.dateStr;
    const todos = todosMap.value[dateStr] || [];
    openEditor(dateStr, todos);
  },
  events: (fetchInfo, successCallback, failureCallback) => {
    // 动态生成事件：为每个有待办的日期显示标记
    const events = [];
    for (const date in todosMap.value) {
      if (todosMap.value[date].length > 0) {
        events.push({
          title: `${todosMap.value[date].length} 项`,
          start: date,
          display: 'background',
          color: 'rgba(255,193,7,0.3)'
        });
      }
    }
    successCallback(events);
  },
  eventContent: (arg) => {
    // 自定义显示
    return { html: `<div class="fc-event-badge">${arg.event.title}</div>` };
  }
};

onMounted(async () => {
  await loadTodos();
  // 监听主进程提醒触发（可选）
  window.electronAPI.onReminderTriggered?.((event, data) => {
    // 可以播放声音或闪烁窗口
    console.log('提醒触发', data);
  });
});
</script>

<style lang="scss" scoped>
.calendar-container {
  width: 100%;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  :deep(.fc) {
    background: transparent;
    color: white;
    .fc-toolbar-title {
      color: white;
    }
    .fc-button {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      &:hover {
        background: rgba(255,255,255,0.3);
      }
    }
    .fc-daygrid-day {
      background: rgba(0,0,0,0.3);
      border-color: rgba(255,255,255,0.2);
      &:hover {
        background: rgba(0,0,0,0.5);
      }
    }
    .fc-daygrid-day-number {
      color: white;
    }
    .fc-daygrid-day-top {
      justify-content: center;
    }
    .fc-day-today {
      background: rgba(255,255,0,0.2) !important;
    }
    .todo-badge {
      .fc-daygrid-day-events {
        text-align: center;
        .fc-event-badge {
          background: #ffc107;
          color: #333;
          font-size: 12px;
          border-radius: 12px;
          padding: 2px 6px;
          display: inline-block;
        }
      }
    }
  }
  :deep(.fc-col-header-cell) {
    color: #ffaa00;  // 星期字体颜色设置
  }
  :deep(.fc-col-header-cell.fc-day-sat) {
    color: aquamarine; // 星期六星期天颜色设置
  }
  :deep(.fc-col-header-cell.fc-day-sun) {
    color: aquamarine; // 星期六星期天颜色设置
  }
}
</style>