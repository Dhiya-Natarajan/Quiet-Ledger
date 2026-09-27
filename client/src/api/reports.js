import axios from 'axios';

const INTAKE_URL = import.meta.env.VITE_INTAKE_SERVICE_URL || 'http://localhost:4002';

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function createReport(token, data) {
  const res = await axios.post(`${INTAKE_URL}/reports`, data, authHeaders(token));
  return res.data;
}

export async function fetchMyReports(token) {
  const res = await axios.get(`${INTAKE_URL}/reports/mine`, authHeaders(token));
  return res.data;
}

export async function fetchAssignedReports(token) {
  const res = await axios.get(`${INTAKE_URL}/reports/assigned`, authHeaders(token));
  return res.data;
}
