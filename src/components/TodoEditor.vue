<template>
  <div class="editor-overlay" @click.self="close">
    <div class="editor-card">
      <div class="header">
        <span>编辑待办 - {{ date }}</span>
        <button class="close-btn" @click="close">✕</button>
      </div>
      <div class="todo-list">
        <div v-for="(todo, idx) in localTodos" :key="todo.id" class="todo-item">
          <input type="checkbox" v-model="todo.completed" @change="save">
          <input type="text" v-model="todo.text" placeholder="待办内容" @blur="save">
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
import { ref, watch } from 'vue';

const props = defineProps({
  date: String,
  todos: Array
});
const emit = defineEmits(['close', 'save']);

const localTodos = ref([]);

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
  save();
}

function deleteTodo(index) {
  localTodos.value.splice(index, 1);
  save();
}

function save() {
  // 自动保存到主进程
  emit('save', props.date, localTodos.value);
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
.editor-card {
  width: 500px;
  max-width: 90%;
  background: #2c2c2e;
  border-radius: 12px;
  color: white;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1c1c1e;
  border-bottom: 1px solid #3a3a3c;
  .close-btn {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
  }
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
  input[type="text"] {
    flex: 2;
    background: #3a3a3c;
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
    color: white;
  }
  input[type="datetime-local"] {
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
  .save-btn {
    background: #007aff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    color: white;
    cursor: pointer;
  }
}
</style>