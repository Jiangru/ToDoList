<template>
  <!-- 全屏遮罩模式（双击时使用） -->
  <div v-if="!position" class="editor-overlay" @click.self="close">
    <div class="editor-card">
      <div class="header">
        <span>编辑待办 - {{ date }}</span>
        <button class="close-btn" @click="close">✕</button>
      </div>
      <div class="todo-list">
        <div v-for="(todo, idx) in localTodos" :key="todo.id" class="todo-item">
          <input type="checkbox" v-model="todo.completed" @change="save">
          <input type="text" v-model="todo.text" placeholder="待办内容" @blur="save"
                 :style="{ textDecoration: todo.completed ? 'line-through' : 'none' }">
          <input type="datetime-local" v-model="todo.reminder" @change="save">
          <button class="delete-btn" @click="deleteTodo(idx)">删除</button>
        </div>
        <button class="add-btn" @click="addTodo">+ 添加待办</button>
      </div>
      <div class="footer">
        <button class="save-btn" @click="saveAndClose">完成</button>
      </div>
    </div>
  </div>

  <!-- 浮动模式（悬停时使用） -->
  <div v-else
       ref="floatingRef"
       class="editor-floating"
       :style="{ left: finalLeft + 'px', top: finalTop + 'px' }">
    <div class="editor-card">
      <div class="header">
        <span>编辑待办 - {{ date }}</span>
        <button class="close-btn" @click="close">✕</button>
      </div>
      <div class="todo-list">
        <div v-for="(todo, idx) in localTodos" :key="todo.id" class="todo-item">
          <input type="checkbox" v-model="todo.completed" @change="save">
          <input type="text" v-model="todo.text" placeholder="待办内容" @blur="save"
                 :style="{ textDecoration: todo.completed ? 'line-through' : 'none' }">
          <input type="datetime-local" v-model="todo.reminder" @change="save">
          <button class="delete-btn" @click="deleteTodo(idx)">删除</button>
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
import { ref, watch, toRaw, nextTick } from 'vue';

const props = defineProps({
  date: String,
  todos: Array,
  position: { type: Object, default: null }
});
const emit = defineEmits(['close', 'save']);

const localTodos = ref([]);
const floatingRef = ref(null);
const finalLeft = ref(0);
const finalTop = ref(0);

// 智能定位函数
function adjustPosition() {
  if (!props.position || !floatingRef.value) return;

  const mouseX = props.position.x;
  const mouseY = props.position.y;
  const editorRect = floatingRef.value.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 基础偏移量（鼠标右下方10px）
  let left = mouseX + 10;
  let top = mouseY + 10;

  // 水平方向超出右边界
  if (left + editorRect.width > viewportWidth) {
    left = mouseX - editorRect.width - 10; // 放在鼠标左边
  }
  // 水平方向超出左边界
  if (left < 0) {
    left = 10;
  }

  // 垂直方向超出下边界
  if (top + editorRect.height > viewportHeight) {
    top = mouseY - editorRect.height - 10; // 放在鼠标上方
  }
  // 垂直方向超出上边界
  if (top < 0) {
    top = 10;
  }

  finalLeft.value = left;
  finalTop.value = top;
}

// 监听 position 变化，重新计算位置
watch(() => props.position, async (newPos) => {
  if (newPos) {
    await nextTick(); // 等待 DOM 渲染
    adjustPosition();
  }
}, { immediate: true });

// 监听窗口大小变化，重新调整
window.addEventListener('resize', () => {
  if (props.position) adjustPosition();
});

watch(() => props.todos, (newTodos) => {
  localTodos.value = newTodos ? [...newTodos] : [];
}, { immediate: true });

function addTodo() {
  localTodos.value.push({
    id: Date.now() + Math.random(),
    text: '',
    completed: false,
    reminder: ''
  });
}

function deleteTodo(index) {
  localTodos.value.splice(index, 1);
  save();
}

function save() {
  const rawTodos = toRaw(localTodos.value).map(todo => ({
    id: todo.id,
    text: todo.text,
    completed: todo.completed,
    reminder: todo.reminder
  }));
  emit('save', props.date, rawTodos);
}

function saveAndClose() {
  save();
  close();
}

function close() {
  emit('close');
}
</script>

<style lang="scss" scoped>
/* 全屏遮罩样式 */
.editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* 浮动窗口样式 */
.editor-floating {
  position: fixed;
  z-index: 1001;
  /* 不再使用 transform，改用 left/top 动态设置 */
  /* transform: translate(10px, 10px); 移除 */
}

.editor-card {
  width: 500px;
  max-width: 90vw;
  background: #2c2c2e;
  border-radius: 12px;
  color: white;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
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
  max-height: 400px;
  overflow-y: auto;
}
.todo-item {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}
.todo-item input[type="text"] {
  flex: 2;
  background: #3a3a3c;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  color: white;
}
.todo-item input[type="datetime-local"] {
  background: #3a3a3c;
  border: none;
  padding: 6px;
  border-radius: 6px;
  color: white;
}
.delete-btn {
  background: #e74c3c;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  color: white;
  cursor: pointer;
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