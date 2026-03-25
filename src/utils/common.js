/**
 * 格式化日期时间为 YYYY-MM-DD HH:MM
 * @param {string|Date} date - 日期对象或ISO字符串
 * @returns {string} 格式化后的字符串，如 "2025-03-25 14:30"
 */
export function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
