import axios from 'axios';

const IDENTITY_URL = import.meta.env.VITE_IDENTITY_SERVICE_URL || 'http://localhost:4001';

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function registerUser(data) {
  const res = await axios.post(`${IDENTITY_URL}/auth/register`, data);
  return res.data;
}

export async function loginUser(data) {
  const res = await axios.post(`${IDENTITY_URL}/auth/login`, data);
  return res.data;
}

export async function fetchMe(token) {
  const res = await axios.get(`${IDENTITY_URL}/auth/me`, authHeaders(token));
  return res.data;
}

export async function fetchApprovedOrganisations() {
  const res = await axios.get(`${IDENTITY_URL}/organisations`);
  return res.data;
}

export async function fetchApprovedStations() {
  const res = await axios.get(`${IDENTITY_URL}/police-stations`);
  return res.data;
}

export async function requestOrganisation(data) {
  const res = await axios.post(`${IDENTITY_URL}/organisations/request`, data);
  return res.data;
}

export async function requestStation(data) {
  const res = await axios.post(`${IDENTITY_URL}/police-stations/request`, data);
  return res.data;
}

export async function fetchAllOrganisations(token) {
  const res = await axios.get(`${IDENTITY_URL}/admin/organisations`, authHeaders(token));
  return res.data;
}

export async function fetchAllStations(token) {
  const res = await axios.get(`${IDENTITY_URL}/admin/police-stations`, authHeaders(token));
  return res.data;
}

export async function updateOrgStatus(token, id, status) {
  const res = await axios.patch(`${IDENTITY_URL}/admin/organisations/${id}`, { status }, authHeaders(token));
  return res.data;
}

export async function updateStationStatus(token, id, status) {
  const res = await axios.patch(`${IDENTITY_URL}/admin/police-stations/${id}`, { status }, authHeaders(token));
  return res.data;
}
