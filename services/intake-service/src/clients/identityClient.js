const axios = require('axios');

const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL;
const TIMEOUT_MS = 3000;

// Return values:
//   true  -> identity-service reached, resource is approved
//   false -> identity-service reached, resource exists but is NOT approved (real rejection)
//   null  -> identity-service could not be reached in time (fail-open case —
//            caller decides what to do, we don't fail-closed here)
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

module.exports = { checkOrgApproved, checkStationApproved };
