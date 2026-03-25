/**
 * 格式化日期时间为 YYYY-MM-DD HH:MM
 * @param {string|Date} date - 日期对象或ISO字符串
 * @returns {string} 格式化后的字符串，如 "2025-03-25 14:30"
 */
export function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
