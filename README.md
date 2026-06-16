# Construction Task & Workflow Management System (Archelite)

A mobile-first, offline-tolerant task and workflow management system designed for construction sites. The UI is modeled after messaging applications (WhatsApp-like) where every task operates as a conversational thread allowing site workers, engineers, and accountants to collaborate, upload attachments, request approvals, and sync changes instantly.

---

## 🚀 Technology Stack

- **Mobile Frontend:** React Native + Expo + TypeScript
- **Web Admin Console & Backend API:** Next.js (Route Handlers & Server Actions)
- **Database & ORM:** PostgreSQL + Prisma ORM
- **Media Storage:** AWS S3 (with a local fallback uploader for development)
- **Synchronization Layer:** Local SQLite + Custom Transactional Sync Queue (WatermelonDB compatible)
- **Monitoring & Errors:** Sentry

---

## 📂 Repository Structure

This project is structured as a **Turborepo Monorepo** enabling extensive code-sharing (API schemas, database clients, typescript models) between the Mobile App and the Web Console.

```text
task-management-app-archelite/
├── apps/
│   ├── mobile/         # React Native / Expo Mobile Client
│   └── web/            # Next.js API Backend & Admin Panel Frontend
├── packages/
│   ├── database/       # Prisma Client, Database Schema, and Seeding Scripts
│   ├── ts-config/      # Shared TypeScript configuration baselines
│   └── validation/     # Shared validation rules (Zod schemas)
├── package.json        # Workspace declarations & root build pipelines
├── turbo.json          # Turborepo caching & task definitions
└── README.md           # Documentation
```

---

## 🛠️ Prerequisites

To run this application locally, ensure you have:
1. **Node.js** (v18.0.0 or higher recommended)
2. **npm** (v10.0.0 or higher)
3. **PostgreSQL** active and running locally on port `5432`

---

## 🏁 Getting Started (Setup Instructions)

Follow these steps to configure your local development environment:

### 1. Install Workspace Dependencies
From the repository root, install dependencies across all workspaces:
```bash
npm install
```

### 2. Configure Local Environment Variables
Copy the template `.env` file to your root and database packages:
```bash
# Copy example configuration to root
cp .env.example .env

# Copy to database packages
cp .env packages/database/.env
```
*Note: If your local PostgreSQL server requires a password, open `.env` and update the `DATABASE_URL` username and password fields.*

### 3. Initialize the Database Schema
Push the Prisma schema to your running local PostgreSQL database:
```bash
npx prisma db push --schema=packages/database/schema.prisma
```

### 4. Seed the Database
Populate initial operational data (default Categories like Accounting/Construction, and default mock Employees of varying seniority Levels):
```bash
npx prisma db seed --schema=packages/database/schema.prisma
```

---

## 💻 Running the Services

### Start Next.js Backend & Web Admin Console
To run the Next.js API server and Dashboard:
```bash
# Starts Next.js on http://localhost:3000
npm run dev --workspace=web
```

### Start Expo Mobile Client
To run the mobile app bundler (Metro):
```bash
# Starts Metro bundler
npm run start --workspace=mobile
```
Press `i` to open in the iOS simulator, or `a` to open in the Android emulator.

---

## 🔒 API Endpoints & Auth Flow

The API routes are implemented inside Next.js (`apps/web/app/api/`):
- **Mock OTP Login (`POST /api/auth/otp`):** 
  - Send a payload containing `phone` or `email`.
  - It generates a mock OTP (`123456`) and logs it to the server console. 
  - Resubmitting with `otp: "123456"` verifies you and issues a session token.
- **Offline Sync Layer (`GET / POST /api/sync`):**
  - Serves as the pull/push synchronization endpoint for SQLite.
  - Automatically filters tasks: Members only receive tasks they created, are assigned to, or are mentioned in. Admins/Super Admins pull all global data.
- **Mock Storage Uploader (`POST /api/storage/presign` & `POST /api/storage/mock-upload`):**
  - If AWS credentials are not configured, uploads are written directly to a local filesystem folder (`apps/web/public/uploads`) so media features function without cloud configurations.

---

## 🧑‍💻 Git Workflow

To stage, commit, and push your changes safely back to GitHub:
```bash
# 1. Stage changes
git add .

# 2. Create commit
git commit -m "feat: your feature description"

# 3. Push to GitHub
git push origin main
```

