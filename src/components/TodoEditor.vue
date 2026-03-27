<template>
  <div class="editor-overlay" @click.self="close">
    <div class="editor-card">
      <div class="header">
        <span>编辑待办 - {{ date }}</span>
        <button class="close-btn" @click="close">✕</button>
      </div>
      <div class="todo-list">
        <div v-for="(todo, idx) in localTodos" :key="todo.id" class="todo-item-wrapper">
          <div class="todo-item">
            <input type="checkbox" v-model="todo.completed" @change="save" class="todo-checkbox" />
            <textarea
              v-model="todo.text"
              placeholder="待办内容"
              @blur="save"
              @input="autoResize($event, idx)"
              class="todo-text"
              :class="{ completed: todo.completed }"
              rows="1"
            ></textarea>
            <button class="delete-btn" @click="deleteTodo(idx)" title="删除待办">🗑️</button>
            <button
              class="reminder-toggle"
              @click="toggleReminders(idx)"
              :title="hasReminders(todo) ? '编辑提醒' : '添加提醒'"
            >
              ⏰
            </button>
          </div>
          <!-- 新增：最后提醒摘要 -->
          <div v-if="todo.reminders && todo.reminders.length > 0" class="reminder-summary">
            <span class="reminder-summary-icon">⏰</span>
            <span class="reminder-summary-text">最后提醒：{{ getLastReminderText(todo) }}</span>
          </div>

          <!-- 备注列表区域 -->
          <div class="remarks-container">
            <div class="remarks-header">
              <span>📝 备注</span>
              <button class="add-remark-btn" @click="addRemark(todo, idx)">+ 添加备注</button>
            </div>
            <div v-if="todo.remarks && todo.remarks.length" class="remarks-list">
              <div v-for="(rem, rIdx) in todo.remarks" :key="rem.id" class="remark-item">
                <div v-if="!rem.isEditing" class="remark-display" @dblclick="startEditRemark(todo, idx, rIdx)">
                  <span class="remark-text" :title="rem.text">{{ rem.text }}</span>
                  <button class="delete-remark-btn" @click.stop="deleteRemark(todo, rIdx)" title="删除备注">✖</button>
                </div>
                <input
                  v-else
                  type="text"
                  v-model="rem.tempText"
                  placeholder="请输入备注"
                  @blur="saveRemark(todo, rIdx, $event)"
                  @keyup.enter="saveRemark(todo, rIdx, $event, true)"
                  class="remark-input"
                  :ref="el => setRemarkInputRef(idx, rIdx, el)"
                />
              </div>
            </div>
            <div v-else class="remarks-empty">暂无备注</div>
          </div>

          <!-- 提醒面板（不变） -->
          <div v-if="expandedReminderIdx === idx" class="reminders-panel">
            <div class="reminders-header">
              <span>⏰ 提醒设置</span>
              <button class="close-panel" @click="expandedReminderIdx = null">✕</button>
            </div>
            <div v-for="(rem, rIdx) in todo.reminders" :key="rem.id" class="reminder-item">
              <select v-model="rem.type" @change="handleTypeChange(rem)" class="reminder-type">
                <option value="single">单次提醒</option>
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
                <option value="yearly">每年</option>
              </select>

              <input
                v-if="rem.type === 'single'"
                type="datetime-local"
                v-model="rem.time"
                @change="save"
                class="reminder-time"
              />

              <template v-else>
                <input type="time" v-model="rem.time" @change="save" class="reminder-time" step="60" />

                <select v-if="rem.type === 'weekly'" v-model="rem.repeatParam" @change="save" class="reminder-param">
                  <option value="0">周日</option>
                  <option value="1">周一</option>
                  <option value="2">周二</option>
                  <option value="3">周三</option>
                  <option value="4">周四</option>
                  <option value="5">周五</option>
                  <option value="6">周六</option>
                </select>

                <input
                  v-if="rem.type === 'monthly'"
                  type="number"
                  v-model="rem.repeatParam"
                  min="1"
                  max="31"
                  step="1"
                  @change="save"
                  class="reminder-param"
                  placeholder="日期"
                />

                <div v-if="rem.type === 'yearly'" class="yearly-selector">
                  <select v-model="rem.repeatParamMonth" @change="updateYearlyParam(rem)" class="reminder-param">
                    <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
                  </select>
                  <select v-model="rem.repeatParamDay" @change="updateYearlyParam(rem)" class="reminder-param">
                    <option v-for="d in 31" :key="d" :value="d">{{ d }}日</option>
                  </select>
                </div>
              </template>

              <label class="reminder-enabled">
                <input type="checkbox" v-model="rem.enabled" @change="save" />
                启用
              </label>
              <button class="delete-reminder-btn" @click="deleteReminder(todo, rIdx)">✖</button>
            </div>
            <button class="add-reminder-btn" @click="addReminder(todo)">+ 添加提醒</button>
          </div>
        </div>
      </div>
      <div class="footer">
        <button class="add-btn" @click="addTodo">+ 添加待办</button>
        <button class="save-btn" @click="saveAndClose">完成</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, toRaw, nextTick } from "vue";

const props = defineProps({
  date: String,
  todos: Array,
});
const emit = defineEmits(["close", "save"]);

const localTodos = ref([]);
const expandedReminderIdx = ref(null);
const remarkInputRefs = ref({}); // 存储备注输入框引用

watch(
  () => props.todos,
  (newTodos) => {
    if (!newTodos) return;
    localTodos.value = newTodos.map((todo) => ({
      id: todo.id,
      text: todo.text || "",
      completed: todo.completed || false,
      createdAt: todo.createdAt || new Date().toISOString(),
      completedAt: todo.completedAt || null,
      remarks: Array.isArray(todo.remarks)
        ? todo.remarks.map(r => ({ ...r, isEditing: false, tempText: r.text }))
        : (todo.remark ? [{ id: Date.now() + Math.random(), text: todo.remark, isEditing: false, tempText: todo.remark }] : []),
      reminders: todo.reminders
        ? todo.reminders.map((r) => {
            if (r.type === 'yearly' && r.repeatParam) {
              const [month, day] = r.repeatParam.split('-');
              r.repeatParamMonth = parseInt(month);
              r.repeatParamDay = parseInt(day);
            }
            return { ...r };
          })
        : [],
    }));
    // 初始化所有 textarea 高度
    nextTick(() => {
      document.querySelectorAll('.todo-text').forEach((el, i) => {
        if (el && localTodos.value[i]) autoResizeTextarea(el);
      });
    });
  },
  { immediate: true, deep: true }
);

function setRemarkInputRef(todoIdx, remIdx, el) {
  if (!el) return;
  if (!remarkInputRefs.value[todoIdx]) remarkInputRefs.value[todoIdx] = {};
  remarkInputRefs.value[todoIdx][remIdx] = el;
}

function hasReminders(todo) {
  return todo.reminders && todo.reminders.length > 0;
}

function toggleReminders(idx) {
  expandedReminderIdx.value = expandedReminderIdx.value === idx ? null : idx;
}

function addTodo() {
  localTodos.value.push({
    id: Date.now() + Math.random(),
    text: '',
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    remarks: [],
    reminders: [],
  });
  nextTick(() => {
    const newTextarea = document.querySelector('.todo-list .todo-text:last-child');
    if (newTextarea) autoResizeTextarea(newTextarea);
  });
}

function deleteTodo(index) {
  localTodos.value.splice(index, 1);
  if (expandedReminderIdx.value === index) {
    expandedReminderIdx.value = null;
  } else if (expandedReminderIdx.value > index) {
    expandedReminderIdx.value--;
  }
  save();
}

function addReminder(todo) {
  if (!todo.reminders) todo.reminders = [];
  todo.reminders.push({
    id: `rem_${Date.now()}_${Math.random()}`,
    type: "single",
    time: "",
    enabled: true,
    repeatParam: null,
  });
  save();
}

function deleteReminder(todo, rIdx) {
  todo.reminders.splice(rIdx, 1);
  if (todo.reminders.length === 0 && expandedReminderIdx.value !== null) {
    expandedReminderIdx.value = null;
  }
  save();
}

function handleTypeChange(rem) {
  if (rem.type === 'weekly' && rem.repeatParam === undefined) rem.repeatParam = 0;
  if (rem.type === 'monthly' && rem.repeatParam === undefined) rem.repeatParam = 1;
  if (rem.type === 'yearly') {
    if (rem.repeatParamMonth === undefined) rem.repeatParamMonth = 1;
    if (rem.repeatParamDay === undefined) rem.repeatParamDay = 1;
    updateYearlyParam(rem);
  }
  save();
}

function updateYearlyParam(rem) {
  if (rem.repeatParamMonth && rem.repeatParamDay) {
    rem.repeatParam = `${rem.repeatParamMonth}-${rem.repeatParamDay}`;
    save();
  }
}

// 自动调整 textarea 高度
function autoResize(event, idx) {
  const target = event.target;
  autoResizeTextarea(target);
  save(); // 实时保存
}

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

// 备注操作
function addRemark(todo, todoIdx) {
  const newId = Date.now() + Math.random();
  const newRemark = {
    id: newId,
    text: '',
    isEditing: true,
    tempText: '',
  };
  todo.remarks.push(newRemark);
  nextTick(() => {
    const input = remarkInputRefs.value[todoIdx]?.[todo.remarks.length - 1];
    if (input) input.focus();
  });
}

function deleteRemark(todo, rIdx) {
  todo.remarks.splice(rIdx, 1);
  save();
}

function startEditRemark(todo, todoIdx, rIdx) {
  const remark = todo.remarks[rIdx];
  remark.isEditing = true;
  remark.tempText = remark.text;
  nextTick(() => {
    const input = remarkInputRefs.value[todoIdx]?.[rIdx];
    if (input) input.focus();
  });
}

function saveRemark(todo, rIdx, event, fromEnter = false) {
  const remark = todo.remarks[rIdx];
  if (!remark) return;

  if (event) event.stopPropagation();

  const newText = remark.tempText.trim();
  if (newText === '') {
    // 如果内容为空，删除该备注
    todo.remarks.splice(rIdx, 1);
  } else if (newText !== remark.text) {
    remark.text = newText;
    save(); // 仅当有变化时保存
  }
  remark.isEditing = false;
  remark.tempText = '';

  if (fromEnter && event) {
    event.target.blur();
  }
}

function save() {
  // 处理完成时间
  localTodos.value.forEach(todo => {
    if (todo.completed && !todo.completedAt) {
      todo.completedAt = new Date().toISOString();
    } else if (!todo.completed && todo.completedAt) {
      todo.completedAt = null;
    }
    // 清理备注内部编辑状态字段
    todo.remarks = todo.remarks.map(({ id, text }) => ({ id, text }));
  });

  const rawTodos = toRaw(localTodos.value).map((todo) => ({
    id: todo.id,
    text: todo.text,
    completed: todo.completed,
    createdAt: todo.createdAt,
    completedAt: todo.completedAt,
    remarks: todo.remarks,
    reminders: todo.reminders.map((r) => {
      const { repeatParamMonth, repeatParamDay, ...rest } = r;
      const reminderData = { ...rest };
      if (r.type === 'weekly' && r.repeatParam !== undefined) {
        reminderData.repeatParam = r.repeatParam;
      } else if (r.type === 'monthly' && r.repeatParam !== undefined) {
        reminderData.repeatParam = r.repeatParam;
      } else if (r.type === 'yearly' && r.repeatParam) {
        reminderData.repeatParam = r.repeatParam;
      }
      return reminderData;
    }),
  }));
  emit("save", props.date, rawTodos);
}

function saveAndClose() {
  save();
  close();
}

function getLastReminderText(todo) {
  if (!todo.reminders || todo.reminders.length === 0) return '';
  const lastReminder = todo.reminders[todo.reminders.length - 1];
  if (!lastReminder) return '';
  return formatReminderText(lastReminder);
}

function formatReminderText(reminder) {
  if (!reminder) return '';
  const typeMap = {
    single: '单次提醒',
    daily: '每天',
    weekly: '每周',
    monthly: '每月',
    yearly: '每年'
  };
  const typeText = typeMap[reminder.type] || reminder.type;
  let timeText = '';
  if (reminder.type === 'single') {
    timeText = reminder.time ? reminder.time.replace('T', ' ') : '';
  } else {
    timeText = reminder.time || '';
    if (reminder.type === 'weekly') {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const dayOfWeek = reminder.repeatParam;
      if (dayOfWeek !== undefined && weekdays[dayOfWeek]) {
        timeText = `${weekdays[dayOfWeek]} ${timeText}`;
      }
    } else if (reminder.type === 'monthly') {
      const day = reminder.repeatParam;
      if (day) timeText = `${day}日 ${timeText}`;
    } else if (reminder.type === 'yearly') {
      if (reminder.repeatParam) {
        const [month, day] = reminder.repeatParam.split('-');
        timeText = `${month}月${day}日 ${timeText}`;
      }
    }
  }
  return `${typeText} ${timeText}`.trim();
}

function close() {
  emit("close");
}
</script>

<style lang="scss" scoped>
.editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.editor-card {
  width: 560px;
  max-width: 90vw;
  background: #2c2c2e;
  border-radius: 12px;
  color: white;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  -webkit-app-region: no-drag;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1c1c1e;
  border-bottom: 1px solid #3a3a3c;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
}

.todo-list {
  padding: 16px;
  max-height: 500px;
  overflow-y: hidden;
  &:hover {
    overflow-y: auto;
  }
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
  }
}

.todo-item-wrapper {
  margin-bottom: 16px;
  border-bottom: 1px solid #3a3a3c;
  padding-bottom: 8px;
  &:last-child {
    border-bottom: none;
  }
}

.todo-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  width: 100%;

  .todo-checkbox {
    margin-top: 6px;
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .todo-text {
    flex: 2;
    background: transparent;
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
    color: #f4f4f5;
    font-size: 14px;
    line-height: 1.4;
    resize: none;
    overflow-y: hidden;
    transition: all 0.2s;
    font-family: inherit;

    &:focus {
      outline: none;
      background: rgba(255, 193, 7, 0.05);
    }

    &.completed {
      text-decoration: line-through;
      opacity: 0.7;
    }
  }

  .delete-btn, .reminder-toggle {
    background: none;
    border: none;
    border-radius: 4px;
    padding: 4px 6px;
    cursor: pointer;
    font-size: 14px;
    margin-top: 2px;
    &:hover {
      background: #4a4a4c;
    }
  }
}

.reminder-summary {
  margin-left: 28px;
  margin-top: 8px;
  margin-bottom: 4px;
  background: rgba(255, 193, 7, 0.1);
  border-left: 2px solid #ffc107;
  padding: 4px 8px;
  font-size: 11px;
  color: #ffc107;
  display: flex;
  align-items: center;
  gap: 6px;

  .reminder-summary-icon {
    font-size: 12px;
  }

  .reminder-summary-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.remarks-container {
  margin-left: 28px;
  margin-top: 8px;
  .remarks-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    font-size: 11px;
    color: #ffc107;
    .add-remark-btn {
      background: none;
      border: 1px solid #5e5e5e;
      border-radius: 4px;
      padding: 2px 6px;
      cursor: pointer;
      font-size: 10px;
      color: #8bc34a;
      &:hover {
        background: #4a4a4c;
      }
    }
  }
  .remarks-list {
    .remark-item {
      margin-bottom: 4px;
      .remark-display {
        display: flex;
        align-items: center;
        gap: 6px;
        .remark-text {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
          &:hover {
            background: rgba(255, 255, 255, 0.2);
          }
        }
        .delete-remark-btn {
          background: none;
          border: none;
          color: #e74c3c;
          cursor: pointer;
          font-size: 12px;
          &:hover {
            color: #ff6b6f;
          }
        }
      }
      .remark-input {
        width: 100%;
        background: #2c2c3a;
        border: 1px solid #ffc107;
        border-radius: 0;
        padding: 4px 6px;
        color: #f4f4f5;
        font-size: 10px;
        &:focus {
          outline: none;
          border-color: #ffc107;
        }
      }
    }
  }
  .remarks-empty {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    padding: 4px 0;
  }
}

.reminders-panel {
  margin-top: 12px;
  margin-left: 28px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  border-left: 3px solid #ffc107;
  .reminders-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: bold;
    color: #ffc107;
    .close-panel {
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      font-size: 14px;
      &:hover {
        color: white;
      }
    }
  }
  .reminder-item {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    align-items: center;
    flex-wrap: wrap;
    .reminder-type,
    .reminder-time,
    .reminder-param {
      background: #3a3a3c;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      color: white;
      font-size: 12px;
    }
    .reminder-enabled {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #ccc;
      input {
        margin: 0;
      }
    }
    .delete-reminder-btn {
      background: #e74c3c;
      border: none;
      padding: 2px 6px;
      border-radius: 4px;
      color: white;
      cursor: pointer;
      font-size: 12px;
    }
  }
  .add-reminder-btn {
    background: #4caf50;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 12px;
    width: 100%;
    margin-top: 8px;
  }
}

.footer {
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #3a3a3c;
}

.add-btn {
  background: transparent;
  border: 0px;
  padding: 8px 16px;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.save-btn {
  background: transparent;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}
</style>