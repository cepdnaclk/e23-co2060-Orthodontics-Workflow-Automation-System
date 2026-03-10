const bcrypt = require('bcryptjs');
const { query } = require('../src/config/database');
require('dotenv').config();

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await query('DELETE FROM audit_logs');
    await query('DELETE FROM refresh_tokens');
    await query('DELETE FROM inventory_transactions');
    await query('DELETE FROM clinical_notes');
    await query('DELETE FROM medical_documents');
    await query('DELETE FROM queue');
    await query('DELETE FROM visits');
    await query('DELETE FROM cases');
    await query('DELETE FROM inventory_items');
    await query('DELETE FROM patients');
    await query('DELETE FROM users');
    
    // Insert users
    console.log('👥 Creating users...');
    const users = [
      {
        name: 'System Administrator',
        email: 'admin@orthoflow.edu',
        password_hash: bcrypt.hashSync('Jk@xditc4', 12),
        role: 'ADMIN',
        department: 'IT',
        status: 'ACTIVE'
      }
    ];
    
    for (const user of users) {
      await query('INSERT INTO users SET ?', user);
    }
    
    console.log('✅ Database seeding completed successfully!');
    console.log('\n👤 Login Credentials:');
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│ Email                 │ Role      │ Password │');
    console.log('├─────────────────────────────────────────┤');
    console.log('│ admin@orthoflow.edu │ Admin    │ Jk@xditc4 │');
    console.log('└─────────────────────────────────────────────────┘');
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
