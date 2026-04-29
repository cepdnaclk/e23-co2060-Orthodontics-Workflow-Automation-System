const bcrypt = require('bcryptjs');
const { query } = require('../src/config/database');
const { generateTemporaryPassword } = require('../src/utils/password');
require('dotenv').config();

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    const seededAt = new Date();
    const adminPassword = (process.env.SEED_ADMIN_PASSWORD || '').trim() || generateTemporaryPassword();
    const usesProvidedPassword = Boolean((process.env.SEED_ADMIN_PASSWORD || '').trim());
    const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@orthoflow.edu').trim();
    const adminName = (process.env.SEED_ADMIN_NAME || 'System Administrator').trim();
    const adminDepartment = (process.env.SEED_ADMIN_DEPARTMENT || 'Orthodontics').trim();

    // Clear existing data in reverse dependency order
    console.log('🧹 Clearing existing data...');
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
    await query('DELETE FROM cases');
    await query('DELETE FROM inventory_items');
    await query('DELETE FROM patients');
    await query('DELETE FROM system_settings');
    await query('DELETE FROM users');
    await query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('⚙️ Creating default system settings...');
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

    // Insert users
    console.log('👥 Creating users...');
    const users = [
      {
        name: adminName,
        email: adminEmail,
        password_hash: bcrypt.hashSync(adminPassword, 12),
        role: 'ADMIN',
        department: adminDepartment || null,
        status: 'ACTIVE',
        must_change_password: !usesProvidedPassword,
        password_changed_at: usesProvidedPassword ? seededAt : null,
        last_login: null,
        last_activity_at: null
      }
    ];

    for (const user of users) {
      await query('INSERT INTO users SET ?', user);
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('\n👤 Login Credentials:');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ Email                       │ Role  │ Password Mode         │');
    console.log('├──────────────────────────────────────────────────────────────┤');
    console.log(`│ ${adminEmail.padEnd(27)} │ ADMIN │ ${(usesProvidedPassword ? 'configured via .env' : 'generated temporary').padEnd(21)} │`);
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log(`Password: ${adminPassword}`);
    if (!usesProvidedPassword) {
      console.log('This is a temporary password. The seeded admin must change it after the first login.');
    }
    console.log('\nOptional seed env vars: SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, SEED_ADMIN_DEPARTMENT, SEED_ADMIN_PASSWORD');
    console.log('\n🎯 Ready to start the application!');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
