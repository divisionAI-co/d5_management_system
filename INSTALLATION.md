# D5 Management System - Complete Installation Guide

This guide walks you through setting up the D5 Management System from scratch on a fresh machine.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have the following installed:

### Required Software

- [ ] **Node.js** (version 18 or higher)
  - Download: https://nodejs.org/
  - Verify: `node --version` should show v18.x.x or higher
  - Verify: `npm --version` should show 9.x.x or higher

- [ ] **PostgreSQL** (version 14 or higher)
  - Download: https://www.postgresql.org/download/
  - Verify: `psql --version` should show 14.x or higher
  - Service should be running

- [ ] **Git**
  - Download: https://git-scm.com/
  - Verify: `git --version`

### Optional but Recommended

- [ ] **VS Code** or your preferred IDE
- [ ] **Postman** or similar for API testing (Swagger UI is included)
- [ ] **pgAdmin** or similar PostgreSQL GUI client

---

## 🚀 Installation Steps

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone <repository-url>
cd d5_management_system

# Verify you're in the right directory
ls -la
# You should see: apps/, package.json, README.md, etc.
```

### Step 2: Install Dependencies

```bash
# Install all dependencies (backend + frontend)
npm install

# This will install dependencies for:
# - Root workspace
# - apps/backend
# - apps/frontend
```

**Expected output**: 
```
added XXX packages in Xs
```

**Troubleshooting**:
- If you get permission errors, don't use `sudo`. Fix npm permissions instead.
- If installation fails, try deleting `node_modules` and `package-lock.json`, then run again.

### Step 3: Set Up PostgreSQL Database

#### Create Database

**Option A: Using psql (command line)**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE d5_management;

# Verify
\l  # Should list d5_management

# Exit
\q
```

**Option B: Using pgAdmin**
1. Open pgAdmin
2. Right-click "Databases" → "Create" → "Database"
3. Name: `d5_management`
4. Click "Save"

#### Note Database Connection Details

You'll need:
- **Host**: `localhost` (usually)
- **Port**: `5432` (default)
- **Database**: `d5_management`
- **Username**: `postgres` (or your username)
- **Password**: Your PostgreSQL password

### Step 4: Configure Backend Environment

```bash
# Navigate to backend
cd apps/backend

# Copy environment template
cp .env.example .env

# Open .env in your editor
# Windows: notepad .env
# Mac/Linux: nano .env  or  code .env
```

**Edit `.env` with your settings:**

```env
# Database - REQUIRED
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/d5_management"

# JWT - REQUIRED (change these in production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key

# Email - OPTIONAL for initial setup
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Google Drive - REQUIRED for shared drive integration
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=service-account@your-project.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABC123...\n-----END PRIVATE KEY-----\n"
# ID of the shared drive you want to expose (leave empty to use My Drive of account)
GOOGLE_DRIVE_SHARED_DRIVE_ID=your-shared-drive-id
# Optional: comma separated scopes (defaults to full drive access). Example shown keeps default.
# GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive
# Optional: user to impersonate when using a Workspace service account
# GOOGLE_DRIVE_IMPERSONATE_USER=admin@your-company.com

# Keep other settings as default for now
```

**Important**:
- Replace `YOUR_PASSWORD` with your PostgreSQL password
- For email, you can leave it as-is and configure later
- Never commit `.env` to Git (it's in .gitignore)

### Step 5: Run Database Migrations

```bash
# Still in apps/backend directory

# Generate Prisma Client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev

# You'll be asked to name the migration
# Enter: "initial_schema"
```

**Expected output**:
```
✔ Generated Prisma Client
✔ Applying migration `20231111000000_initial_schema`
```

**Verify**: 
```bash
# Open Prisma Studio to see your database
npx prisma studio

# Should open browser at http://localhost:5555
# You should see all tables (User, Customer, Lead, etc.)
```

### Step 6: Seed Initial Data

```bash
# Still in apps/backend directory

# Run seed script (creates test users)
npm run seed
```

**Expected output**:
```
🌱 Seeding database...
✅ Admin user created: admin@d5.com
✅ Salesperson created: sales@d5.com
✅ Recruiter created: recruiter@d5.com
✅ HR user created: hr@d5.com
✅ Account Manager created: manager@d5.com
✅ Employee created: employee@d5.com
✅ Company settings created
✅ Albanian national holidays created
✅ Default invoice template created

🎉 Seeding completed!
```

### Step 7: Configure Frontend Environment

```bash
# Navigate to frontend
cd ../frontend  # or: cd apps/frontend from root

# Copy environment template
cp .env.example .env

# Content of .env (usually doesn't need changes)
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=D5 Management System
```

### Step 8: Start Development Servers

**Option A: Start Both Servers Together (Recommended)**

```bash
# From project root
cd ../..  # or navigate to project root
npm run dev
```

**Expected output**:
```
[backend] 🚀 D5 Management System API is running!
[backend] 📝 API: http://localhost:3000/api
[backend] 📚 Docs: http://localhost:3000/api/docs
[frontend] VITE ready in XXX ms
[frontend] ➜ Local: http://localhost:5173/
```

**Option B: Start Servers Separately**

```bash
# Terminal 1 - Backend
cd apps/backend
npm run dev

# Terminal 2 - Frontend (open new terminal)
cd apps/frontend
npm run dev
```

---

## ✅ Verification Checklist

### Backend Verification

1. **API is running**
   - [ ] Open: http://localhost:3000/api
   - [ ] Should see: `{"message":"API is running"}`or similar

2. **Swagger Documentation**
   - [ ] Open: http://localhost:3000/api/docs
   - [ ] Should see: Interactive API documentation
   - [ ] Should see: Auth, Users, and other endpoints

3. **Database Connection**
   - [ ] Run: `cd apps/backend && npx prisma studio`
   - [ ] Should open: http://localhost:5555
   - [ ] Should see: All tables with data

4. **Test Login API**
   - [ ] Go to: http://localhost:3000/api/docs
   - [ ] Find: `POST /api/auth/login`
   - [ ] Click "Try it out"
   - [ ] Enter:
     ```json
     {
       "email": "admin@d5.com",
       "password": "admin123"
     }
     ```
   - [ ] Click "Execute"
   - [ ] Should receive: Access token and user data

### Frontend Verification

1. **Frontend is running**
   - [ ] Open: http://localhost:5173
   - [ ] Should see: Login page

2. **Login Works**
   - [ ] Email: `admin@d5.com`
   - [ ] Password: `admin123`
   - [ ] Click "Sign in"
   - [ ] Should redirect to: Dashboard

3. **Navigation Works**
   - [ ] Click: "Customers" link
   - [ ] Should see: Customers page (placeholder)
   - [ ] Try other navigation links

4. **User Info Displayed**
   - [ ] Top right should show: "Admin User (ADMIN)"
   - [ ] Logout button should be visible

---

## 🎯 Quick Test

Run this complete test to verify everything works:

1. Open http://localhost:5173
2. Login with `admin@d5.com` / `admin123`
3. Should see dashboard
4. Open http://localhost:3000/api/docs
5. Try the `/api/users/me` endpoint (you may need to authorize first)
6. Should return your admin user data

**If all of the above works, your installation is successful! 🎉**

---

## 🔧 Troubleshooting

### Issue: "Database connection failed"

**Symptoms**: Backend won't start, error about DATABASE_URL

**Solutions**:
1. Verify PostgreSQL is running:
   ```bash
   # Mac
   brew services list
   # Should show postgresql@XX started
   
   # Linux
   sudo service postgresql status
   # Should show active (running)
   
   # Windows
   # Check Services app for "postgresql-x64-XX"
   ```

2. Test connection:
   ```bash
   psql -U postgres -d d5_management
   # Should connect without error
   ```

3. Verify `.env` DATABASE_URL:
   - Check username (usually `postgres`)
   - Check password (your PostgreSQL password)
   - Check port (usually `5432`)
   - Check database name (`d5_management`)

### Issue: "Port 3000 already in use"

**Solution 1**: Kill the process
```bash
# Mac/Linux
lsof -ti:3000 | xargs kill

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
```

**Solution 2**: Change the port
```bash
# Edit apps/backend/.env
PORT=3001

# Then use http://localhost:3001/api
```

### Issue: "Port 5173 already in use"

**Solution**: Similar to above, but for port 5173

### Issue: "Cannot find module '@prisma/client'"

**Solution**:
```bash
cd apps/backend
npx prisma generate
```

### Issue: "npm install fails"

**Solutions**:
1. Clear cache and try again:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Check Node.js version:
   ```bash
   node --version
   # Should be 18.x.x or higher
   ```

3. Try with legacy peer deps:
   ```bash
   npm install --legacy-peer-deps
   ```

### Issue: "Frontend can't connect to backend"

**Solutions**:
1. Verify backend is running at http://localhost:3000/api
2. Check `apps/frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:3000/api
   ```
3. Check browser console for CORS errors
4. Restart both servers

### Issue: Login doesn't work

**Solutions**:
1. Verify seed script ran successfully:
   ```bash
   cd apps/backend
   npm run seed
   ```

2. Check database has users:
   ```bash
   npx prisma studio
   # Go to User table, should see 6 users
   ```

3. Try API login first at http://localhost:3000/api/docs

---

## 📊 Expected Resource Usage

After successful installation:

- **Disk Space**: ~500MB (node_modules + dependencies)
- **RAM Usage**: ~500MB (both servers running)
- **Ports Used**: 
  - 3000 (backend)
  - 5173 (frontend)
  - 5432 (PostgreSQL)
  - 5555 (Prisma Studio, when running)

---

## 🎓 Next Steps

After successful installation:

1. **Explore the API**
   - Visit: http://localhost:3000/api/docs
   - Try different endpoints
   - Test authentication

2. **Explore the Frontend**
   - Login with different user roles
   - Navigate through pages
   - Check browser console for any errors

3. **Read the Documentation**
   - [INDEX.md](INDEX.md) - Documentation index
   - [SUMMARY.md](SUMMARY.md) - What's built and what's next
   - [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - How to implement features

4. **Start Developing**
   - Pick a module from IMPLEMENTATION_GUIDE.md
   - Follow the specifications
   - Test with Swagger UI
   - Build the frontend pages

---

## 🆘 Still Having Issues?

1. **Check the logs**:
   - Backend: Terminal where backend is running
   - Frontend: Browser console (F12)
   - Database: Check PostgreSQL logs

2. **Verify prerequisites**:
   ```bash
   node --version    # Should be 18+
   npm --version     # Should be 9+
   psql --version    # Should be 14+
   ```

3. **Fresh start**:
   ```bash
   # Stop all servers (Ctrl+C)
   # Delete everything
   rm -rf node_modules apps/backend/node_modules apps/frontend/node_modules
   rm -rf package-lock.json
   
   # Start over from Step 2
   npm install
   # Continue with setup...
   ```

4. **Reset database**:
   ```bash
   cd apps/backend
   npx prisma migrate reset  # WARNING: Deletes all data
   npm run seed              # Recreate test users
   ```

---

## ✨ Installation Complete!

You should now have:
- ✅ Backend API running on http://localhost:3000/api
- ✅ Frontend app running on http://localhost:5173
- ✅ PostgreSQL database with schema and test data
- ✅ API documentation at http://localhost:3000/api/docs
- ✅ Test users for all roles

**You're ready to start developing! 🚀**

---

## 📝 Quick Command Reference

```bash
# Start development
npm run dev

# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend

# Database GUI
cd apps/backend && npx prisma studio

# Reset database (WARNING: deletes data)
cd apps/backend && npx prisma migrate reset

# Recreate test users
cd apps/backend && npm run seed

# Type checking
npm run typecheck

# Linting
npm run lint

# Build for production
npm run build
```

---

**Last Updated**: November 11, 2025  
**Installation Time**: ~15-30 minutes  
**Difficulty**: Beginner-Intermediate

