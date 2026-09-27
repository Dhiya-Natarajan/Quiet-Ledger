const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth.middleware');
const {
  getApprovedOrgs, requestOrg,
  getApprovedStations, requestStation,
  getAllOrgs, updateOrgStatus,
  getAllStations, updateStationStatus,
} = require('../controllers/entities.controller');

// Public routes
router.get('/organisations', getApprovedOrgs);
router.post('/organisations/request', requestOrg);
router.get('/police-stations', getApprovedStations);
router.post('/police-stations/request', requestStation);

// Admin only
router.get('/admin/organisations', protect, requireRole('platform_admin'), getAllOrgs);
router.patch('/admin/organisations/:id', protect, requireRole('platform_admin'), updateOrgStatus);
router.get('/admin/police-stations', protect, requireRole('platform_admin'), getAllStations);
router.patch('/admin/police-stations/:id', protect, requireRole('platform_admin'), updateStationStatus);

module.exports = router;
