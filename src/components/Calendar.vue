<template>
  <div class="calendar-container">
    <FullCalendar ref="fullCalendarRef" :options="calendarOptions" />
    
    <div class="export-controls">
      <select v-model="exportYear" class="year-select">
        <option value="">全部年份</option>
        <option v-for="year in yearOptions" :key="year" :value="year">{{ year }}年</option>
      </select>
      <select v-model="exportMonth" class="month-select">
        <option value="">全部月份</option>
        <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
      </select>
      <button class="export-btn" @click="showIncompleteTodos" title="未完成待办">📋</button>
      <button class="export-btn" @click="exportToExcel" title="导出 Excel">📊</button>
      <button class="export-btn" @click="hideToTray" title="最小化到托盘">🔽</button>
    </div>

    <!-- 未完成待办模态框 -->
    <div v-if="showTodoModal" class="modal-overlay" @click.self="showTodoModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <span>未完成待办事项</span>
          <button class="close-modal-btn" @click="showTodoModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="incompleteTodos.length === 0" class="empty-tip">暂无未完成待办</div>
          <div v-else class="todo-list-modal">
            <div
              v-for="item in incompleteTodos"
              :key="item.todo.id"
              class="todo-modal-item"
              @click="openTodoEditor(item.date, item.todo.id)"
            >
              <span class="todo-date">{{ item.date }}</span>
              <span class="todo-index">第{{ item.index }}条</span>
              <span class="todo-text">{{ item.todo.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 年份选择浮窗 -->
    <Teleport to="body">
      <div
        v-if="showYearPicker"
        class="picker-popup year-picker"
        :style="{ left: pickerX + 'px', top: pickerY + 'px' }"
        @click.stop
      >
        <div class="picker-grid year-grid">
          <div
            v-for="year in yearList"
            :key="year"
            class="picker-item"
            :class="{ current: year === currentViewYear }"
            @click="jumpToYear(year)"
          >
            {{ year }}
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 月份选择浮窗 -->
    <Teleport to="body">
      <div
        v-if="showMonthPicker"
        class="picker-popup month-picker"
        :style="{ left: pickerX + 'px', top: pickerY + 'px' }"
        @click.stop
      >
        <div class="picker-grid month-grid">
          <div
            v-for="month in monthList"
            :key="month.num"
            class="picker-item"
            :class="{ current: month.num === currentViewMonth }"
            @click="jumpToMonth(month.num)"
          >
            {{ month.name }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, inject, nextTick, watch } from 'vue';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import zhLocale from '@fullcalendar/core/locales/zh-cn';
import { formatDateTime } from '../utils/common.js';

// ==================== 常量定义 ====================
const MONTHS = [
  { num: 1, name: '1月' }, { num: 2, name: '2月' }, { num: 3, name: '3月' },
  { num: 4, name: '4月' }, { num: 5, name: '5月' }, { num: 6, name: '6月' },
  { num: 7, name: '7月' }, { num: 8, name: '8月' }, { num: 9, name: '9月' },
  { num: 10, name: '10月' }, { num: 11, name: '11月' }, { num: 12, name: '12月' }
];
const YEAR_PICKER_SIZE = { width: 180, height: 160 };
const MONTH_PICKER_SIZE = { width: 240, height: 200 };

// ==================== 依赖注入 ====================
const openEditor = inject('openEditor');

// ==================== 响应式数据 ====================
const fullCalendarRef = ref(null);
const todosMap = shallowRef({});           // 使用 shallowRef 优化性能
const showTodoModal = ref(false);
const incompleteTodos = ref([]);
const exportYear = ref('');
const exportMonth = ref('');

// 浮窗状态
const showYearPicker = ref(false);
const showMonthPicker = ref(false);
const pickerX = ref(0);
const pickerY = ref(0);
const yearList = ref([]);
const monthList = ref(MONTHS);
const currentViewYear = ref(new Date().getFullYear());
const currentViewMonth = ref(new Date().getMonth() + 1);

// ==================== 计算属性 ====================
const yearOptions = computed(() => {
  const years = new Set();
  for (const date in todosMap.value) {
    const year = date.split('-')[0];
    if (year) years.add(year);
  }
  return Array.from(years).sort((a, b) => b - a);
});

// ==================== 数据操作 ====================
async function loadTodos() {
  if (!window.electronAPI?.getTodos) {
    console.error('electronAPI.getTodos 不可用');
    return;
  }
  const data = await window.electronAPI.getTodos();
  todosMap.value = data || {};
  fullCalendarRef.value?.getApi()?.refetchEvents();
  updateTips();
}

async function loadIncompleteTodos() {
  if (!window.electronAPI?.getTodos) return;
  const data = await window.electronAPI.getTodos();
  const result = [];
  for (const date in data) {
    const todos = data[date];
    if (Array.isArray(todos)) {
      todos.forEach((todo, idx) => {
        if (!todo.completed) {
          result.push({ date, todo, index: idx + 1 });
        }
      });
    }
  }
  incompleteTodos.value = result;
}

function refreshData() {
  loadTodos();
}

// ==================== UI 更新 ====================
function updateTips() {
  const dayCells = document.querySelectorAll('.fc-daygrid-day');
  dayCells.forEach(cell => {
    const dateAttr = cell.getAttribute('data-date');
    if (!dateAttr) return;

    const dayTodos = todosMap.value[dateAttr];
    const hasTodos = dayTodos && dayTodos.length > 0;
    const hasIncomplete = hasTodos && dayTodos.some(todo => !todo.completed);

    if (hasIncomplete) {
      cell.classList.add('has-incomplete-todos');
      cell.classList.remove('has-todos', 'no-todos');
    } else if (hasTodos) {
      cell.classList.add('has-todos');
      cell.classList.remove('has-incomplete-todos', 'no-todos');
    } else {
      cell.classList.add('no-todos');
      cell.classList.remove('has-todos', 'has-incomplete-todos');
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

// ==================== 自定义标题栏（年月浮窗触发器）====================
function injectCustomTitle(calendarApi) {
  const titleEl = document.querySelector('.fc-toolbar-title');
  if (!titleEl) return;

  const currentDate = calendarApi.getDate();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  currentViewYear.value = year;
  currentViewMonth.value = month;

  titleEl.innerHTML = '';
  titleEl.style.display = 'flex';
  titleEl.style.gap = '0px';
  titleEl.style.cursor = 'default';

  // 年份按钮
  const yearSpan = createTitleButton(`${year}年`, (e) => openYearPicker(e, year));
  // 月份按钮
  const monthSpan = createTitleButton(`${month}月`, (e) => openMonthPicker(e, year, month));

  titleEl.appendChild(yearSpan);
  titleEl.appendChild(monthSpan);
}

function createTitleButton(text, onClick) {
  const btn = document.createElement('span');
  btn.textContent = text;
  btn.style.cssText = `
    cursor: pointer;
    padding: 2px 6px;
    transition: background 0.2s;
    -webkit-app-region: no-drag;
  `;
  btn.onmouseenter = () => { btn.style.backgroundColor = 'rgba(255,255,255,0.15)'; };
  btn.onmouseleave = () => { btn.style.backgroundColor = 'transparent'; };
  btn.onclick = (e) => {
    e.stopPropagation();
    onClick(e);
  };
  return btn;
}

// ==================== 浮窗逻辑 ====================
function getPopupPosition(event, popupSize) {
  const { clientX, clientY } = event;
  let left = clientX + 10;
  let top = clientY + 10;
  if (left + popupSize.width > window.innerWidth) left = clientX - popupSize.width - 10;
  if (top + popupSize.height > window.innerHeight) top = clientY - popupSize.height - 10;
  return { left: Math.max(10, left), top: Math.max(10, top) };
}

function openYearPicker(event, currentYear) {
  const startYear = currentYear - 4;
  yearList.value = Array.from({ length: 9 }, (_, i) => startYear + i);
  const { left, top } = getPopupPosition(event, YEAR_PICKER_SIZE);
  pickerX.value = left;
  pickerY.value = top;
  showYearPicker.value = true;
  showMonthPicker.value = false;
}

function openMonthPicker(event, currentYear, currentMonth) {
  currentViewYear.value = currentYear;
  currentViewMonth.value = currentMonth;
  const { left, top } = getPopupPosition(event, MONTH_PICKER_SIZE);
  pickerX.value = left;
  pickerY.value = top;
  showMonthPicker.value = true;
  showYearPicker.value = false;
}

function closePickers() {
  showYearPicker.value = false;
  showMonthPicker.value = false;
}

function jumpToYear(year) {
  const calendarApi = fullCalendarRef.value?.getApi();
  if (calendarApi) {
    const currentDate = calendarApi.getDate();
    calendarApi.gotoDate(new Date(year, currentDate.getMonth(), 1));
  }
  closePickers();
}

function jumpToMonth(month) {
  const calendarApi = fullCalendarRef.value?.getApi();
  if (calendarApi) {
    const currentDate = calendarApi.getDate();
    calendarApi.gotoDate(new Date(currentDate.getFullYear(), month - 1, 1));
  }
  closePickers();
}

// 全局点击关闭浮窗（排除触发器与浮窗本身）
function handleGlobalClick(e) {
  const target = e.target.nodeType === Node.TEXT_NODE ? e.target.parentElement : e.target;
  if (target?.closest('.fc-toolbar-title span')) return; // 点击年月按钮不关闭
  if (target?.closest('.picker-popup')) return;          // 点击浮窗内部不关闭
  closePickers();
}

// ==================== 其他交互 ====================
function showIncompleteTodos() {
  loadIncompleteTodos();
  showTodoModal.value = true;
}

function openTodoEditor(date, todoId) {
  const todos = todosMap.value[date] || [];
  openEditor(date, todos, todoId);
  showTodoModal.value = false;
}

async function exportToExcel() {
  const allTodos = [];
  for (const date in todosMap.value) {
    const [year, month] = date.split('-');
    if (exportYear.value && exportYear.value !== year) continue;
    if (exportMonth.value && parseInt(exportMonth.value) !== parseInt(month)) continue;

    const dayTodos = todosMap.value[date];
    if (Array.isArray(dayTodos)) {
      dayTodos.forEach(todo => {
        let remarkText = '';
        if (todo.remarks?.length) {
          remarkText = todo.remarks.map(r => `【${r.text}】`).join('\n');
        } else if (todo.remark) {
          remarkText = `【${todo.remark}】`;
        }
        allTodos.push({
          text: todo.text,
          createdAt: formatDateTime(todo.createdAt),
          completedAt: formatDateTime(todo.completedAt),
          remark: remarkText
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
  } else if (!result.canceled) {
    alert('导出失败：' + (result.error || '未知错误'));
  }
}

function hideToTray() {
  window.electronAPI?.hideWindow?.() || console.error('electronAPI.hideWindow 不可用');
}

// ==================== 日历配置 ====================
const calendarOptions = {
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  locale: zhLocale,
  headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
  height: 'auto',
  events: (_, successCallback) => {
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
            extendedProps: { todo, date }
          });
        });
      }
    }
    successCallback(events);
  },
  eventContent: (arg) => {
    const todo = arg.event.extendedProps.todo;
    const container = document.createElement('div');
    container.className = 'custom-todo-item';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'todo-title';
    titleSpan.textContent = arg.event.title;
    if (todo.completed) titleSpan.style.textDecoration = 'line-through';
    container.appendChild(titleSpan);
     // 备注图标（有备注时显示）
    const hasRemark = (todo.remarks && todo.remarks.length > 0) || todo.remark;
    if (hasRemark) {
      const remarkIcon = document.createElement('span');
      remarkIcon.className = 'todo-remark-icon';
      remarkIcon.textContent = '📝';
      let remarkCount = todo.remarks?.length || (todo.remark ? 1 : 0);
      remarkIcon.title = `${remarkCount}条备注`;
      container.appendChild(remarkIcon);
    }

    // 提醒图标（有提醒规则时显示）
    const hasReminder = todo.reminders && todo.reminders.length > 0;
    if (hasReminder) {
      const reminderIcon = document.createElement('span');
      reminderIcon.className = 'todo-reminder-icon';
      reminderIcon.textContent = '⏰';
      reminderIcon.title = '已设置提醒';
      container.appendChild(reminderIcon);
    }
    return { domNodes: [container] };
  },
  eventClick: (info) => {
    const { date, todos } = info.event.extendedProps;
    openEditor(date, todosMap.value[date] || []);
  },
  dateClick: (info) => {
    const now = Date.now();
    if (!window._lastClick) window._lastClick = { dateStr: null, time: 0 };
    const last = window._lastClick;
    if (info.dateStr === last.dateStr && now - last.time < 300) {
      openEditor(info.dateStr, todosMap.value[info.dateStr] || []);
    }
    window._lastClick = { dateStr: info.dateStr, time: now };
  },
  viewDidMount: (view) => injectCustomTitle(view.view.calendar),
  datesSet: () => {
    const calendarApi = fullCalendarRef.value?.getApi();
    if (calendarApi) injectCustomTitle(calendarApi);
    nextTick(updateTips);
  }
};

// ==================== 生命周期 ====================
onMounted(() => {
  loadTodos();
  window.addEventListener('click', handleGlobalClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleGlobalClick);
});

// 监听导出筛选，自动跳转日历
watch([exportYear, exportMonth], ([year, month]) => {
  const calendarApi = fullCalendarRef.value?.getApi();
  if (!calendarApi) return;
  const now = new Date();
  let targetYear = year ? parseInt(year) : now.getFullYear();
  let targetMonth = month ? parseInt(month) - 1 : now.getMonth();
  calendarApi.gotoDate(new Date(targetYear, targetMonth, 1));
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
    }

    .custom-todo-item {
      display: flex;
      align-items: center;
      gap: 4px;  // 图标与文本间距
      background: rgba(255, 193, 7, 0.2);
      border-left: 3px solid #ffc107;
      font-size: 12px;
      padding: 2px 4px;
      margin: 1px 0;
      border-radius: 0px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: rgba(255, 193, 7, 0.4);
      }
      .todo-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .todo-remark-icon,
      .todo-reminder-icon {
        font-size: 10px;
        opacity: 0.8;
        cursor: default;
        flex-shrink: 0;
      }
    }

    .fc-daygrid-day-events {
      max-height: 80px;
      overflow-y: hidden;
      transition: overflow-y 0.2s;
    }

    .fc-daygrid-day:hover .fc-daygrid-day-events {
      overflow-y: auto;
    }

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
      position: relative;
      left: -100%;
      color: white;
    }
    .fc-button {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 0 6px;
      border-radius: 0;
      &:hover {
        background: rgba(255,255,255,0.3);
      }
    }
    .fc-today-button {
      padding: 2px 6px;
      color: white;
    }

    .fc-daygrid-day {
      background: rgba(0,0,0,0.3);
      border-color: rgba(255,255,255,0.2);
      &:hover {
        background: rgba(0,0,0,0.5);
      }
      position: relative;
      transition: background 0.2s;
    }

    .fc-daygrid-day.has-incomplete-todos {
      background: rgba(255, 80, 80, 0.3);
      &:hover {
        background: rgba(255, 80, 80, 0.5);
      }
    }

    .fc-daygrid-day.has-todos {
      background: rgba(0, 128, 0, 0.2);
      &:hover {
        background: rgba(0, 128, 0, 0.4);
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
      border-radius: 0px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1;
      display: none;
    }

    .fc-daygrid-day.no-todos:hover .double-click-tip {
      display: block;
    }

    .fc-daygrid-day.has-todos .double-click-tip,
    .fc-daygrid-day.has-incomplete-todos .double-click-tip {
      display: none !important;
    }
  }

  .export-controls {
    position: absolute;
    top: 30px;
    right: 20px;
    z-index: 10;
    display: flex;
    gap: 8px;
    -webkit-app-region: no-drag;

    select {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 0px;
      font-size: 12px;
      cursor: pointer;
      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      option {
        background: #2c2c2e;
        color: white;
      }
    }

    .export-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 0px;
      cursor: pointer;
      font-size: 12px;
      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    }
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  -webkit-app-region: no-drag;
}

.modal-card {
  width: 500px;
  max-width: 90vw;
  background: #2c2c2e;
  border-radius: 0px;
  overflow: hidden;
  color: white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1c1c1e;
  border-bottom: 1px solid #3a3a3c;
}

.close-modal-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
}

.modal-body {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.todo-list-modal {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-modal-item {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .todo-date {
    font-size: 12px;
    color: #ffc107;
    font-weight: bold;
  }
  .todo-index {
    font-size: 11px;
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 6px;
    border-radius: 0px;
  }
  .todo-text {
    flex: 1;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.empty-tip {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 20px;
}
</style>

<style lang="scss">
/* 浮窗样式（非 scoped，确保 Teleport 生效） */
.picker-popup {
  position: fixed;
  background: rgba(40, 40, 45, 0.98);
  backdrop-filter: blur(8px);
  border-radius: 0px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  z-index: 3000;
  padding: 12px;
  min-width: 160px;
  
  .picker-grid {
    display: grid;
    gap: 8px;
    &.year-grid { grid-template-columns: repeat(3, 1fr); }
    &.month-grid { grid-template-columns: repeat(4, 1fr); }
  }
  
  .picker-item {
    text-align: center;
    padding: 8px 4px;
    border-radius: 0px;
    cursor: pointer;
    font-size: 14px;
    color: #e0e0e0;
    transition: all 0.2s ease;
    background: rgba(255, 255, 255, 0.05);
    &:hover {
      background: rgba(255, 193, 7, 0.3);
      color: white;
      transform: scale(1.02);
    }
    &.current {
      background: #ffc107;
      color: #1e1e1e;
      font-weight: bold;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
  }
}
.year-picker { width: 180px; }
.month-picker { width: 240px; }
</style>