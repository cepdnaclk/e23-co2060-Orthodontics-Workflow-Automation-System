# OrthoFlow Backend API

University Orthodontics Clinical Workflow Management System - Production-Grade Backend

## 🏥 Overview

OrthoFlow is a comprehensive orthodontic clinic management system designed for university dental hospitals. This backend provides a secure, scalable API with role-based access control, patient management, clinical workflows, and inventory tracking.

## ✨ Features

- **🔐 Authentication & Authorization**: JWT with refresh tokens, role-based access control
- **👥 Multi-Role Support**: Admin, Orthodontist, Dental Surgeon, Nurse, Student, Reception
- **🏥 Patient Management**: Complete patient records with visit history
- **📅 Visit Tracking**: Scheduling, completion tracking, and visit history
- **📁 Document Management**: Secure file uploads for radiographs and clinical documents
- **📝 Clinical Notes**: Treatment notes with supervisor verification
- **⏱️ Live Queue**: Real-time clinic queue management
- **📚 Case Tracking**: Student case management with supervisor oversight
- **📦 Inventory Management**: Stock tracking with automated alerts
- **📊 Reports & Analytics**: Comprehensive reporting system
- **🔍 Audit Logging**: Complete activity tracking

## 🛠️ Technology Stack

- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Database**: MySQL 8.0+
- **Authentication**: JWT (Access + Refresh tokens)
- **Validation**: Joi
- **File Uploads**: Multer
- **Security**: Helmet, CORS, bcrypt
- **Architecture**: MVC/Layered with RESTful APIs

## 📋 Prerequisites

- Node.js 16.0 or higher
- MySQL 8.0 or higher
- npm or yarn package manager

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd Backend
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=orthoflow

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_this_in_production
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# File Upload Configuration
UPLOAD_DIR=./src/uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,doc,docx

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### 3. Database Setup

```bash
# Run database migration
npm run migrate

# Seed with sample data
npm run seed
```

### 4. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start at `http://localhost:3000`

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/auth/login` | User login | Public |
| POST | `/auth/refresh` | Refresh access token | Public |
| POST | `/auth/logout` | User logout | Authenticated |
| GET | `/auth/profile` | Get current user | Authenticated |
| PUT | `/auth/profile` | Update profile | Authenticated |
| PUT | `/auth/change-password` | Change password | Authenticated |

### Patient Management

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/patients` | Get all patients | All authenticated |
| GET | `/patients/:id` | Get patient details | All authenticated |
| POST | `/patients` | Create patient | Admin, Reception, Ortho, Surgeon |
| PUT | `/patients/:id` | Update patient | Admin, Reception, Ortho, Surgeon |
| DELETE | `/patients/:id` | Delete patient | Admin only |
| GET | `/patients/stats` | Patient statistics | All authenticated |

### Visit Management

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/patients/:patientId/visits` | Get patient visits | All authenticated |
| POST | `/patients/:patientId/visits` | Create visit | Admin, Reception, Ortho, Surgeon |
| GET | `/visits/:id` | Get visit details | All authenticated |
| PUT | `/visits/:id` | Update visit | Admin, Ortho, Surgeon, Reception |
| DELETE | `/visits/:id` | Delete visit | Admin, Ortho, Surgeon |
| GET | `/visits/today` | Today's visits | All authenticated |
| GET | `/visits/stats` | Visit statistics | All authenticated |

### Document Management

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/patients/:patientId/documents` | Get patient documents | All authenticated |
| POST | `/patients/:patientId/documents` | Upload document | Clinical staff, Students |
| GET | `/documents/:id` | Get document details | All authenticated |
| GET | `/documents/:id/download` | Download document | All authenticated |
| PUT | `/documents/:id` | Update document | Clinical staff |
| DELETE | `/documents/:id` | Delete document | Admin, Ortho, Surgeon |

### Clinical Notes

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/patients/:patientId/clinical-notes` | Get patient notes | All authenticated |
| POST | `/patients/:patientId/clinical-notes` | Create note | All authenticated |
| GET | `/clinical-notes/:id` | Get note details | All authenticated |
| PUT | `/clinical-notes/:id` | Update note | Author only |
| DELETE | `/clinical-notes/:id` | Delete note | Author only |
| POST | `/clinical-notes/:id/verify` | Verify note | Clinical staff |
| GET | `/clinical-notes/pending` | Pending verification | Clinical staff |

### Queue Management

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/queue` | Get current queue | All authenticated |
| POST | `/queue` | Add to queue | Admin, Reception, Nurse |
| PUT | `/queue/:id/status` | Update status | Clinical staff, Nurse |
| DELETE | `/queue/:id` | Remove from queue | Admin, Reception, Nurse |
| GET | `/queue/stats` | Queue statistics | All authenticated |

### Case Management

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/cases` | Get all cases | All authenticated |
| GET | `/cases/:id` | Get case details | All authenticated |
| POST | `/cases` | Create case | Admin, Ortho, Surgeon |
| PUT | `/cases/:id` | Update case | All authenticated |
| DELETE | `/cases/:id` | Delete case | Admin, Ortho, Surgeon |
| GET | `/students/:studentId/cases` | Get student cases | All authenticated |
| GET | `/cases/stats` | Case statistics | All authenticated |

### Inventory Management

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/inventory` | Get inventory items | All authenticated |
| GET | `/inventory/:id` | Get item details | All authenticated |
| POST | `/inventory` | Create item | Admin, Nurse |
| PUT | `/inventory/:id` | Update item | Admin, Nurse |
| DELETE | `/inventory/:id` | Delete item | Admin only |
| PUT | `/inventory/:id/stock` | Update stock | Admin, Nurse |
| GET | `/inventory/transactions` | Get transactions | All authenticated |
| GET | `/inventory/stats` | Inventory statistics | All authenticated |

### User Management (Admin Only)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/users` | Get all users | Admin |
| GET | `/users/:id` | Get user details | Admin |
| POST | `/users` | Create user | Admin |
| PUT | `/users/:id` | Update user | Admin |
| DELETE | `/users/:id` | Delete user | Admin |
| GET | `/users/stats` | User statistics | Admin |
| GET | `/users/staff` | Staff directory | Admin |

### Reports (Admin Only)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/reports/patient-status` | Patient status report | Admin |
| GET | `/reports/visit-summary` | Visit summary report | Admin |
| GET | `/reports/inventory-alerts` | Inventory alerts | Admin |
| GET | `/reports/dashboard` | Dashboard report | Admin |

## 🔐 Authentication

All API endpoints (except login and refresh) require a valid JWT access token.

### Login Request
```json
{
  "email": "admin@orthoflow.edu",
  "password": "admin123"
}
```

### Login Response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "System Administrator",
      "email": "admin@orthoflow.edu",
      "role": "ADMIN",
      "department": "IT"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": "24h"
    }
  }
}
```

### Authorization Header
```
Authorization: Bearer <access_token>
```

## 🎯 Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **ADMIN** | Full system access, user management, reports |
| **ORTHODONTIST** | Patient management, visits, notes, case supervision |
| **DENTAL_SURGEON** | Patient access, visits, notes, inventory view |
| **NURSE** | Queue management, inventory updates, visit support |
| **STUDENT** | Assigned cases only, add notes, limited access |
| **RECEPTION** | Patient registration, queue, visit scheduling |

## 📊 Database Schema

The system uses a normalized MySQL database with the following core tables:

- `users` - User authentication and roles
- `patients` - Patient records and demographics
- `visits` - Patient visit history
- `clinical_notes` - Treatment notes with verification
- `medical_documents` - File uploads and radiographs
- `queue` - Live clinic queue
- `cases` - Student case tracking
- `inventory_items` - Material and supply management
- `audit_logs` - System activity tracking

See `database-schema.sql` for complete schema definition.

## 🔧 Development

### Running Tests
```bash
npm test
```

### Database Migration
```bash
npm run migrate
```

### Seed Sample Data
```bash
npm run seed
```

### Environment Variables
All configuration is handled through environment variables. See `.env.example` for complete list.

## 📝 Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ] // For validation errors
}
```

### Pagination Response
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "current_page": 1,
      "total_pages": 10,
      "total_records": 100,
      "limit": 10
    }
  }
}
```

## 🔒 Security Features

- **JWT Authentication**: Access and refresh tokens with secure expiration
- **Password Hashing**: bcrypt with 12 salt rounds
- **Rate Limiting**: Configurable rate limits on sensitive endpoints
- **Input Validation**: Comprehensive validation using Joi schemas
- **SQL Injection Prevention**: Parameterized queries throughout
- **File Upload Security**: Type validation, size limits, path traversal prevention
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **Audit Logging**: Complete activity tracking for compliance

## 📁 File Structure

```
Backend/
├── src/
│   ├── config/          # Database and auth configuration
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── routes/          # API routes
│   ├── uploads/         # File upload directory
│   └── utils/           # Utility functions
├── scripts/             # Database scripts
├── server.js            # Main server file
├── package.json         # Dependencies
├── .env.example         # Environment template
└── database-schema.sql # Database schema
```

## 🚀 Production Deployment

1. **Environment Setup**: Set production environment variables
2. **Database**: Configure production MySQL instance
3. **Security**: Update JWT secrets and database credentials
4. **File Storage**: Configure secure file storage (S3 recommended)
5. **SSL/TLS**: Enable HTTPS in production
6. **Monitoring**: Set up application monitoring and logging
7. **Backup**: Configure regular database backups

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation

## 📊 Sample Data

The seed script creates sample data including:
- 7 users with different roles
- 5 patients with complete records
- 4 visits with various procedures
- 3 student cases with different statuses
- 6 inventory items with stock levels
- 3 clinical notes
- 2 queue entries

Use the credentials in the seed output to test different user roles and permissions.

---

**OrthoFlow** - Modern Orthodontic Clinic Management 🦷✨
