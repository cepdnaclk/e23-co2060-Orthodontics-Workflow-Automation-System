const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const patientController = require('../controllers/patientController');
const { requirePermission, OBJECT_TYPES, PERMISSIONS } = require('../middleware/accessControl');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/patients - Get all patients with pagination and filtering
router.get('/', 
  requirePermission(OBJECT_TYPES.PATIENT_GENERAL, PERMISSIONS.READ),
  validate(schemas.pagination, 'query'),
  validate(schemas.patientFilter, 'query'),
  asyncHandler(patientController.getPatients)
);

// GET /api/patients/stats - Get patient statistics
router.get('/stats', 
  requirePermission(OBJECT_TYPES.PATIENT_GENERAL, PERMISSIONS.READ),
  asyncHandler(patientController.getPatientStats)
);

// GET /api/patients/orthodontists - Get active orthodontists for assignment
router.get('/orthodontists',
  authorizeRoles('RECEPTION', 'ADMIN', 'DENTAL_SURGEON', 'STUDENT', 'NURSE'),
  asyncHandler(patientController.getActiveOrthodontists)
);

// GET /api/patients/assignable-staff - Get assignable staff for patient care team
router.get('/assignable-staff',
  authorizeRoles('RECEPTION', 'NURSE', 'ORTHODONTIST'),
  asyncHandler(patientController.getAssignableStaff)
);

// GET /api/patients/:id - Get single patient by ID
router.get('/:id', 
  requirePermission(OBJECT_TYPES.PATIENT_GENERAL, PERMISSIONS.READ, { patientIdParam: 'id' }),
  asyncHandler(patientController.getPatientById)
);

// POST /api/patients - Create new patient
router.post('/', 
  requirePermission(OBJECT_TYPES.PATIENT_GENERAL, PERMISSIONS.CREATE),
  validate(schemas.createPatient),
  asyncHandler(patientController.createPatient)
);

// PUT /api/patients/:id - Update patient
router.put('/:id', 
  requirePermission(OBJECT_TYPES.PATIENT_GENERAL, PERMISSIONS.UPDATE, { patientIdParam: 'id' }),
  validate(schemas.updatePatient),
  asyncHandler(patientController.updatePatient)
);

// DELETE /api/patients/:id - Delete patient (Admin only)
router.delete('/:id', 
  requirePermission(OBJECT_TYPES.PATIENT_GENERAL, PERMISSIONS.DELETE, { patientIdParam: 'id' }),
  asyncHandler(patientController.deletePatient)
);

// PUT /api/patients/:id/reactivate - Reactivate inactive patient (Admin only)
router.put('/:id/reactivate',
  requirePermission(OBJECT_TYPES.PATIENT_GENERAL, PERMISSIONS.DELETE, { patientIdParam: 'id' }),
  asyncHandler(patientController.reactivatePatient)
);

// GET /api/patients/:id/assignments - Get active patient assignments
router.get('/:id/assignments',
  requirePermission(OBJECT_TYPES.PATIENT_GENERAL, PERMISSIONS.READ, { patientIdParam: 'id' }),
  asyncHandler(patientController.getPatientAssignments)
);

// POST /api/patients/:id/assignments - Assign care-team member to patient
router.post('/:id/assignments',
  authorizeRoles('RECEPTION', 'NURSE', 'ORTHODONTIST'),
  validate(schemas.assignPatientMember),
  asyncHandler(patientController.assignPatientMember)
);

// GET /api/patients/:id/dental-chart - Get dental chart for a patient
router.get('/:id/dental-chart',
  requirePermission(OBJECT_TYPES.PATIENT_MEDICAL, PERMISSIONS.READ, { patientIdParam: 'id' }),
  asyncHandler(patientController.getDentalChart)
);

// GET /api/patients/:id/history - Get patient history form data
router.get('/:id/history',
  requirePermission(OBJECT_TYPES.PATIENT_MEDICAL, PERMISSIONS.READ, { patientIdParam: 'id' }),
  asyncHandler(patientController.getPatientHistory)
);

// PUT /api/patients/:id/history - Upsert patient history form data
router.put('/:id/history',
  requirePermission(OBJECT_TYPES.PATIENT_MEDICAL, PERMISSIONS.UPDATE, { patientIdParam: 'id' }),
  validate(schemas.updatePatientHistory),
  asyncHandler(patientController.upsertPatientHistory)
);

// PUT /api/patients/:id/dental-chart/:toothNumber - Upsert a tooth chart entry
router.put('/:id/dental-chart/:toothNumber',
  requirePermission(OBJECT_TYPES.PATIENT_MEDICAL, PERMISSIONS.UPDATE, { patientIdParam: 'id' }),
  asyncHandler(patientController.upsertDentalChartEntry)
);

// DELETE /api/patients/:id/dental-chart/:toothNumber - Remove a tooth chart entry
router.delete('/:id/dental-chart/:toothNumber',
  requirePermission(OBJECT_TYPES.PATIENT_MEDICAL, PERMISSIONS.UPDATE, { patientIdParam: 'id' }),
  asyncHandler(patientController.deleteDentalChartEntry)
);

module.exports = router;
