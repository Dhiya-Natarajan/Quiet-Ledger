const axios = require('axios');

const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL || 'http://localhost:4001';
const TIMEOUT_MS = 3000;

async function checkOrgApproved(orgId) {
  try {
    const res = await axios.get(`${IDENTITY_URL}/internal/organisations/${orgId}/status`, {
      timeout: TIMEOUT_MS,
    });
    return res.data.status === 'approved';
  } catch (err) {
    console.warn(
      `[fail-open] Could not verify organisation ${orgId} via identity-service (${err.message}). Proceeding unverified.`
    );
    return null;
  }
}

async function getOrgDetails(orgId) {
  try {
    const res = await axios.get(`${IDENTITY_URL}/internal/organisations/${orgId}/status`, {
      timeout: TIMEOUT_MS,
    });
    return res.data;
  } catch (err) {
    console.warn(`[fail-open] Could not fetch organisation details for ${orgId}:`, err.message);
    return null;
  }
}

async function checkStationApproved(stationId) {
  try {
    const res = await axios.get(`${IDENTITY_URL}/internal/stations/${stationId}/status`, {
      timeout: TIMEOUT_MS,
    });
    return res.data.status === 'approved';
  } catch (err) {
    console.warn(
      `[fail-open] Could not verify station ${stationId} via identity-service (${err.message}). Proceeding unverified.`
    );
    return null;
  }
}

async function getStationDetails(stationId) {
  try {
    const res = await axios.get(`${IDENTITY_URL}/internal/stations/${stationId}/status`, {
      timeout: TIMEOUT_MS,
    });
    return res.data;
  } catch (err) {
    console.warn(`[fail-open] Could not fetch station details for ${stationId}:`, err.message);
    return null;
  }
}

async function getUserById(userId) {
  try {
    const res = await axios.get(`${IDENTITY_URL}/internal/users/${userId}`, {
      timeout: TIMEOUT_MS,
    });
    return res.data.user || res.data;
  } catch (err) {
    console.warn(`Could not fetch user ${userId} from identity-service:`, err.message);
    return null;
  }
}

module.exports = {
  checkOrgApproved,
  getOrgDetails,
  checkStationApproved,
  getStationDetails,
  getUserById,
};
