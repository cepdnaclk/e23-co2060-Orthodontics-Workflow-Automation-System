const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'orthoflow',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  // Keep DATE/DATETIME/TIMESTAMP values as DB strings to avoid timezone shifts
  // when API serializes Date objects to ISO strings.
  dateStrings: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Ensure non-destructive RBAC schema additions exist
const ensureAccessControlSchema = async () => {
  // Patient-level assignment relation used for instance access control
  await query(`
    CREATE TABLE IF NOT EXISTS patient_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      user_id INT NOT NULL,
      assignment_role ENUM('ORTHODONTIST', 'DENTAL_SURGEON', 'NURSE', 'STUDENT') NOT NULL,
      assigned_by INT NOT NULL,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_assignment_patient (patient_id),
      INDEX idx_assignment_user (user_id),
      INDEX idx_assignment_role (assignment_role),
      INDEX idx_assignment_active (active),
      UNIQUE KEY uniq_active_assignment (patient_id, user_id, assignment_role, active)
    )
  `);

  // Per-patient dental chart entries (one row per tooth with non-default state)
  await query(`
    CREATE TABLE IF NOT EXISTS dental_chart_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      tooth_number TINYINT NOT NULL,
      status ENUM('HEALTHY', 'PATHOLOGY', 'PLANNED', 'TREATED', 'MISSING') NOT NULL DEFAULT 'HEALTHY',
      is_pathology BOOLEAN NOT NULL DEFAULT FALSE,
      is_planned BOOLEAN NOT NULL DEFAULT FALSE,
      is_treated BOOLEAN NOT NULL DEFAULT FALSE,
      is_missing BOOLEAN NOT NULL DEFAULT FALSE,
      pathology VARCHAR(500) NULL,
      treatment VARCHAR(500) NULL,
      event_date DATE NULL,
      updated_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE KEY uniq_patient_tooth (patient_id, tooth_number),
      INDEX idx_dental_patient (patient_id),
      INDEX idx_dental_status (status)
    )
  `);

  const existingColumns = await query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'dental_chart_entries'
  `);
  const columnSet = new Set(existingColumns.map((row) => row.COLUMN_NAME));

  if (!columnSet.has('is_pathology')) {
    await query('ALTER TABLE dental_chart_entries ADD COLUMN is_pathology BOOLEAN NOT NULL DEFAULT FALSE AFTER status');
  }
  if (!columnSet.has('is_planned')) {
    await query('ALTER TABLE dental_chart_entries ADD COLUMN is_planned BOOLEAN NOT NULL DEFAULT FALSE AFTER is_pathology');
  }
  if (!columnSet.has('is_treated')) {
    await query('ALTER TABLE dental_chart_entries ADD COLUMN is_treated BOOLEAN NOT NULL DEFAULT FALSE AFTER is_planned');
  }
  if (!columnSet.has('is_missing')) {
    await query('ALTER TABLE dental_chart_entries ADD COLUMN is_missing BOOLEAN NOT NULL DEFAULT FALSE AFTER is_treated');
  }

  const patientColumns = await query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'patients'
  `);
  const patientColumnSet = new Set(patientColumns.map((row) => row.COLUMN_NAME));
  if (!patientColumnSet.has('province')) {
    await query('ALTER TABLE patients ADD COLUMN province VARCHAR(100) NULL AFTER address');
  }

  const documentColumns = await query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'medical_documents'
  `);
  const documentColumnSet = new Set(documentColumns.map((row) => row.COLUMN_NAME));
  if (!documentColumnSet.has('deleted_at')) {
    await query('ALTER TABLE medical_documents ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
    await query('CREATE INDEX idx_medical_documents_deleted_at ON medical_documents (deleted_at)');
  }
  if (!documentColumnSet.has('deleted_by')) {
    await query('ALTER TABLE medical_documents ADD COLUMN deleted_by INT NULL DEFAULT NULL');
  }

  const inventoryColumns = await query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'inventory_items'
  `);
  const inventoryColumnSet = new Set(inventoryColumns.map((row) => row.COLUMN_NAME));
  if (!inventoryColumnSet.has('minimum_threshold')) {
    await query('ALTER TABLE inventory_items ADD COLUMN minimum_threshold INT NOT NULL DEFAULT 0 AFTER unit');
    await query('CREATE INDEX idx_threshold ON inventory_items (minimum_threshold)');
  }
  if (!inventoryColumnSet.has('last_updated')) {
    await query('ALTER TABLE inventory_items ADD COLUMN last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  }

  await query(`
    CREATE TABLE IF NOT EXISTS patient_histories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      form_data JSON NULL,
      updated_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE KEY uniq_patient_history (patient_id),
      INDEX idx_patient_history_patient (patient_id)
    )
  `);

  const visitStatusColumns = await query(`
    SELECT COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'visits'
      AND COLUMN_NAME = 'status'
    LIMIT 1
  `);

  const visitStatusColumnType = visitStatusColumns[0]?.COLUMN_TYPE || '';
  if (visitStatusColumnType && !visitStatusColumnType.includes('DID_NOT_ATTEND')) {
    await query(`
      ALTER TABLE visits
      MODIFY COLUMN status ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'DID_NOT_ATTEND')
      DEFAULT 'SCHEDULED'
    `);
  }
};

// Execute query with error handling
const query = async (sql, params = []) => {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Execute transaction
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const buildWhere = (conditions = {}) => {
  const clauses = [];
  const values = [];

  Object.entries(conditions).forEach(([key, value]) => {
    if (value === null) {
      clauses.push(`${key} IS NULL`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        clauses.push('1 = 0');
      } else {
        const placeholders = value.map(() => '?').join(', ');
        clauses.push(`${key} IN (${placeholders})`);
        values.push(...value);
      }
    } else {
      clauses.push(`${key} = ?`);
      values.push(value);
    }
  });

  return {
    clause: clauses.join(' AND '),
    values
  };
};

// Get single record
const findOne = async (table, conditions, fields = '*') => {
  const { clause, values } = buildWhere(conditions);
  const sql = `SELECT ${fields} FROM ${table} WHERE ${clause} LIMIT 1`;
  const rows = await query(sql, values);
  return rows.length > 0 ? rows[0] : null;
};

// Get multiple records with optional pagination
const findMany = async (table, conditions = {}, options = {}) => {
  const {
    fields = '*',
    orderBy = 'id DESC',
    limit = null,
    offset = 0
  } = options;

  let sql = `SELECT ${fields} FROM ${table}`;
  const values = [];

  if (Object.keys(conditions).length > 0) {
    const where = buildWhere(conditions);
    sql += ` WHERE ${where.clause}`;
    values.push(...where.values);
  }

  sql += ` ORDER BY ${orderBy}`;

  if (limit) {
    sql += ` LIMIT ? OFFSET ?`;
    values.push(limit, offset);
  }

  return await query(sql, values);
};

// Insert record
const insert = async (table, data) => {
  const fields = Object.keys(data).join(', ');
  const placeholders = Object.keys(data).map(() => '?').join(', ');
  const values = Object.values(data);
  
  const sql = `INSERT INTO ${table} (${fields}) VALUES (${placeholders})`;
  const result = await query(sql, values);
  return result.insertId;
};

// Update record
const update = async (table, data, conditions) => {
  const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
  const values = [...Object.values(data), ...Object.values(conditions)];
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  const result = await query(sql, values);
  return result.affectedRows;
};

// Delete record (soft delete if deleted_at column exists)
const remove = async (table, conditions, softDelete = true) => {
  if (softDelete) {
    return await update(table, { deleted_at: new Date() }, conditions);
  } else {
    const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(conditions);
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    const result = await query(sql, values);
    return result.affectedRows;
  }
};

// Count records
const count = async (table, conditions = {}) => {
  let sql = `SELECT COUNT(*) as total FROM ${table}`;
  const values = [];

  if (Object.keys(conditions).length > 0) {
    const where = buildWhere(conditions);
    sql += ` WHERE ${where.clause}`;
    values.push(...where.values);
  }

  const result = await query(sql, values);
  return result[0].total;
};

module.exports = {
  pool,
  query,
  transaction,
  findOne,
  findMany,
  insert,
  update,
  remove,
  count,
  testConnection,
  ensureAccessControlSchema
};
