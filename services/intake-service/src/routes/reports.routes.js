const express = require('express');
const router = express.Router();
const {
  createReport, getMyReports, getAssignedReports,
  updateReportStatus, sendMessage, getMessages,
  breakGlass, getAuditLogs,
} = require('../controllers/reports.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.post('/', protect, requireRole('citizen'), createReport);
router.get('/mine', protect, getMyReports);
router.get('/assigned', protect, requireRole('organisation', 'police', 'platform_admin'), getAssignedReports);
router.patch('/:id/status', protect, updateReportStatus);
router.post('/:id/messages', protect, sendMessage);
router.get('/:id/messages', protect, getMessages);
router.post('/:id/break-glass', protect, requireRole('platform_admin'), breakGlass);
router.get('/admin/audit-logs', protect, requireRole('platform_admin'), getAuditLogs);

module.exports = router;
