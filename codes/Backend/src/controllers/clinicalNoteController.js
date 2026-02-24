const { 
  findOne, 
  findMany, 
  insert, 
  update, 
  remove,
  query
} = require('../config/database');
const { logAuditEvent } = require('../middleware/errorHandler');

// Get clinical notes for a patient
const getPatientNotes = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { page = 1, limit = 10, note_type, verified } = req.query;
    const offset = (page - 1) * limit;

    // Check if patient exists
    const patient = await findOne('patients', { id: patientId, deleted_at: null });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    let whereClause = 'WHERE patient_id = ?';
    let queryParams = [patientId];

    if (note_type) {
      whereClause += ' AND note_type = ?';
      queryParams.push(note_type);
    }

    if (verified !== undefined) {
      if (verified === 'true') {
        whereClause += ' AND is_verified = TRUE';
      } else if (verified === 'false') {
        whereClause += ' AND is_verified = FALSE';
      }
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM clinical_notes 
      ${whereClause}
    `;
    const totalResult = await query(countQuery, queryParams);
    const total = totalResult[0].total;

    // Get notes with author and verifier details
    const notesQuery = `
      SELECT 
        cn.*,
        author.name as author_name,
        author.role as author_role,
        verifier.name as verifier_name,
        verifier.role as verifier_role
      FROM clinical_notes cn
      LEFT JOIN users author ON cn.author_id = author.id
      LEFT JOIN users verifier ON cn.verified_by = verifier.id
      ${whereClause}
      ORDER BY cn.created_at DESC
      LIMIT ? OFFSET ?
    `;
    queryParams.push(parseInt(limit), offset);

    const notes = await query(notesQuery, queryParams);

    res.json({
      success: true,
      data: {
        notes,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get patient notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single clinical note by ID
const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;

    const noteQuery = `
      SELECT 
        cn.*,
        p.patient_code,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        author.name as author_name,
        author.role as author_role,
        verifier.name as verifier_name,
        verifier.role as verifier_role
      FROM clinical_notes cn
      LEFT JOIN patients p ON cn.patient_id = p.id
      LEFT JOIN users author ON cn.author_id = author.id
      LEFT JOIN users verifier ON cn.verified_by = verifier.id
      WHERE cn.id = ?
    `;

    const notes = await query(noteQuery, [id]);

    if (notes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Clinical note not found'
      });
    }

    res.json({
      success: true,
      data: notes[0]
    });
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create clinical note
const createClinicalNote = async (req, res) => {
  try {
    const { patientId } = req.params;
    const noteData = { ...req.body, patient_id: patientId, author_id: req.user.id };

    // Check if patient exists
    const patient = await findOne('patients', { id: patientId, deleted_at: null });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Validate note type
    const validTypes = ['TREATMENT', 'OBSERVATION', 'PROGRESS', 'SUPERVISOR_REVIEW'];
    if (noteData.note_type && !validTypes.includes(noteData.note_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid note type'
      });
    }

    // Students can only create certain types of notes
    if (req.user.role === 'STUDENT' && ['SUPERVISOR_REVIEW'].includes(noteData.note_type)) {
      return res.status(403).json({
        success: false,
        message: 'Students cannot create supervisor review notes'
      });
    }

    // Create note
    const noteId = await insert('clinical_notes', noteData);

    await logAuditEvent(req.user.id, 'CREATE', 'CLINICAL_NOTE', noteId, null, {
      patient_id: patientId,
      note_type: noteData.note_type
    });

    // Return created note with details
    const createdNoteQuery = `
      SELECT 
        cn.*,
        p.patient_code,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        author.name as author_name,
        author.role as author_role
      FROM clinical_notes cn
      LEFT JOIN patients p ON cn.patient_id = p.id
      LEFT JOIN users author ON cn.author_id = author.id
      WHERE cn.id = ?
    `;

    const createdNotes = await query(createdNoteQuery, [noteId]);

    res.status(201).json({
      success: true,
      message: 'Clinical note created successfully',
      data: createdNotes[0]
    });
  } catch (error) {
    console.error('Create clinical note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update clinical note
const updateClinicalNote = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if note exists
    const existingNote = await findOne('clinical_notes', { id });
    if (!existingNote) {
      return res.status(404).json({
        success: false,
        message: 'Clinical note not found'
      });
    }

    // Check permissions
    if (req.user.role === 'STUDENT' && existingNote.author_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own notes'
      });
    }

    // Students cannot verify notes
    if (req.user.role === 'STUDENT' && updateData.is_verified) {
      return res.status(403).json({
        success: false,
        message: 'Students cannot verify notes'
      });
    }

    // Handle verification
    if (updateData.is_verified && !existingNote.is_verified) {
      updateData.verified_by = req.user.id;
      updateData.verified_at = new Date();
    }

    if (updateData.is_verified === false && existingNote.is_verified) {
      updateData.verified_by = null;
      updateData.verified_at = null;
    }

    // Update note
    await update('clinical_notes', updateData, { id });

    await logAuditEvent(req.user.id, 'UPDATE', 'CLINICAL_NOTE', id, existingNote, updateData);

    // Return updated note with details
    const updatedNoteQuery = `
      SELECT 
        cn.*,
        p.patient_code,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        author.name as author_name,
        author.role as author_role,
        verifier.name as verifier_name,
        verifier.role as verifier_role
      FROM clinical_notes cn
      LEFT JOIN patients p ON cn.patient_id = p.id
      LEFT JOIN users author ON cn.author_id = author.id
      LEFT JOIN users verifier ON cn.verified_by = verifier.id
      WHERE cn.id = ?
    `;

    const updatedNotes = await query(updatedNoteQuery, [id]);

    res.json({
      success: true,
      message: 'Clinical note updated successfully',
      data: updatedNotes[0]
    });
  } catch (error) {
    console.error('Update clinical note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete clinical note
const deleteClinicalNote = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if note exists
    const existingNote = await findOne('clinical_notes', { id });
    if (!existingNote) {
      return res.status(404).json({
        success: false,
        message: 'Clinical note not found'
      });
    }

    // Check permissions
    if (req.user.role === 'STUDENT' && existingNote.author_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own notes'
      });
    }

    // Cannot delete verified notes (except for admins and orthodontists)
    if (existingNote.is_verified && !['ADMIN', 'ORTHODONTIST'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete verified notes'
      });
    }

    // Delete note
    await remove('clinical_notes', { id }, false);

    await logAuditEvent(req.user.id, 'DELETE', 'CLINICAL_NOTE', id, existingNote, null);

    res.json({
      success: true,
      message: 'Clinical note deleted successfully'
    });
  } catch (error) {
    console.error('Delete clinical note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Verify clinical note (for supervisors)
const verifyNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_notes } = req.body;

    // Check if user can verify notes
    if (!['ADMIN', 'ORTHODONTIST', 'DENTAL_SURGEON'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to verify notes'
      });
    }

    // Check if note exists
    const existingNote = await findOne('clinical_notes', { id });
    if (!existingNote) {
      return res.status(404).json({
        success: false,
        message: 'Clinical note not found'
      });
    }

    if (existingNote.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'Note is already verified'
      });
    }

    // Verify note
    const updateData = {
      is_verified: true,
      verified_by: req.user.id,
      verified_at: new Date()
    };

    if (verification_notes) {
      updateData.content = existingNote.content + '\n\n[VERIFICATION NOTE]: ' + verification_notes;
    }

    await update('clinical_notes', updateData, { id });

    await logAuditEvent(req.user.id, 'VERIFY', 'CLINICAL_NOTE', id, existingNote, updateData);

    // Return updated note
    const updatedNoteQuery = `
      SELECT 
        cn.*,
        p.patient_code,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        author.name as author_name,
        author.role as author_role,
        verifier.name as verifier_name,
        verifier.role as verifier_role
      FROM clinical_notes cn
      LEFT JOIN patients p ON cn.patient_id = p.id
      LEFT JOIN users author ON cn.author_id = author.id
      LEFT JOIN users verifier ON cn.verified_by = verifier.id
      WHERE cn.id = ?
    `;

    const updatedNotes = await query(updatedNoteQuery, [id]);

    res.json({
      success: true,
      message: 'Clinical note verified successfully',
      data: updatedNotes[0]
    });
  } catch (error) {
    console.error('Verify note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get notes requiring verification
const getPendingVerification = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Only admins and orthodontists can see pending verifications
    if (!['ADMIN', 'ORTHODONTIST', 'DENTAL_SURGEON'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view pending verifications'
      });
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM clinical_notes 
      WHERE is_verified = FALSE
    `;
    const totalResult = await query(countQuery);
    const total = totalResult[0].total;

    // Get pending notes
    const notesQuery = `
      SELECT 
        cn.*,
        p.patient_code,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        author.name as author_name,
        author.role as author_role
      FROM clinical_notes cn
      LEFT JOIN patients p ON cn.patient_id = p.id
      LEFT JOIN users author ON cn.author_id = author.id
      WHERE cn.is_verified = FALSE
      ORDER BY cn.created_at ASC
      LIMIT ? OFFSET ?
    `;

    const notes = await query(notesQuery, [parseInt(limit), offset]);

    res.json({
      success: true,
      data: {
        notes,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get pending verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get clinical note statistics
const getNoteStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let dateFilter;
    switch (period) {
      case 'week':
        dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        break;
      case 'month':
        dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        break;
      case 'year':
        dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 YEAR)';
        break;
      default:
        dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 MONTH)';
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_notes,
        COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified_notes,
        COUNT(CASE WHEN is_verified = FALSE THEN 1 END) as unverified_notes,
        COUNT(CASE WHEN note_type = 'TREATMENT' THEN 1 END) as treatment_notes,
        COUNT(CASE WHEN note_type = 'OBSERVATION' THEN 1 END) as observation_notes,
        COUNT(CASE WHEN note_type = 'PROGRESS' THEN 1 END) as progress_notes,
        COUNT(CASE WHEN note_type = 'SUPERVISOR_REVIEW' THEN 1 END) as supervisor_notes
      FROM clinical_notes 
      WHERE created_at >= ${dateFilter}
    `;

    const stats = await query(statsQuery);

    // Note creation trends
    const trendsQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as date,
        COUNT(*) as note_count,
        COUNT(CASE WHEN is_verified = TRUE THEN 1 END) as verified_count
      FROM clinical_notes 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const trends = await query(trendsQuery);

    // Top note authors
    const authorsQuery = `
      SELECT 
        u.name as author_name,
        u.role as author_role,
        COUNT(*) as note_count,
        COUNT(CASE WHEN cn.is_verified = TRUE THEN 1 END) as verified_count
      FROM clinical_notes cn
      LEFT JOIN users u ON cn.author_id = u.id
      WHERE cn.created_at >= ${dateFilter}
      GROUP BY cn.author_id, u.name, u.role
      ORDER BY note_count DESC
      LIMIT 10
    `;

    const authors = await query(authorsQuery);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        daily_trends: trends,
        top_authors: authors
      }
    });
  } catch (error) {
    console.error('Get note stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getPatientNotes,
  getNoteById,
  createClinicalNote,
  updateClinicalNote,
  deleteClinicalNote,
  verifyNote,
  getPendingVerification,
  getNoteStats
};
