const bcrypt = require('bcryptjs');
const { 
  findOne, 
  findMany, 
  insert, 
  update, 
  query,
  transaction
} = require('../config/database');
const { logAuditEvent } = require('../middleware/errorHandler');
const { requirePermission, OBJECT_TYPES, PERMISSIONS } = require('../middleware/accessControl');

// Get all users (Admin only)
const getUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      role, 
      status,
      department,
      search
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (role) {
      whereClause += ' AND role = ?';
      queryParams.push(role);
    }

    if (status) {
      whereClause += ' AND status = ?';
      queryParams.push(status);
    }

    if (department) {
      whereClause += ' AND department = ?';
      queryParams.push(department);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM users 
      ${whereClause}
    `;
    const totalResult = await query(countQuery, queryParams);
    const total = totalResult[0].total;

    // Get users without password hashes
    const usersQuery = `
      SELECT 
        id, name, email, role, department, status, created_at, updated_at
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    queryParams.push(parseInt(limit), offset);

    const users = await query(usersQuery, queryParams);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const userQuery = `
      SELECT 
        id, name, email, role, department, status, created_at, updated_at
      FROM users 
      WHERE id = ?
    `;

    const users = await query(userQuery, [id]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user statistics
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM patients WHERE deleted_at IS NULL) as total_patients,
        (SELECT COUNT(*) FROM visits WHERE provider_id = ?) as total_visits,
        (SELECT COUNT(*) FROM cases WHERE student_id = ?) as student_cases,
        (SELECT COUNT(*) FROM cases WHERE supervisor_id = ?) as supervised_cases,
        (SELECT COUNT(*) FROM clinical_notes WHERE author_id = ?) as authored_notes
    `;

    const stats = await query(statsQuery, [id, id, id, id]);

    res.json({
      success: true,
      data: {
        user: users[0],
        statistics: stats[0]
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new user (Admin only)
const createUser = async (req, res) => {
  try {
    const userData = req.body;

    // Check if email already exists
    const existingUser = await findOne('users', { email: userData.email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = bcrypt.hashSync(userData.password, saltRounds);

    // Prepare user data
    const newUserData = {
      name: userData.name,
      email: userData.email,
      password_hash: passwordHash,
      role: userData.role,
      department: userData.department || null,
      status: userData.status || 'ACTIVE'
    };

    // Create user
    const userId = await insert('users', newUserData);

    await logAuditEvent(req.user.id, 'CREATE', 'USER', userId, null, {
      name: userData.name,
      email: userData.email,
      role: userData.role
    });

    // Return created user without password hash
    const createdUser = await findOne('users', { id: userId });
    const { password_hash, ...userWithoutPassword } = createdUser;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user (Admin only)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if user exists
    const existingUser = await findOne('users', { id });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If updating email, check for duplicates
    if (updateData.email && updateData.email !== existingUser.email) {
      const duplicateUser = await findOne('users', { email: updateData.email });
      if (duplicateUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // If updating password, hash it
    if (updateData.password) {
      const saltRounds = 12;
      updateData.password_hash = bcrypt.hashSync(updateData.password, saltRounds);
      delete updateData.password;
    }

    // Update user
    await update('users', updateData, { id });

    await logAuditEvent(req.user.id, 'UPDATE', 'USER', id, existingUser, updateData);

    // Return updated user without password hash
    const updatedUser = await findOne('users', { id });
    const { password_hash, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'User updated successfully',
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete user (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const permanentDelete = req.query.permanent === 'true';

    // Check if user exists
    const existingUser = await findOne('users', { id });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deletion of the current user
    if (id == req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    if (!permanentDelete) {
      // Soft delete user (set status to INACTIVE)
      await update('users', { status: 'INACTIVE' }, { id });

      await logAuditEvent(req.user.id, 'DEACTIVATE', 'USER', id, existingUser, { status: 'INACTIVE' });

      return res.json({
        success: true,
        message: 'User deactivated successfully'
      });
    }

    // Require explicit deactivation first before hard delete
    if (existingUser.status !== 'INACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'User must be inactive before permanent deletion'
      });
    }

    // Hard delete user:
    // Reassign RESTRICT/NO ACTION foreign-key references to the acting admin first,
    // then physically delete the user in a single transaction.
    try {
      const reassignmentSummary = await transaction(async (connection) => {
        const [fkRows] = await connection.query(
          `SELECT
             kcu.TABLE_NAME AS table_name,
             kcu.COLUMN_NAME AS column_name,
             rc.DELETE_RULE AS delete_rule
           FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
           JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
             ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
            AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
           WHERE kcu.TABLE_SCHEMA = DATABASE()
             AND kcu.REFERENCED_TABLE_NAME = 'users'
             AND kcu.REFERENCED_COLUMN_NAME = 'id'`
        );

        const updates = [];
        for (const fk of fkRows) {
          const deleteRule = String(fk.delete_rule || '').toUpperCase();
          if (deleteRule !== 'RESTRICT' && deleteRule !== 'NO ACTION') {
            continue;
          }

          const tableName = String(fk.table_name || '');
          const columnName = String(fk.column_name || '');
          if (!tableName || !columnName || tableName === 'users') {
            continue;
          }

          const safeTable = tableName.replace(/`/g, '``');
          const safeColumn = columnName.replace(/`/g, '``');

          const [updateResult] = await connection.query(
            `UPDATE \`${safeTable}\` SET \`${safeColumn}\` = ? WHERE \`${safeColumn}\` = ?`,
            [req.user.id, id]
          );

          if (updateResult.affectedRows > 0) {
            updates.push({
              table: tableName,
              column: columnName,
              affected_rows: updateResult.affectedRows
            });
          }
        }

        await connection.query('DELETE FROM users WHERE id = ?', [id]);
        return updates;
      });

      await logAuditEvent(req.user.id, 'PERMANENT_DELETE', 'USER', id, existingUser, {
        reassigned_references: reassignmentSummary
      });

      return res.json({
        success: true,
        message: 'User permanently deleted'
      });
    } catch (dbError) {
      if (dbError.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({
          success: false,
          message: 'Cannot permanently delete user due to unreassignable linked records'
        });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'ADMIN' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'ORTHODONTIST' THEN 1 END) as orthodontist_count,
        COUNT(CASE WHEN role = 'DENTAL_SURGEON' THEN 1 END) as dental_surgeon_count,
        COUNT(CASE WHEN role = 'NURSE' THEN 1 END) as nurse_count,
        COUNT(CASE WHEN role = 'STUDENT' THEN 1 END) as student_count,
        COUNT(CASE WHEN role = 'RECEPTION' THEN 1 END) as reception_count,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_users,
        COUNT(CASE WHEN status = 'INACTIVE' THEN 1 END) as inactive_users
      FROM users
    `;

    const stats = await query(statsQuery);

    // Department breakdown
    const departmentStatsQuery = `
      SELECT 
        department,
        COUNT(*) as user_count
      FROM users
      WHERE department IS NOT NULL
      GROUP BY department
      ORDER BY user_count DESC
    `;

    const departmentStats = await query(departmentStatsQuery);

    // Recent user activity
    const recentActivityQuery = `
      SELECT 
        u.name,
        u.role,
        al.action,
        al.timestamp
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id IS NOT NULL
        AND al.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY al.timestamp DESC
      LIMIT 20
    `;

    const recentActivity = await query(recentActivityQuery);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        department_breakdown: departmentStats,
        recent_activity: recentActivity
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get staff directory (Admin only)
const getStaffDirectory = async (req, res) => {
  try {
    const { role, department } = req.query;

    let whereClause = 'WHERE status = "ACTIVE"';
    let queryParams = [];

    if (role) {
      whereClause += ' AND role = ?';
      queryParams.push(role);
    }

    if (department) {
      whereClause += ' AND department = ?';
      queryParams.push(department);
    }

    const staffQuery = `
      SELECT 
        id, name, email, role, department, created_at
      FROM users 
      ${whereClause}
      ORDER BY name ASC
    `;

    const staff = await query(staffQuery, queryParams);

    // Get additional stats for each staff member
    const staffWithStats = await Promise.all(
      staff.map(async (member) => {
        const [cases, visits, notes] = await Promise.all([
          query('SELECT COUNT(*) as count FROM cases WHERE student_id = ? AND status IN ("ASSIGNED", "PENDING_VERIFICATION")', [member.id]),
          query('SELECT COUNT(*) as count FROM visits WHERE provider_id = ? AND visit_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)', [member.id]),
          query('SELECT COUNT(*) as count FROM clinical_notes WHERE author_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)', [member.id])
        ]);

        return {
          ...member,
          active_cases: cases[0].count,
          recent_visits: visits[0].count,
          recent_notes: notes[0].count
        };
      })
    );

    res.json({
      success: true,
      data: staffWithStats
    });
  } catch (error) {
    console.error('Get staff directory error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  getStaffDirectory
};
