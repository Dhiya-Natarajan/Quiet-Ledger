import axios from 'axios';

const IDENTITY_URL = import.meta.env.VITE_IDENTITY_SERVICE_URL || 'http://localhost:4001';

export async function registerUser(data) {
  const res = await axios.post(`${IDENTITY_URL}/auth/register`, data);
  return res.data;
}

export async function loginUser(data) {
  const res = await axios.post(`${IDENTITY_URL}/auth/login`, data);
  return res.data;
}

export async function fetchMe(token) {
  const res = await axios.get(`${IDENTITY_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
