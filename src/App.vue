<template>
  <div class="app">
    <Calendar />
    <TodoEditor
      v-if="showEditor"
      :date="selectedDate"
      :todos="selectedTodos"
      @close="closeEditor"
      @save="saveTodos"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import Calendar from './components/Calendar.vue';
import TodoEditor from './components/TodoEditor.vue';

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

function saveTodos(date, todos) {
  // 调用主进程保存
  window.electronAPI.saveTodos(date, todos);
  closeEditor();
  // 刷新日历显示
  // 可通过事件总线或重新获取数据
}

// 暴露方法给 Calendar 组件使用（可通过 provide/inject 或事件）
// 这里简化：直接在 Calendar 中调用父组件方法，可以通过 emit 或 provide
// 为了方便，我们将 openEditor 通过 provide 提供给子组件
import { provide } from 'vue';
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
}
</style>

<style lang="scss">
// 全局样式
body {
  margin: 0;
  padding: 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  user-select: none;
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