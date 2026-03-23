<template>
  <!-- 全屏遮罩模式（双击时使用） -->
  <div v-if="!position" class="editor-overlay" @click.self="close">
    <div class="editor-card">
      <div class="header">
        <span>编辑待办 - {{ date }}</span>
        <button class="close-btn" @click="close">✕</button>
      </div>
      <div class="todo-list">
        <div
          v-for="(todo, idx) in localTodos"
          :key="todo.id"
          class="todo-item-wrapper"
        >
          <div class="todo-item">
            <input
              type="checkbox"
              v-model="todo.completed"
              @change="save"
              class="todo-checkbox"
            />
            <input
              type="text"
              v-model="todo.text"
              placeholder="待办内容"
              @blur="save"
              class="todo-text"
              :class="{ completed: todo.completed }"
            />
            <button class="delete-btn" @click="deleteTodo(idx)">删除</button>
            <button
              class="reminder-toggle"
              @click="toggleReminders(idx)"
              :title="hasReminders(todo) ? '编辑提醒' : '添加提醒'"
            >
              ⏰
            </button>
          </div>

          <!-- 提醒面板（可展开） -->
          <div v-if="expandedReminderIdx === idx" class="reminders-panel">
            <div class="reminders-header">
              <span>⏰ 提醒设置</span>
              <button class="close-panel" @click="expandedReminderIdx = null">
                ✕
              </button>
            </div>
            <div
              v-for="(rem, rIdx) in todo.reminders"
              :key="rem.id"
              class="reminder-item"
            >
              <select v-model="rem.type" class="reminder-type" @change="save">
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
              <input
                v-else
                type="time"
                v-model="rem.time"
                @change="save"
                class="reminder-time"
                step="60"
              />

              <label class="reminder-enabled">
                <input type="checkbox" v-model="rem.enabled" @change="save" />
                启用
              </label>
              <button class="delete-reminder-btn" @click="deleteReminder(todo, rIdx)">
                ✖
              </button>
            </div>
            <button class="add-reminder-btn" @click="addReminder(todo)">
              + 添加提醒
            </button>
          </div>
        </div>

        <button class="add-btn" @click="addTodo">+ 添加待办</button>
      </div>
      <div class="footer">
        <button class="save-btn" @click="saveAndClose">完成</button>
      </div>
    </div>
  </div>

  <!-- 浮动模式（悬停时使用） -->
  <div
    v-else
    ref="floatingRef"
    class="editor-floating"
    :style="{ left: finalLeft + 'px', top: finalTop + 'px' }"
  >
    <div class="editor-card">
      <div class="header">
        <span>编辑待办 - {{ date }}</span>
        <button class="close-btn" @click="close">✕</button>
      </div>
      <div class="todo-list">
        <div
          v-for="(todo, idx) in localTodos"
          :key="todo.id"
          class="todo-item-wrapper"
        >
          <div class="todo-item">
            <input
              type="checkbox"
              v-model="todo.completed"
              @change="save"
              class="todo-checkbox"
            />
            <input
              type="text"
              v-model="todo.text"
              placeholder="待办内容"
              @blur="save"
              class="todo-text"
              :class="{ completed: todo.completed }"
            />
            <button class="delete-btn" @click="deleteTodo(idx)">删除</button>
            <button
              class="reminder-toggle"
              @click="toggleReminders(idx)"
              :title="hasReminders(todo) ? '编辑提醒' : '添加提醒'"
            >
              ⏰
            </button>
          </div>

          <!-- 提醒面板（可展开） -->
          <div v-if="expandedReminderIdx === idx" class="reminders-panel">
            <div class="reminders-header">
              <span>⏰ 提醒设置</span>
              <button class="close-panel" @click="expandedReminderIdx = null">
                ✕
              </button>
            </div>
            <div
              v-for="(rem, rIdx) in todo.reminders"
              :key="rem.id"
              class="reminder-item"
            >
              <select v-model="rem.type" class="reminder-type" @change="save">
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
              <input
                v-else
                type="time"
                v-model="rem.time"
                @change="save"
                class="reminder-time"
                step="60"
              />

              <label class="reminder-enabled">
                <input type="checkbox" v-model="rem.enabled" @change="save" />
                启用
              </label>
              <button class="delete-reminder-btn" @click="deleteReminder(todo, rIdx)">
                ✖
              </button>
            </div>
            <button class="add-reminder-btn" @click="addReminder(todo)">
              + 添加提醒
            </button>
          </div>
        </div>

        <button class="add-btn" @click="addTodo">+ 添加待办</button>
      </div>
      <div class="footer">
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
  position: { type: Object, default: null },
});
const emit = defineEmits(["close", "save"]);

const localTodos = ref([]);
const expandedReminderIdx = ref(null);

// 浮动窗口定位相关
const floatingRef = ref(null);
const finalLeft = ref(0);
const finalTop = ref(0);

// 初始化本地数据
watch(
  () => props.todos,
  (newTodos) => {
    if (!newTodos) return;
    // 深拷贝，确保提醒数据完整
    localTodos.value = newTodos.map((todo) => ({
      id: todo.id,
      text: todo.text || "",
      completed: todo.completed || false,
      reminders: todo.reminders
        ? todo.reminders.map((r) => ({ ...r }))
        : [],
    }));
  },
  { immediate: true, deep: true }
);

// 判断待办是否有任何提醒（用于按钮提示）
function hasReminders(todo) {
  return todo.reminders && todo.reminders.length > 0;
}

// 切换提醒面板
function toggleReminders(idx) {
  if (expandedReminderIdx.value === idx) {
    expandedReminderIdx.value = null;
  } else {
    expandedReminderIdx.value = idx;
  }
}

// 添加待办
function addTodo() {
  localTodos.value.push({
    id: Date.now() + Math.random(),
    text: "",
    completed: false,
    reminders: [],
  });
}

// 删除待办
function deleteTodo(index) {
  localTodos.value.splice(index, 1);
  if (expandedReminderIdx.value === index) {
    expandedReminderIdx.value = null;
  } else if (expandedReminderIdx.value > index) {
    expandedReminderIdx.value--;
  }
  save();
}

// 添加提醒规则
function addReminder(todo) {
  if (!todo.reminders) todo.reminders = [];
  todo.reminders.push({
    id: `rem_${Date.now()}_${Math.random()}`,
    type: "single",
    time: "",
    enabled: true,
  });
  save();
}

// 删除提醒规则
function deleteReminder(todo, rIdx) {
  todo.reminders.splice(rIdx, 1);
  if (todo.reminders.length === 0 && expandedReminderIdx.value !== null) {
    // 如果删除后没有提醒了，自动折叠面板
    expandedReminderIdx.value = null;
  }
  save();
}

// 保存（仅触发保存事件，不关闭编辑器）
function save() {
  const rawTodos = toRaw(localTodos.value).map((todo) => ({
    id: todo.id,
    text: todo.text,
    completed: todo.completed,
    reminders: todo.reminders.map((r) => ({
      id: r.id,
      type: r.type,
      time: r.time,
      enabled: r.enabled,
    })),
  }));
  emit("save", props.date, rawTodos);
}

// 保存并关闭
function saveAndClose() {
  save();
  close();
}

// 关闭编辑器
function close() {
  emit("close");
}

// 浮动窗口智能定位
function adjustPosition() {
  if (!props.position || !floatingRef.value) return;
  const mouseX = props.position.x;
  const mouseY = props.position.y;
  const editorRect = floatingRef.value.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = mouseX + 10;
  let top = mouseY + 10;

  if (left + editorRect.width > viewportWidth) {
    left = mouseX - editorRect.width - 10;
  }
  if (left < 0) left = 10;

  if (top + editorRect.height > viewportHeight) {
    top = mouseY - editorRect.height - 10;
  }
  if (top < 0) top = 10;

  finalLeft.value = left;
  finalTop.value = top;
}

watch(
  () => props.position,
  async (newPos) => {
    if (newPos) {
      await nextTick();
      adjustPosition();
    }
  },
  { immediate: true }
);

window.addEventListener("resize", () => {
  if (props.position) adjustPosition();
});
</script>

<style lang="scss" scoped>
/* 全屏遮罩样式 */
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

/* 浮动窗口样式 */
.editor-floating {
  position: fixed;
  z-index: 1001;
}

/* 卡片样式 */
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
  overflow-y: auto;
}

/* 每个待办的外层容器 */
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
  align-items: center;
  width: 100%;

  .todo-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .todo-text {
    flex: 2;
    background: #3a3a3c;
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
    color: white;
    font-size: 14px;

    &.completed {
      text-decoration: line-through;
      opacity: 0.7;
    }
  }

  .delete-btn {
    background: #e74c3c;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 12px;
  }

  .reminder-toggle {
    background: none;
    border: 1px solid #5e5e5e;
    border-radius: 4px;
    padding: 4px 6px;
    cursor: pointer;
    font-size: 14px;
    background: #3a3a3c;
    color: #ffc107;

    &:hover {
      background: #4a4a4c;
    }
  }
}

/* 提醒面板 */
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

    .reminder-type {
      background: #3a3a3c;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      color: white;
      font-size: 12px;
    }

    .reminder-time {
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

.add-btn {
  width: 100%;
  background: #4caf50;
  border: none;
  padding: 8px;
  border-radius: 6px;
  color: white;
  margin-top: 8px;
  cursor: pointer;
}

.footer {
  padding: 12px;
  text-align: right;
  border-top: 1px solid #3a3a3c;
}

.save-btn {
  background: #007aff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  color: white;
  cursor: pointer;
}
</style>