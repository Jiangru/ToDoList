<template>
  <div class="app">
    <Calendar ref="calendarRef" />
    <TodoEditor
      v-if="showEditor"
      :date="selectedDate"
      :todos="selectedTodos"
      @close="closeEditor"
      @save="handleSave"
    />
  </div>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue';
import Calendar from './components/Calendar.vue';
import TodoEditor from './components/TodoEditor.vue';

const calendarRef = ref(null);
const showEditor = ref(false);
const selectedDate = ref('');
const selectedTodos = ref([]);

function openEditor(date, todos) {
  selectedDate.value = date;
  selectedTodos.value = todos;
  showEditor.value = true;
}

function closeEditor() {
  showEditor.value = false;
}

async function handleSave(date, todos) {
  if (!window.electronAPI || !window.electronAPI.saveTodos) {
    console.error('electronAPI.saveTodos 不可用');
    return;
  }
  await window.electronAPI.saveTodos(date, todos);
  // 刷新日历数据
  if (calendarRef.value) {
    calendarRef.value.refreshData();
  }
}

// 监听来自主进程的事件
onMounted(() => {
  if (!window.electronAPI) return;

  // 播放声音
  window.electronAPI.onPlaySound(() => {
    const audio = new Audio('./sound/reminder.mp3');
    audio.play().catch(e => console.error('播放声音失败:', e));
  });

  // 标记待办完成（来自通知的"完成"按钮）
  window.electronAPI.onMarkTodoComplete(async (event, todoId) => {
    // 需要遍历所有日期的待办，找到该 todoId 并标记为完成
    // 获取当前所有待办数据
    const allTodos = await window.electronAPI.getTodos();
    let updated = false;
    for (const date in allTodos) {
      const dayTodos = allTodos[date];
      const todoIndex = dayTodos.findIndex(todo => todo.id === todoId);
      if (todoIndex !== -1) {
        // 标记为完成
        dayTodos[todoIndex].completed = true;
        // 保存该日期的待办
        await window.electronAPI.saveTodos(date, dayTodos);
        updated = true;
        break;
      }
    }
    if (updated) {
      // 刷新日历
      if (calendarRef.value) {
        calendarRef.value.refreshData();
      }
    }
  });
});

// 暴露方法给子组件
provide('openEditor', openEditor);
</script>

<style lang="scss" scoped>
.app {
  width: 100vw;
  height: 100vh;
  background: rgba(30, 30, 40, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(0,0,0,0.2);
  -webkit-app-region: drag;   /* 整个窗口可拖拽 */
}
</style>

<style lang="scss">
// 全局样式
html, body {
  margin: 0;
  padding: 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  user-select: none;
  background: transparent !important;
}
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}
</style>