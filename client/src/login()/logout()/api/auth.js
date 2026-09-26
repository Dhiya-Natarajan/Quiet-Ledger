import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function registerUser(data) {
  const res = await axios.post(`${API_BASE}/auth/register`, data);
  return res.data;
}

export async function loginUser(data) {
  const res = await axios.post(`${API_BASE}/auth/login`, data);
  return res.data;
}

export async function fetchMe(token) {
  const res = await axios.get(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}