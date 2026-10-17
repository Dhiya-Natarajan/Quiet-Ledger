import axios from 'axios';

const COMMUNICATION_URL = import.meta.env.VITE_COMMUNICATION_SERVICE_URL || 'http://localhost:4003';

function authHeaders(token) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

export async function fetchMyNotifications(token, userId) {
  try {
    const res = await axios.get(
      `${COMMUNICATION_URL}/notifications?userId=${encodeURIComponent(userId)}`,
      authHeaders(token)
    );
    return res.data?.notifications || [];
  } catch (err) {
    console.warn('[Communication] Could not fetch notifications:', err.message);
    return [];
  }
}

export async function fetchUnreadCount(token, userId) {
  try {
    const res = await axios.get(
      `${COMMUNICATION_URL}/notifications/unread-count?userId=${encodeURIComponent(userId)}`,
      authHeaders(token)
    );
    return res.data?.unreadCount || 0;
  } catch (err) {
    return 0;
  }
}

export async function markNotificationRead(token, id) {
  try {
    const res = await axios.patch(
      `${COMMUNICATION_URL}/notifications/${id}/read`,
      {},
      authHeaders(token)
    );
    return res.data;
  } catch (err) {
    console.warn('[Communication] Could not mark notification read:', err.message);
    return null;
  }
}

export async function markAllNotificationsRead(token, userId) {
  try {
    const res = await axios.patch(
      `${COMMUNICATION_URL}/notifications/read-all`,
      { userId },
      authHeaders(token)
    );
    return res.data;
  } catch (err) {
    console.warn('[Communication] Could not mark all notifications read:', err.message);
    return null;
  }
}
