const bcrypt = require('bcryptjs');
const { query } = require('../src/config/database');
const { generateTemporaryPassword } = require('../src/utils/password');
require('dotenv').config();

const buildSeedUser = ({ name, email, role, department, password, seededAt }) => {
  const normalizedPassword = String(password || '').trim() || generateTemporaryPassword();
  const usesProvidedPassword = Boolean(String(password || '').trim());

  return {
    record: {
      name: String(name || '').trim(),
      email: String(email || '').trim(),
      password_hash: bcrypt.hashSync(normalizedPassword, 12),
      role,
      department: String(department || '').trim() || null,
      status: 'ACTIVE',
      must_change_password: !usesProvidedPassword,
      password_changed_at: usesProvidedPassword ? seededAt : null,
      last_login: null,
      last_activity_at: null
    },
    password: normalizedPassword,
    usesProvidedPassword
  };
};

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    const seededAt = new Date();
    const seedUsers = [
      buildSeedUser({
        name: process.env.SEED_ADMIN_NAME || 'System Administrator',
        email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
        role: 'ADMIN',
        department: process.env.SEED_ADMIN_DEPARTMENT || 'Orthodontics',
        password: process.env.SEED_ADMIN_PASSWORD || 'AdminPass123',
        seededAt
      }),
      buildSeedUser({
        name: process.env.SEED_RECEPTION_NAME || 'Reception Test User',
        email: process.env.SEED_RECEPTION_EMAIL || 'reception@example.com',
        role: 'RECEPTION',
        department: process.env.SEED_RECEPTION_DEPARTMENT || 'Front Desk',
        password: process.env.SEED_RECEPTION_PASSWORD || 'AdminPass123',
        seededAt
      }),
      buildSeedUser({
        name: process.env.SEED_ORTHODONTIST_NAME || 'Orthodontist Test User',
        email: process.env.SEED_ORTHODONTIST_EMAIL || 'orthodontist@example.com',
        role: 'ORTHODONTIST',
        department: process.env.SEED_ORTHODONTIST_DEPARTMENT || 'Orthodontics',
        password: process.env.SEED_ORTHODONTIST_PASSWORD || 'AdminPass123',
        seededAt
      }),
      buildSeedUser({
        name: process.env.SEED_ORTHODONTIST2_NAME || 'Orthodontist Test User 2',
        email: process.env.SEED_ORTHODONTIST2_EMAIL || 'orthodontist2@example.com',
        role: 'ORTHODONTIST',
        department: process.env.SEED_ORTHODONTIST2_DEPARTMENT || 'Orthodontics',
        password: process.env.SEED_ORTHODONTIST2_PASSWORD || 'AdminPass123',
        seededAt
      }),
      buildSeedUser({
        name: process.env.SEED_STUDENT_NAME || 'Student Test User',
        email: process.env.SEED_STUDENT_EMAIL || 'student@example.com',
        role: 'STUDENT',
        department: process.env.SEED_STUDENT_DEPARTMENT || 'Orthodontics',
        password: process.env.SEED_STUDENT_PASSWORD || 'AdminPass123',
        seededAt
      }),
      buildSeedUser({
        name: process.env.SEED_STUDENT2_NAME || 'Student Test User 2',
        email: process.env.SEED_STUDENT2_EMAIL || 'student2@example.com',
        role: 'STUDENT',
        department: process.env.SEED_STUDENT2_DEPARTMENT || 'Orthodontics',
        password: process.env.SEED_STUDENT2_PASSWORD || 'AdminPass123',
        seededAt
      })
    ];

    console.log('Clearing existing data...');
    await query('SET FOREIGN_KEY_CHECKS = 0');
    await query('DELETE FROM audit_logs');
    await query('DELETE FROM refresh_tokens');
    await query('DELETE FROM patient_assignment_requests');
    await query('DELETE FROM patient_assignments');
    await query('DELETE FROM dental_chart_versions');
    await query('DELETE FROM dental_chart_custom_entries');
    await query('DELETE FROM dental_chart_entries');
    await query('DELETE FROM inventory_transactions');
    await query('DELETE FROM patient_material_usages');
    await query('DELETE FROM clinical_notes');
    await query('DELETE FROM medical_documents');
    await query('DELETE FROM payment_records');
    await query('DELETE FROM patient_histories');
    await query('DELETE FROM queue');
    await query('DELETE FROM visits');
    await query('DELETE FROM case_progress_logs');
    await query('DELETE FROM cases');
    await query('DELETE FROM inventory_items');
    await query('DELETE FROM patients');
    await query('DELETE FROM system_settings');
    await query('DELETE FROM users');
    await query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Creating default system settings...');
    await query(
      `INSERT INTO system_settings (setting_key, setting_value, description) VALUES
        (?, ?, ?),
        (?, ?, ?),
        (?, ?, ?),
        (?, ?, ?),
        (?, ?, ?)`,
      [
        'clinic_name', 'University Dental Hospital Orthodontics Clinic', 'Name of the clinic',
        'max_file_size', '10485760', 'Maximum file upload size in bytes (10MB)',
        'allowed_file_types', 'jpg,jpeg,png,pdf,doc,docx', 'Allowed file extensions for uploads',
        'session_timeout', '3600', 'Session timeout in seconds',
        'auto_logout', 'true', 'Enable automatic logout'
      ]
    );

    console.log('Creating users...');
    for (const seedUser of seedUsers) {
      await query('INSERT INTO users SET ?', seedUser.record);
    }

    console.log('Database seeding completed successfully.');
    console.log('\nLogin Credentials:');
    console.log('--------------------------------------------------------------');
    console.log('Email                     Role           Password');
    console.log('--------------------------------------------------------------');
    for (const seedUser of seedUsers) {
      console.log(
        `${seedUser.record.email.padEnd(25)} ${seedUser.record.role.padEnd(14)} ${seedUser.password}`
      );
    }
    console.log('--------------------------------------------------------------');

    const temporaryUsers = seedUsers.filter((seedUser) => !seedUser.usesProvidedPassword);
    if (temporaryUsers.length > 0) {
      console.log('\nUsers with temporary passwords:');
      for (const seedUser of temporaryUsers) {
        console.log(`- ${seedUser.record.email} (${seedUser.record.role})`);
      }
    }

    console.log('\nOptional seed env vars:');
    console.log('- SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, SEED_ADMIN_DEPARTMENT, SEED_ADMIN_PASSWORD');
    console.log('- SEED_RECEPTION_EMAIL, SEED_RECEPTION_NAME, SEED_RECEPTION_DEPARTMENT, SEED_RECEPTION_PASSWORD');
    console.log('- SEED_ORTHODONTIST_EMAIL, SEED_ORTHODONTIST_NAME, SEED_ORTHODONTIST_DEPARTMENT, SEED_ORTHODONTIST_PASSWORD');
    console.log('- SEED_ORTHODONTIST2_EMAIL, SEED_ORTHODONTIST2_NAME, SEED_ORTHODONTIST2_DEPARTMENT, SEED_ORTHODONTIST2_PASSWORD');
    console.log('- SEED_STUDENT_EMAIL, SEED_STUDENT_NAME, SEED_STUDENT_DEPARTMENT, SEED_STUDENT_PASSWORD');
    console.log('- SEED_STUDENT2_EMAIL, SEED_STUDENT2_NAME, SEED_STUDENT2_DEPARTMENT, SEED_STUDENT2_PASSWORD');
    console.log('\nReady to start the application.');
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
