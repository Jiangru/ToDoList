<template>
  <div class="calendar-container" ref="calendarContainer">
    <FullCalendar
      ref="fullCalendarRef"
      :options="calendarOptions"
    />
    <button class="export-btn" @click="exportToExcel">📊 导出 Excel</button>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue';
import { formatDateTime } from '../utils/common.js';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import zhLocale from '@fullcalendar/core/locales/zh-cn';

const openEditor = inject('openEditor');
const todosMap = ref({});
const fullCalendarRef = ref(null);
const calendarContainer = ref(null);

// 加载所有待办数据
async function loadTodos() {
  if (!window.electronAPI?.getTodos) {
    console.error('electronAPI.getTodos 不可用');
    return;
  }
  const data = await window.electronAPI.getTodos();
  todosMap.value = data || {};
  if (fullCalendarRef.value?.getApi()) {
    fullCalendarRef.value.getApi().refetchEvents();
  }
  updateTips();
}

function refreshData() {
  loadTodos();
}

// 更新日期格子的提示元素和状态类（仅显示“双击创建”提示）
function updateTips() {
  const dayCells = document.querySelectorAll('.fc-daygrid-day');
  dayCells.forEach(cell => {
    const dateAttr = cell.getAttribute('data-date');
    if (!dateAttr) return;

    const hasTodos = todosMap.value[dateAttr] && todosMap.value[dateAttr].length > 0;

    if (hasTodos) {
      cell.classList.add('has-todos');
      cell.classList.remove('no-todos');
    } else {
      cell.classList.add('no-todos');
      cell.classList.remove('has-todos');
    }

    let tipEl = cell.querySelector('.double-click-tip');
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'double-click-tip';
      tipEl.textContent = '双击创建';
      cell.appendChild(tipEl);
    }
  });
}

// 日历配置
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
  events: (fetchInfo, successCallback) => {
    const events = [];
    for (const date in todosMap.value) {
      const todos = todosMap.value[date];
      if (Array.isArray(todos)) {
        todos.forEach(todo => {
          events.push({
            id: todo.id,
            title: todo.text,
            start: date,
            allDay: true,
            extendedProps: {
              todo: todo,
              date: date
            }
          });
        });
      }
    }
    successCallback(events);
  },
  eventContent: (arg) => {
    const todo = arg.event.extendedProps.todo;
    const todoText = arg.event.title;
    const remark = todo.remark || '';
    const container = document.createElement('div');
    container.className = 'custom-todo-item';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'todo-title';
    titleSpan.textContent = todoText;
    if (todo.completed) {
      titleSpan.style.textDecoration = 'line-through';
    }
    container.appendChild(titleSpan);

    if (remark) {
      const remarkSpan = document.createElement('span');
      remarkSpan.className = 'todo-remark';
      remarkSpan.textContent = remark;
      container.appendChild(remarkSpan);
    }

    return { domNodes: [container] };
  },
  eventClick: (info) => {
    const date = info.event.extendedProps.date;
    const todos = todosMap.value[date] || [];
    openEditor(date, todos);
  },
  dateClick: (info) => {
    const clickTime = Date.now();
    if (!window._lastClick) {
      window._lastClick = { dateStr: null, time: 0 };
    }
    const last = window._lastClick;
    const isDoubleClick = (info.dateStr === last.dateStr) && (clickTime - last.time < 300);
    if (isDoubleClick) {
      const todos = todosMap.value[info.dateStr] || [];
      openEditor(info.dateStr, todos);
    }
    window._lastClick = { dateStr: info.dateStr, time: clickTime };
  },
  viewDidMount: (view) => {
    const titleEl = view.el.querySelector('.fc-toolbar-title');
    if (!titleEl) return;

    const currentDate = view.getCurrentData().currentDate;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    titleEl.innerHTML = '';
    titleEl.style.display = 'flex';
    titleEl.style.gap = '8px';
    titleEl.style.cursor = 'default';

    const monthSpan = document.createElement('span');
    monthSpan.textContent = `${month + 1}月`;
    monthSpan.style.cursor = 'pointer';
    monthSpan.style.padding = '0 4px';
    monthSpan.style.borderRadius = '4px';
    monthSpan.style.transition = 'background 0.2s';
    monthSpan.onmouseenter = () => { monthSpan.style.backgroundColor = 'rgba(255,255,255,0.2)'; };
    monthSpan.onmouseleave = () => { monthSpan.style.backgroundColor = 'transparent'; };
    monthSpan.onclick = (e) => {
      e.stopPropagation();
      const newMonth = prompt('请输入月份（1-12）', month + 1);
      if (newMonth && !isNaN(newMonth) && newMonth >= 1 && newMonth <= 12) {
        const calendarApi = fullCalendarRef.value?.getApi();
        if (calendarApi) {
          const newDate = new Date(year, parseInt(newMonth) - 1, 1);
          calendarApi.gotoDate(newDate);
        }
      }
    };

    const yearSpan = document.createElement('span');
    yearSpan.textContent = `${year}年`;
    yearSpan.style.cursor = 'pointer';
    yearSpan.style.padding = '0 4px';
    yearSpan.style.borderRadius = '4px';
    yearSpan.style.transition = 'background 0.2s';
    yearSpan.onmouseenter = () => { yearSpan.style.backgroundColor = 'rgba(255,255,255,0.2)'; };
    yearSpan.onmouseleave = () => { yearSpan.style.backgroundColor = 'transparent'; };
    yearSpan.onclick = (e) => {
      e.stopPropagation();
      const newYear = prompt('请输入年份（例如 2025）', year);
      if (newYear && !isNaN(newYear) && newYear.length === 4) {
        const calendarApi = fullCalendarRef.value?.getApi();
        if (calendarApi) {
          const currentDate = calendarApi.getDate();
          currentDate.setFullYear(parseInt(newYear));
          calendarApi.gotoDate(currentDate);
        }
      }
    };

    titleEl.appendChild(monthSpan);
    titleEl.appendChild(yearSpan);
  }
};

async function exportToExcel() {
  const allTodos = [];
  for (const date in todosMap.value) {
    const dayTodos = todosMap.value[date];
    if (Array.isArray(dayTodos)) {
      dayTodos.forEach(todo => {
        allTodos.push({
          text: todo.text,
          createdAt: formatDateTime(todo.createdAt),   // 格式化
          completedAt: formatDateTime(todo.completedAt), // 格式化
          remark: todo.remark
        });
      });
    }
  }
  if (allTodos.length === 0) {
    alert('没有待办事项可导出');
    return;
  }
  const result = await window.electronAPI.exportExcel(allTodos);
  if (result.success) {
    alert(`导出成功！文件已保存至：${result.path}`);
  } else if (result.canceled) {
    // 用户取消，不提示
  } else {
    alert('导出失败：' + (result.error || '未知错误'));
  }
}

onMounted(() => {
  loadTodos();
});

defineExpose({ refreshData });
</script>

<style lang="scss" scoped>
.calendar-container {
  width: 100%;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  -webkit-app-region: no-drag;
  position: relative;

  :deep(.fc) {
    --fc-page-bg-color: transparent;
    --fc-border-color: rgba(255, 255, 255, 0.3);
    background: transparent;
    color: white;

    .fc-scrollgrid,
    .fc-scrollgrid-section,
    .fc-daygrid-body {
      background: transparent;
    }

    .fc-toolbar {
      -webkit-app-region: drag;
      cursor: grab;
      padding: 8px 12px;

      &:active {
        cursor: grabbing;
      }

      button, a, .fc-button, .fc-toolbar-chunk button,
      .fc-toolbar-title span {
        -webkit-app-region: no-drag;
        cursor: pointer;
      }

      .fc-toolbar-title {
        -webkit-app-region: drag;
        cursor: grab;
      }
    }

    .custom-todo-item {
      background: rgba(255, 193, 7, 0.2);
      border-left: 3px solid #ffc107;
      font-size: 12px;
      padding: 2px 4px;
      margin: 1px 0;
      border-radius: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: rgba(255, 193, 7, 0.4);
      }
    }

    .fc-daygrid-day-events {
      max-height: 80px;
      overflow-y: hidden;          // 默认隐藏滚动条
      transition: overflow-y 0.2s;
    }

    // 鼠标悬停时显示滚动条
    .fc-daygrid-day:hover .fc-daygrid-day-events {
      overflow-y: auto;
    }

    // 自定义滚动条样式（可选，更美观）
    .fc-daygrid-day-events::-webkit-scrollbar {
      width: 4px;
    }
    .fc-daygrid-day-events::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
    }
    .fc-daygrid-day-events::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
    }
    .fc-daygrid-day-events::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }

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
      position: relative;
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

    .fc-col-header-cell {
      background: rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .fc-col-header-cell-cushion {
      color: white;
    }

    .double-click-tip {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1;
      display: none;
    }

    .fc-daygrid-day.no-todos:hover .double-click-tip {
      display: block;
    }

    .fc-daygrid-day.has-todos .double-click-tip {
      display: none !important;
    }
  }
  :deep(.custom-todo-item) {
    display: flex;
    flex-direction: column;
    background: rgba(255, 193, 7, 0.2);
    border-left: 3px solid #ffc107;
    font-size: 12px;
    padding: 2px 4px;
    margin: 1px 0;
    border-radius: 3px;
    cursor: pointer;
    transition: background 0.2s;
    white-space: normal;
    word-break: break-word;

    &:hover {
      background: rgba(255, 193, 7, 0.4);
    }

    .todo-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .todo-remark {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.7);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
  }
  .export-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    -webkit-app-region: no-drag;
    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }

}
</style>