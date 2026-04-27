const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const queueController = require('../controllers/queueController');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

const queueViewRoles = ['ADMIN', 'NURSE', 'RECEPTION', 'ORTHODONTIST', 'DENTAL_SURGEON', 'STUDENT'];
const queueWriteRoles = ['ORTHODONTIST', 'DENTAL_SURGEON', 'STUDENT', 'RECEPTION'];
const queueAddRoles = ['RECEPTION'];
const denyQueueDelete = (_req, res) => res.status(403).json({
  success: false,
  message: 'Deleting queue entries is not permitted from the clinic queue'
});

// GET /api/queue - Get current queue
router.get('/',
  authorizeRoles(...queueViewRoles),
  asyncHandler(queueController.getQueue)
);

// GET /api/queue/stats - Get queue statistics
router.get('/stats',
  authorizeRoles(...queueViewRoles),
  asyncHandler(queueController.getQueueStats)
);

// POST /api/queue - Add patient to queue
router.post('/',
  authorizeRoles(...queueAddRoles),
  validate(schemas.createQueue),
  asyncHandler(queueController.addToQueue)
);

// PUT /api/queue/:id/status - Update queue status
router.put('/:id/status',
  authorizeRoles(...queueWriteRoles),
  validate(schemas.updateQueueStatus),
  asyncHandler(queueController.updateQueueStatus)
);

// DELETE /api/queue/:id - Remove from queue
router.delete('/:id',
  denyQueueDelete
);

module.exports = router;
