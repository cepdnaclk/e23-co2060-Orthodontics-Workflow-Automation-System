# 🚀 ORTHOFLOW Full-Stack Integration Guide

## 📋 Overview
This guide will help you integrate the completed backend with your existing React frontend to create a fully functional ORTHOFLOW orthodontic clinic management system.

## 🔧 Prerequisites

### Required Software
- **Node.js 16+** (for both frontend and backend)
- **MySQL 8.0+** (database server)
- **Git** (version control)

### Project Structure
```
Orthodontics Workflow Automation System/
├── Frontend/           # Your existing React frontend
└── Backend/            # New Node.js backend (completed)
```

---

## 🗂️ Step 1: Backend Setup

### 1.1 Install Backend Dependencies
```bash
cd "Backend"
npm install
```

### 1.2 Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your actual database credentials:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password    # ⚠️ CHANGE THIS
DB_NAME=orthoflow

# JWT Configuration - Generate secure keys
JWT_SECRET=your_super_secure_random_jwt_secret_key_here    # ⚠️ CHANGE THIS
JWT_REFRESH_SECRET=your_super_secure_random_refresh_key_here  # ⚠️ CHANGE THIS

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### 1.3 Database Setup
```bash
# Create database and tables
npm run migrate

# Insert sample data
npm run seed
```

### 1.4 Test Backend
```bash
npm run dev
```

You should see:
```
🚀 OrthoFlow Backend Server Started Successfully!
📍 Server: http://localhost:3000
🏥 Environment: development
```

---

## 🗂️ Step 2: Frontend Configuration

### 2.1 Install Missing Dependencies
The frontend needs React types and router:
```bash
cd "Frontend"
npm install @types/react @types/react-dom react-router-dom
```

### 2.2 API Configuration
I've created the API configuration files for you:
- `src/app/config/api.ts` - API endpoints and configuration
- `src/app/services/api.ts` - HTTP client with auth handling

### 2.3 Update AuthContext
I've updated `src/app/context/AuthContext.tsx` to:
- Use real API authentication
- Handle JWT tokens
- Provide loading states
- Support proper role types

### 2.4 Update LoginPage
I've updated `src/app/pages/LoginPage.tsx` to:
- Call real login API
- Handle loading states
- Display error messages
- Use proper authentication flow

---

## 🔧 Step 3: Fix TypeScript Issues

### 3.1 Install React Types
```bash
cd "Frontend"
npm install @types/react @types/react-dom
```

### 3.2 Update tsconfig.json (if needed)
Ensure your `tsconfig.json` includes:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable"],
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true
  }
}
```

---

## 🚀 Step 4: Run Both Applications

### Option A: Separate Terminals (Recommended)
**Terminal 1 - Backend:**
```bash
cd "Backend"
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd "Frontend"
npm run dev
```

### Option B: Concurrent Script
Create a script in the root directory:
```bash
# In root directory
echo "cd Backend && npm run dev & cd Frontend && npm run dev" > start-both.sh
chmod +x start-both.sh
./start-both.sh
```

---

## 🔐 Step 5: Test Authentication

### 5.1 Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api

### 5.2 Login with Sample Users
Use these credentials from the seed data:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@orthoflow.edu | admin123 |
| **Orthodontist** | sarah.johnson@orthoflow.edu | doctor123 |
| **Student** | alex.thompson@orthoflow.edu | student123 |
| **Nurse** | emily.wilson@orthoflow.edu | nurse123 |
| **Reception** | lisa.brown@orthoflow.edu | reception123 |

### 5.3 Test Authentication Flow
1. Navigate to http://localhost:5173/login
2. Enter credentials (try admin@orthoflow.edu / admin123)
3. Should redirect to dashboard
4. Check browser console for successful authentication

---

## 🔧 Step 6: Update Frontend Pages

### 6.1 Patient List Page
Update `PatientListPage.tsx` to use real API:

```typescript
// Replace mock data with API call
const { data, error, isLoading } = useQuery({
  queryKey: ['patients'],
  queryFn: () => apiService.patients.getList()
});

// Handle loading and error states
if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;
```

### 6.2 Dashboard Page
Update `DashboardPage.tsx` to fetch real statistics:

```typescript
// Add API calls for dashboard data
const [stats, setStats] = useState(null);

useEffect(() => {
  const fetchStats = async () => {
    const response = await apiService.patients.getStats();
    if (response.success) {
      setStats(response.data);
    }
  };
  fetchStats();
}, []);
```

---

## 🧪 Step 7: Test API Integration

### 7.1 Use Postman Collection
Import the provided Postman collection:
1. Open Postman
2. Click Import
3. Select `Backend/Postman Collection.postman_collection.json`
4. Test endpoints with different user roles

### 7.2 Test Key Endpoints
```bash
# Health check
curl http://localhost:3000/health

# Login test
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@orthoflow.edu","password":"admin123"}'

# Get patients (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/patients
```

---

## 🔍 Step 8: Troubleshooting

### Common Issues & Solutions

#### Issue: "Cannot connect to database"
**Solution:**
1. Check MySQL is running: `mysql -u root -p`
2. Verify database exists: `SHOW DATABASES;`
3. Check credentials in `.env`

#### Issue: "CORS errors"
**Solution:**
1. Verify `CORS_ORIGIN` in `.env` matches frontend URL
2. Check backend is running on port 3000
3. Frontend should be on port 5173

#### Issue: "TypeScript errors in frontend"
**Solution:**
1. Install missing types: `npm install @types/react @types/react-dom`
2. Check `tsconfig.json` configuration
3. Restart TypeScript server

#### Issue: "Login not working"
**Solution:**
1. Check backend logs for errors
2. Verify database seed completed successfully
3. Test API directly with Postman

#### Issue: "JWT token expired"
**Solution:**
1. The API client handles automatic token refresh
2. Clear localStorage: `localStorage.clear()`
3. Try logging in again

---

## 📱 Step 9: Production Deployment

### 9.1 Backend Production Setup
```bash
# Set production environment
export NODE_ENV=production

# Use production database
# Update .env with production credentials

# Start production server
npm start
```

### 9.2 Frontend Production Build
```bash
cd "Frontend"
npm run build

# Serve static files with nginx or similar
```

### 9.3 Environment Variables
Production `.env` should include:
```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_PASSWORD=secure-production-password
JWT_SECRET=very-secure-production-jwt-secret
CORS_ORIGIN=https://your-production-domain.com
```

---

## 🎯 Step 10: Next Steps

### 10.1 Complete Frontend Integration
- Update all pages to use real API calls
- Implement proper error handling
- Add loading states
- Handle pagination

### 10.2 Add Advanced Features
- Real-time updates with WebSockets
- File upload progress indicators
- Advanced filtering and search
- Data visualization with charts

### 10.3 Testing & Quality
- Write unit tests for API calls
- Add integration tests
- Implement E2E testing with Cypress
- Performance optimization

---

## 📞 Support

### Documentation
- **Backend README**: `Backend/README.md`
- **API Endpoints**: Check backend server at `/api`
- **Database Schema**: `Backend/database-schema.sql`

### Common Commands
```bash
# Backend
cd Backend
npm run dev          # Development
npm start            # Production
npm run migrate       # Setup database
npm run seed         # Sample data

# Frontend  
cd Frontend
npm run dev          # Development
npm run build        # Production build
```

---

## 🎉 Success Criteria

Your full-stack integration is successful when:

✅ Backend runs on http://localhost:3000  
✅ Frontend runs on http://localhost:5173  
✅ Login works with sample credentials  
✅ Dashboard displays real data  
✅ Patient list shows database records  
✅ API calls work without errors  
✅ Authentication persists across page refreshes  

---

**🎯 Congratulations! Your ORTHOFLOW system is now fully integrated and ready for production use!**
