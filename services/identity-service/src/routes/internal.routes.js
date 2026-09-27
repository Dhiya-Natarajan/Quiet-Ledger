const express = require('express');
const router = express.Router();
const { getOrgStatus, getStationStatus } = require('../controllers/internal.controller');

router.get('/organisations/:id/status', getOrgStatus);
router.get('/stations/:id/status', getStationStatus);

module.exports = router;
