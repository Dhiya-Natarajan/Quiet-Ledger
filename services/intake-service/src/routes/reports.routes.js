const express = require('express');
const router = express.Router();
const { createReport, getMyReports, getAssignedReports } = require('../controllers/reports.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.post('/', protect, createReport);
router.get('/mine', protect, getMyReports);
router.get('/assigned', protect, requireRole('organisation', 'police'), getAssignedReports);

module.exports = router;
