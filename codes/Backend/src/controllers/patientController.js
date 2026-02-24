const { 
  findOne, 
  insert, 
  update, 
  remove, 
  query
} = require('../config/database');
const { logAuditEvent } = require('../middleware/errorHandler');
const { hasPermission, OBJECT_TYPES, PERMISSIONS } = require('../middleware/accessControl');

const ASSIGNMENT_SCOPED_ROLES = new Set(['ORTHODONTIST', 'DENTAL_SURGEON', 'STUDENT']);

const SORT_FIELD_MAP = {
  id: 'p.id',
  created_at: 'p.created_at',
  updated_at: 'p.updated_at',
  first_name: 'p.first_name',
  last_name: 'p.last_name',
  patient_code: 'p.patient_code',
  status: 'p.status'
};

// Generate unique patient code
const generatePatientCode = async () => {
  const prefix = 'P';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

const dateOfBirthFromAge = (ageValue) => {
  const age = Number(ageValue);
  if (!Number.isFinite(age) || age < 0) return null;
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - Math.floor(age));
  return dob.toISOString().slice(0, 10);
};

// Get all patients with pagination and filtering
const getPatients = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      gender,
      deleted = 'active',
      sort = 'id',
      order = 'DESC'
    } = req.query;

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const offset = (parsedPage - 1) * parsedLimit;
    const normalizedOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const sortField = SORT_FIELD_MAP[sort] || SORT_FIELD_MAP.id;

    const deletedMode = String(deleted || 'active').toLowerCase();
    if ((deletedMode === 'inactive' || deletedMode === 'all') && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can view inactive patients'
      });
    }
    const whereClauses = [];
    const whereValues = [];

    if (deletedMode === 'inactive') {
      whereClauses.push('p.deleted_at IS NOT NULL');
    } else if (deletedMode === 'all') {
      // no deleted_at filter
    } else {
      whereClauses.push('p.deleted_at IS NULL');
    }

    if (status) {
      whereClauses.push('p.status = ?');
      whereValues.push(status);
    }
    if (gender) {
      whereClauses.push('p.gender = ?');
      whereValues.push(gender);
    }
    if (search) {
      const searchTerm = `%${search}%`;
      const normalizedSearch = String(search).toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedSearchTerm = `%${normalizedSearch}%`;
      whereClauses.push(`(
        p.first_name LIKE ?
        OR p.last_name LIKE ?
        OR p.patient_code LIKE ?
        OR CONCAT(p.first_name, ' ', p.last_name) LIKE ?
        OR LOWER(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(CONCAT(COALESCE(p.first_name, ''), COALESCE(p.last_name, '')), ' ', ''),
                '.',
                ''
              ),
              '-',
              ''
            ),
            '_',
            ''
          )
        ) LIKE ?
      )`);
      whereValues.push(searchTerm, searchTerm, searchTerm, searchTerm, normalizedSearchTerm);
    }

    const assignedOrthodontist = String(req.query.assigned_orthodontist || '').trim();
    if (assignedOrthodontist) {
      if (assignedOrthodontist === 'unassigned') {
        whereClauses.push(`
          NOT EXISTS (
            SELECT 1
            FROM patient_assignments pa_ortho_none
            WHERE pa_ortho_none.patient_id = p.id
              AND pa_ortho_none.assignment_role = 'ORTHODONTIST'
              AND pa_ortho_none.active = TRUE
            LIMIT 1
          )
        `);
      } else if (/^\d+$/.test(assignedOrthodontist)) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM patient_assignments pa_ortho
            WHERE pa_ortho.patient_id = p.id
              AND pa_ortho.assignment_role = 'ORTHODONTIST'
              AND pa_ortho.active = TRUE
              AND pa_ortho.user_id = ?
            LIMIT 1
          )
        `);
        whereValues.push(Number(assignedOrthodontist));
      }
    }

    const registeredFrom = req.query.registered_from ? String(req.query.registered_from) : '';
    const registeredTo = req.query.registered_to ? String(req.query.registered_to) : '';
    if (registeredFrom && registeredTo) {
      const fromDate = new Date(registeredFrom);
      const toDate = new Date(registeredTo);
      if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime()) && fromDate > toDate) {
        return res.status(400).json({
          success: false,
          message: 'registered_from cannot be later than registered_to'
        });
      }
    }
    if (registeredFrom) {
      whereClauses.push('DATE(p.created_at) >= ?');
      whereValues.push(registeredFrom);
    }
    if (registeredTo) {
      whereClauses.push('DATE(p.created_at) <= ?');
      whereValues.push(registeredTo);
    }

    if (ASSIGNMENT_SCOPED_ROLES.has(req.user.role)) {
      whereClauses.push(`
        EXISTS (
          SELECT 1
          FROM patient_assignments pa_scope
          WHERE pa_scope.patient_id = p.id
            AND pa_scope.user_id = ?
            AND pa_scope.assignment_role = ?
            AND pa_scope.active = TRUE
          LIMIT 1
        )
      `);
      whereValues.push(req.user.id, req.user.role);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const totalResult = await query(
      `SELECT COUNT(*) as total FROM patients p ${whereSql}`,
      whereValues
    );
    const total = totalResult[0].total;

    const patients = await query(
      `SELECT 
        p.id,
        p.patient_code,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        p.gender,
        p.province,
        p.phone,
        p.email,
        p.status,
        p.deleted_at,
        (p.deleted_at IS NOT NULL) as is_inactive,
        CASE WHEN p.deleted_at IS NOT NULL THEN 'INACTIVE' ELSE p.status END as display_status,
        p.nhi_verified,
        p.created_at,
        p.updated_at,
        TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) as age,
        ortho.user_name as assigned_orthodontist_name,
        surgeon.user_name as assigned_surgeon_name,
        student.user_name as assigned_student_name
      FROM patients p
      LEFT JOIN (
        SELECT pa.patient_id, u.name as user_name
        FROM patient_assignments pa
        JOIN users u ON u.id = pa.user_id
        WHERE pa.assignment_role = 'ORTHODONTIST' AND pa.active = TRUE
      ) ortho ON ortho.patient_id = p.id
      LEFT JOIN (
        SELECT pa.patient_id, u.name as user_name
        FROM patient_assignments pa
        JOIN users u ON u.id = pa.user_id
        WHERE pa.assignment_role = 'DENTAL_SURGEON' AND pa.active = TRUE
      ) surgeon ON surgeon.patient_id = p.id
      LEFT JOIN (
        SELECT pa.patient_id, u.name as user_name
        FROM patient_assignments pa
        JOIN users u ON u.id = pa.user_id
        WHERE pa.assignment_role = 'STUDENT' AND pa.active = TRUE
      ) student ON student.patient_id = p.id
      ${whereSql}
      ORDER BY ${sortField} ${normalizedOrder}
      LIMIT ? OFFSET ?`,
      [...whereValues, parsedLimit, offset]
    );

    // Get additional stats for each patient
    const patientsWithStats = await Promise.all(
      patients.map(async (patient) => {
        const [visitCount, lastVisit] = await Promise.all([
          query('SELECT COUNT(*) as count FROM visits WHERE patient_id = ? AND status = "COMPLETED"', [patient.id]),
          query('SELECT visit_date FROM visits WHERE patient_id = ? ORDER BY visit_date DESC LIMIT 1', [patient.id])
        ]);

        return {
          ...patient,
          total_visits: visitCount[0].count,
          last_visit: lastVisit[0]?.visit_date || null
        };
      })
    );

    res.json({
      success: true,
      data: {
        patients: patientsWithStats,
        pagination: {
          current_page: parsedPage,
          total_pages: Math.ceil(total / parsedLimit),
          total_records: total,
          limit: parsedLimit
        }
      }
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single patient by ID
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await findOne('patients', { id, deleted_at: null });
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Get additional patient data
    const canReadDocuments = hasPermission(req.user.role, OBJECT_TYPES.PATIENT_RADIOGRAPHS, PERMISSIONS.READ);
    const canReadNotes = hasPermission(req.user.role, OBJECT_TYPES.PATIENT_NOTES, PERMISSIONS.READ);

    const [visits, documents, clinicalNotes, cases, assignments] = await Promise.all([
      query(`
        SELECT v.*, u.name as provider_name 
        FROM visits v 
        LEFT JOIN users u ON v.provider_id = u.id 
        WHERE v.patient_id = ? 
        ORDER BY v.visit_date DESC
      `, [id]),
      canReadDocuments
        ? query(`
            SELECT md.*, u.name as uploaded_by_name 
            FROM medical_documents md 
            LEFT JOIN users u ON md.uploaded_by = u.id 
            WHERE md.patient_id = ? 
            ORDER BY md.created_at DESC
          `, [id])
        : Promise.resolve([]),
      canReadNotes
        ? query(`
            SELECT cn.*, u.name as author_name, v.name as verifier_name
            FROM clinical_notes cn 
            LEFT JOIN users u ON cn.author_id = u.id 
            LEFT JOIN users v ON cn.verified_by = v.id 
            WHERE cn.patient_id = ? 
            ORDER BY cn.created_at DESC
          `, [id])
        : Promise.resolve([]),
      query(`
        SELECT c.*, 
               s.name as student_name, 
               sup.name as supervisor_name 
        FROM cases c 
        LEFT JOIN users s ON c.student_id = s.id 
        LEFT JOIN users sup ON c.supervisor_id = sup.id 
        WHERE c.patient_id = ? 
        ORDER BY c.created_at DESC
      `, [id]),
      query(
        `SELECT pa.id, pa.patient_id, pa.user_id, pa.assignment_role, pa.active, pa.created_at,
                u.name AS user_name, u.email AS user_email
         FROM patient_assignments pa
         JOIN users u ON u.id = pa.user_id
         WHERE pa.patient_id = ? AND pa.active = TRUE
         ORDER BY pa.assignment_role, pa.created_at DESC`,
        [id]
      )
    ]);

    res.json({
      success: true,
      data: {
        patient: {
          ...patient,
          age: Math.floor((new Date() - new Date(patient.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
        },
        visits,
        documents,
        clinical_notes: clinicalNotes,
        cases,
        assignments,
        access: {
          can_read_documents: canReadDocuments,
          can_read_notes: canReadNotes,
          can_read_dental_chart: hasPermission(req.user.role, OBJECT_TYPES.PATIENT_MEDICAL, PERMISSIONS.READ)
        }
      }
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new patient
const createPatient = async (req, res) => {
  try {
    const patientData = { ...req.body };

    if (!patientData.date_of_birth && patientData.age !== undefined) {
      const derivedDob = dateOfBirthFromAge(patientData.age);
      if (!derivedDob) {
        return res.status(400).json({
          success: false,
          message: 'Invalid age provided'
        });
      }
      patientData.date_of_birth = derivedDob;
    }
    delete patientData.age;

    if (patientData.registration_date) {
      const regDate = new Date(patientData.registration_date);
      if (Number.isNaN(regDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid registration_date provided'
        });
      }
      patientData.created_at = regDate.toISOString().slice(0, 19).replace('T', ' ');
      delete patientData.registration_date;
    }

    // Generate unique patient code if not provided
    if (!patientData.patient_code) {
      patientData.patient_code = await generatePatientCode();
    }

    // Check if patient code already exists
    const existingPatient = await findOne('patients', { patient_code: patientData.patient_code });
    if (existingPatient) {
      return res.status(400).json({
        success: false,
        message: 'Patient code already exists'
      });
    }

    // Create patient
    const patientId = await insert('patients', patientData);

    // Record registration as first visit entry.
    const registrationVisitDate = patientData.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
    await insert('visits', {
      patient_id: patientId,
      provider_id: req.user.id,
      visit_date: registrationVisitDate,
      procedure_type: 'REGISTRATION',
      status: 'COMPLETED',
      notes: 'Patient registration'
    });

    await logAuditEvent(req.user.id, 'CREATE', 'PATIENT', patientId, null, patientData);

    // Return created patient
    const createdPatient = await findOne('patients', { id: patientId });

    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: createdPatient
    });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update patient
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (!updateData.date_of_birth && updateData.age !== undefined) {
      const derivedDob = dateOfBirthFromAge(updateData.age);
      if (!derivedDob) {
        return res.status(400).json({
          success: false,
          message: 'Invalid age provided'
        });
      }
      updateData.date_of_birth = derivedDob;
    }
    delete updateData.age;

    // Check if patient exists
    const existingPatient = await findOne('patients', { id, deleted_at: null });
    if (!existingPatient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // If updating patient code, check for duplicates
    if (updateData.patient_code && updateData.patient_code !== existingPatient.patient_code) {
      const duplicatePatient = await findOne('patients', { patient_code: updateData.patient_code });
      if (duplicatePatient) {
        return res.status(400).json({
          success: false,
          message: 'Patient code already exists'
        });
      }
    }

    // Update patient
    await update('patients', updateData, { id });

    await logAuditEvent(req.user.id, 'UPDATE', 'PATIENT', id, existingPatient, updateData);

    // Return updated patient
    const updatedPatient = await findOne('patients', { id });

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: updatedPatient
    });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete patient (soft delete)
const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const permanent = String(req.query.permanent || '').toLowerCase() === 'true';

    if (permanent) {
      const rows = await query('SELECT * FROM patients WHERE id = ? LIMIT 1', [id]);
      const existingPatient = rows[0];
      if (!existingPatient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      if (!existingPatient.deleted_at) {
        return res.status(400).json({
          success: false,
          message: 'Patient must be inactive before permanent deletion'
        });
      }

      await remove('patients', { id }, false);

      await logAuditEvent(req.user.id, 'HARD_DELETE', 'PATIENT', id, existingPatient, null);

      return res.json({
        success: true,
        message: 'Patient permanently deleted'
      });
    }

    // Check if patient exists
    const existingPatient = await findOne('patients', { id, deleted_at: null });
    if (!existingPatient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Admin can always inactivate a patient, even with active cases/upcoming visits.
    // Keep the safeguard for any future non-admin delete flows.
    if (req.user.role !== 'ADMIN') {
      const [activeCases, upcomingVisits] = await Promise.all([
        query('SELECT COUNT(*) as count FROM cases WHERE patient_id = ? AND status IN ("ASSIGNED", "PENDING_VERIFICATION")', [id]),
        query('SELECT COUNT(*) as count FROM visits WHERE patient_id = ? AND visit_date > NOW() AND status != "CANCELLED"', [id])
      ]);

      if (activeCases[0].count > 0 || upcomingVisits[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete patient with active cases or upcoming visits'
        });
      }
    }

    // Soft delete patient
    await remove('patients', { id }, true);

    await logAuditEvent(req.user.id, 'DELETE', 'PATIENT', id, existingPatient, null);

    res.json({
      success: true,
      message: 'Patient set to inactive successfully'
    });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Reactivate patient (clear inactive/deleted marker)
const reactivatePatient = async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await query('SELECT * FROM patients WHERE id = ? LIMIT 1', [id]);
    const existingPatient = rows[0];
    if (!existingPatient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    if (!existingPatient.deleted_at) {
      return res.status(400).json({
        success: false,
        message: 'Patient is already active'
      });
    }

    await update('patients', { deleted_at: null }, { id });

    await logAuditEvent(req.user.id, 'RESTORE', 'PATIENT', id, existingPatient, { deleted_at: null });

    const updatedPatient = await findOne('patients', { id });
    return res.json({
      success: true,
      message: 'Patient reactivated successfully',
      data: updatedPatient
    });
  } catch (error) {
    console.error('Reactivate patient error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get patient statistics
const getPatientStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_patients,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_patients,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_patients,
        COUNT(CASE WHEN status = 'CONSULTATION' THEN 1 END) as consultation_patients,
        COUNT(CASE WHEN status = 'MAINTENANCE' THEN 1 END) as maintenance_patients,
        COUNT(CASE WHEN gender = 'MALE' THEN 1 END) as male_patients,
        COUNT(CASE WHEN gender = 'FEMALE' THEN 1 END) as female_patients,
        COUNT(CASE WHEN gender = 'OTHER' THEN 1 END) as other_gender_patients,
        AVG(TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())) as average_age
      FROM patients 
      WHERE deleted_at IS NULL
    `);

    // Monthly new patients (last 12 months)
    const monthlyStats = await query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as new_patients
      FROM patients 
      WHERE deleted_at IS NULL 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        monthly_new_patients: monthlyStats
      }
    });
  } catch (error) {
    console.error('Get patient stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getActiveOrthodontists = async (req, res) => {
  try {
    const orthodontists = await query(
      `SELECT id, name, email
       FROM users
       WHERE role = 'ORTHODONTIST' AND status = 'ACTIVE'
       ORDER BY name ASC`
    );

    res.json({
      success: true,
      data: orthodontists
    });
  } catch (error) {
    console.error('Get active orthodontists error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getAssignableStaff = async (req, res) => {
  try {
    const rawRoles = String(req.query.roles || '').trim();
    const requestedRoles = rawRoles
      ? rawRoles.split(',').map((r) => r.trim().toUpperCase()).filter(Boolean)
      : [];

    if (req.user.role === 'ORTHODONTIST') {
      // Orthodontists can only assign surgeons/students.
      const allowedForOrtho = new Set(['DENTAL_SURGEON', 'STUDENT']);
      const effectiveRoles = requestedRoles.length
        ? requestedRoles.filter((r) => allowedForOrtho.has(r))
        : Array.from(allowedForOrtho);

      if (!effectiveRoles.length) {
        return res.json({ success: true, data: [] });
      }

      const placeholders = effectiveRoles.map(() => '?').join(', ');
      const staff = await query(
        `SELECT id, name, email, role
         FROM users
         WHERE status = 'ACTIVE'
           AND role IN (${placeholders})
         ORDER BY role ASC, name ASC`,
        effectiveRoles
      );

      return res.json({
        success: true,
        data: staff
      });
    }

    // Reception can query assignable roles used in patient directory assignment flows.
    const allowedForReception = new Set(['ORTHODONTIST', 'DENTAL_SURGEON', 'NURSE', 'STUDENT']);
    const effectiveRoles = requestedRoles.length
      ? requestedRoles.filter((r) => allowedForReception.has(r))
      : Array.from(allowedForReception);

    if (!effectiveRoles.length) {
      return res.json({ success: true, data: [] });
    }

    const placeholders = effectiveRoles.map(() => '?').join(', ');
    const staff = await query(
      `SELECT id, name, email, role
       FROM users
       WHERE status = 'ACTIVE'
         AND role IN (${placeholders})
       ORDER BY role ASC, name ASC`,
      effectiveRoles
    );

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error('Get assignable staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Assign a care-team member to a patient for instance-level access control
const assignPatientMember = async (req, res) => {
  try {
    const { id: patientId } = req.params;
    const { user_id, assignment_role } = req.body;

    const patient = await findOne('patients', { id: patientId, deleted_at: null });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const member = await findOne('users', { id: user_id, status: 'ACTIVE' });
    if (!member) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user not found or inactive'
      });
    }

    if (member.role !== assignment_role) {
      return res.status(400).json({
        success: false,
        message: 'assignment_role must match the selected user role'
      });
    }

    const allowedRoles = ['ORTHODONTIST', 'DENTAL_SURGEON', 'NURSE', 'STUDENT'];
    if (!allowedRoles.includes(assignment_role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignment role'
      });
    }

    if (req.user.role === 'ORTHODONTIST') {
      const canAssignRoles = new Set(['DENTAL_SURGEON', 'STUDENT']);
      if (!canAssignRoles.has(assignment_role)) {
        return res.status(403).json({
          success: false,
          message: 'Orthodontists can only assign DENTAL_SURGEON or STUDENT'
        });
      }

      const scopeRows = await query(
        `SELECT 1
         FROM patient_assignments
         WHERE patient_id = ?
           AND user_id = ?
           AND assignment_role = 'ORTHODONTIST'
           AND active = TRUE
         LIMIT 1`,
        [patientId, req.user.id]
      );

      if (!scopeRows.length) {
        return res.status(403).json({
          success: false,
          message: 'You can only assign team members for your own patients'
        });
      }
    }

    await query(
      `UPDATE patient_assignments
       SET active = FALSE
       WHERE patient_id = ?
         AND assignment_role = ?
         AND active = TRUE`,
      [patientId, assignment_role]
    );

    const assignmentId = await insert('patient_assignments', {
      patient_id: patientId,
      user_id,
      assignment_role,
      assigned_by: req.user.id,
      active: true
    });

    await logAuditEvent(req.user.id, 'ASSIGN', 'PATIENT_ASSIGNMENT', assignmentId, null, {
      patient_id: Number(patientId),
      user_id,
      assignment_role
    });

    res.status(201).json({
      success: true,
      message: 'Patient assignment created successfully'
    });
  } catch (error) {
    console.error('Assign patient member error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getPatientAssignments = async (req, res) => {
  try {
    const { id: patientId } = req.params;
    const patient = await findOne('patients', { id: patientId, deleted_at: null });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const assignments = await query(
      `SELECT pa.id, pa.patient_id, pa.user_id, pa.assignment_role, pa.active, pa.created_at,
              u.name AS user_name, u.email AS user_email
       FROM patient_assignments pa
       JOIN users u ON u.id = pa.user_id
       WHERE pa.patient_id = ? AND pa.active = TRUE
       ORDER BY pa.assignment_role, pa.created_at DESC`,
      [patientId]
    );

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Get patient assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getDentalChart = async (req, res) => {
  try {
    const { id: patientId } = req.params;
    const patient = await findOne('patients', { id: patientId, deleted_at: null });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const rows = await query(
      `SELECT d.id, d.patient_id, d.tooth_number, d.status,
              d.is_pathology, d.is_planned, d.is_treated, d.is_missing,
              d.pathology, d.treatment, d.event_date,
              d.updated_by, d.created_at, d.updated_at, u.name AS updated_by_name
       FROM dental_chart_entries d
       LEFT JOIN users u ON u.id = d.updated_by
       WHERE d.patient_id = ?
       ORDER BY d.tooth_number ASC`,
      [patientId]
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Get dental chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const upsertDentalChartEntry = async (req, res) => {
  try {
    const { id: patientId, toothNumber } = req.params;
    const numericTooth = Number(toothNumber);
    const patient = await findOne('patients', { id: patientId, deleted_at: null });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    if (!Number.isInteger(numericTooth) || numericTooth < 1 || numericTooth > 32) {
      return res.status(400).json({
        success: false,
        message: 'toothNumber must be between 1 and 32'
      });
    }

    const pathologyFlagInput = req.body.is_pathology ?? req.body.isPathology;
    const plannedFlagInput = req.body.is_planned ?? req.body.isPlanned;
    const treatedFlagInput = req.body.is_treated ?? req.body.isTreated;
    const missingFlagInput = req.body.is_missing ?? req.body.isMissing;

    const status = String(req.body.status || 'HEALTHY').toUpperCase();
    const allowedStatuses = new Set(['HEALTHY', 'PATHOLOGY', 'PLANNED', 'TREATED', 'MISSING']);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tooth status'
      });
    }

    const isPathology = pathologyFlagInput !== undefined ? Boolean(pathologyFlagInput) : status === 'PATHOLOGY';
    const isPlanned = plannedFlagInput !== undefined ? Boolean(plannedFlagInput) : status === 'PLANNED';
    const isTreated = treatedFlagInput !== undefined ? Boolean(treatedFlagInput) : status === 'TREATED';
    const isMissing = missingFlagInput !== undefined ? Boolean(missingFlagInput) : status === 'MISSING';

    const payload = {
      patient_id: Number(patientId),
      tooth_number: numericTooth,
      status,
      is_pathology: isPathology,
      is_planned: isPlanned,
      is_treated: isTreated,
      is_missing: isMissing,
      pathology: req.body.pathology || null,
      treatment: req.body.treatment || null,
      event_date: req.body.event_date || null,
      updated_by: req.user.id
    };

    await query(
      `INSERT INTO dental_chart_entries
        (patient_id, tooth_number, status, is_pathology, is_planned, is_treated, is_missing, pathology, treatment, event_date, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        is_pathology = VALUES(is_pathology),
        is_planned = VALUES(is_planned),
        is_treated = VALUES(is_treated),
        is_missing = VALUES(is_missing),
        pathology = VALUES(pathology),
        treatment = VALUES(treatment),
        event_date = VALUES(event_date),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP`,
      [
        payload.patient_id,
        payload.tooth_number,
        payload.status,
        payload.is_pathology,
        payload.is_planned,
        payload.is_treated,
        payload.is_missing,
        payload.pathology,
        payload.treatment,
        payload.event_date,
        payload.updated_by
      ]
    );

    await logAuditEvent(req.user.id, 'UPSERT', 'DENTAL_CHART_ENTRY', null, null, payload);

    const rows = await query(
      `SELECT d.id, d.patient_id, d.tooth_number, d.status,
              d.is_pathology, d.is_planned, d.is_treated, d.is_missing,
              d.pathology, d.treatment, d.event_date,
              d.updated_by, d.created_at, d.updated_at, u.name AS updated_by_name
       FROM dental_chart_entries d
       LEFT JOIN users u ON u.id = d.updated_by
       WHERE d.patient_id = ? AND d.tooth_number = ?
       LIMIT 1`,
      [patientId, numericTooth]
    );

    res.json({
      success: true,
      message: 'Dental chart entry saved successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Upsert dental chart entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const deleteDentalChartEntry = async (req, res) => {
  try {
    const { id: patientId, toothNumber } = req.params;
    const numericTooth = Number(toothNumber);
    const patient = await findOne('patients', { id: patientId, deleted_at: null });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    await query(
      'DELETE FROM dental_chart_entries WHERE patient_id = ? AND tooth_number = ?',
      [patientId, numericTooth]
    );

    await logAuditEvent(req.user.id, 'DELETE', 'DENTAL_CHART_ENTRY', null, null, {
      patient_id: Number(patientId),
      tooth_number: numericTooth
    });

    res.json({
      success: true,
      message: 'Dental chart entry removed'
    });
  } catch (error) {
    console.error('Delete dental chart entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getPatientHistory = async (req, res) => {
  try {
    const { id: patientId } = req.params;
    const patient = await findOne('patients', { id: patientId, deleted_at: null });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const historyRows = await query(
      `SELECT ph.id, ph.patient_id, ph.form_data, ph.updated_by, ph.created_at, ph.updated_at, u.name AS updated_by_name
       FROM patient_histories ph
       LEFT JOIN users u ON u.id = ph.updated_by
       WHERE ph.patient_id = ?
       LIMIT 1`,
      [patientId]
    );

    const sex = patient.gender === 'MALE' ? 'M' : patient.gender === 'FEMALE' ? 'F' : 'O';
    const auto = {
      name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
      address: patient.address || '',
      age: Math.floor((new Date() - new Date(patient.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)),
      birthday: patient.date_of_birth ? String(patient.date_of_birth).slice(0, 10) : '',
      telephone: patient.phone || '',
      sex,
      province: patient.province || '',
      date_of_examination: patient.created_at ? String(patient.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10)
    };

    const row = historyRows[0] || null;
    let normalizedHistory = {};
    if (row?.form_data && typeof row.form_data === 'object') {
      normalizedHistory = row.form_data;
    } else if (typeof row?.form_data === 'string') {
      try {
        normalizedHistory = JSON.parse(row.form_data);
      } catch (_) {
        normalizedHistory = {};
      }
    }

    res.json({
      success: true,
      data: {
        auto,
        history: normalizedHistory,
        metadata: row
          ? {
              id: row.id,
              updated_by: row.updated_by,
              updated_by_name: row.updated_by_name,
              created_at: row.created_at,
              updated_at: row.updated_at
            }
          : null
      }
    });
  } catch (error) {
    console.error('Get patient history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const upsertPatientHistory = async (req, res) => {
  try {
    const { id: patientId } = req.params;
    const patient = await findOne('patients', { id: patientId, deleted_at: null });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const historyPayload = req.body?.history || {};
    await query(
      `INSERT INTO patient_histories (patient_id, form_data, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         form_data = VALUES(form_data),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [patientId, JSON.stringify(historyPayload), req.user.id]
    );

    await logAuditEvent(req.user.id, 'UPSERT', 'PATIENT_HISTORY', null, null, {
      patient_id: Number(patientId),
      keys: Object.keys(historyPayload || {})
    });

    const rows = await query(
      `SELECT ph.id, ph.patient_id, ph.form_data, ph.updated_by, ph.created_at, ph.updated_at, u.name AS updated_by_name
       FROM patient_histories ph
       LEFT JOIN users u ON u.id = ph.updated_by
       WHERE ph.patient_id = ?
       LIMIT 1`,
      [patientId]
    );

    const saved = rows[0] || null;
    let normalizedFormData = {};
    if (saved?.form_data && typeof saved.form_data === 'object') {
      normalizedFormData = saved.form_data;
    } else if (typeof saved?.form_data === 'string') {
      try {
        normalizedFormData = JSON.parse(saved.form_data);
      } catch (_) {
        normalizedFormData = {};
      }
    }

    res.json({
      success: true,
      message: 'Patient history saved successfully',
      data: saved
        ? {
            ...saved,
            form_data: normalizedFormData
          }
        : null
    });
  } catch (error) {
    console.error('Upsert patient history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  reactivatePatient,
  getPatientStats,
  getActiveOrthodontists,
  getAssignableStaff,
  assignPatientMember,
  getPatientAssignments,
  getDentalChart,
  upsertDentalChartEntry,
  deleteDentalChartEntry,
  getPatientHistory,
  upsertPatientHistory
};
