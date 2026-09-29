const express = require('express');
const router = express.Router();
const { getOrgStatus, getStationStatus, getUserById } = require('../controllers/internal.controller');

router.get('/organisations/:id/status', getOrgStatus);
router.get('/stations/:id/status', getStationStatus);
router.get('/users/:id', getUserById);

module.exports = router;
