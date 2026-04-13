<!-- <p align="center">
  <img src="assets/logo-horizontal.png" alt="OpenMAIC" width="420"/>
</p> -->

# OpenMAIC (Multi-User Fork)

<p align="center">
  <img src="assets/banner.png" alt="OpenMAIC Banner" width="680"/>
</p>

<p align="center">
  <b>Immersive, multi-agent learning with persistent accounts and role-based access control.</b>
</p>

<p align="center">
  <a href="https://tutor.tajwali.uk"><img src="https://img.shields.io/badge/Demo-Live-brightgreen?style=flat-square" alt="Live Demo"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square" alt="License: AGPL-3.0"/></a>
</p>

## 📖 Overview

This is a significantly extended fork of the original **OpenMAIC** (Open Multi-Agent Interactive Classroom). While the original project focuses on ephemeral, session-based learning, this fork adds a full **multi-user system** with persistent accounts, role-based dashboards (Admin, Teacher, Student), and cross-device access.

Courses you generate are now saved to a persistent database, allowing students to track their progress, teachers to manage assignments, and admins to oversee the entire platform.

---

## 🏗️ Architecture

This fork is designed for high availability and production stability, hosted on a private Proxmox infrastructure.

### Infrastructure Stack
- **Cluster:** 3-node Proxmox VE cluster.
- **Compute:** 3 dedicated LXC containers:
  - `openmaic-dev`: Development environment (192.168.10.30, port 3001)
  - `openmaic-prod`: Production environment (192.168.10.128, port 3000)
  - `supabase`: Self-hosted Supabase stack (192.168.10.129)
- **Networking:** Cloudflare Tunnel exposing the production instance at [tutor.tajwali.uk](https://tutor.tajwali.uk).
- **Runtime:** Next.js in **standalone mode**, managed by a `systemd` service for automatic restarts.
- **Package Manager:** `pnpm`.

---

## ✨ New Features (Multi-User Fork)

Since diverging from the original repo, the following features have been implemented:

### 👤 Multi-User & Auth
- **Supabase Authentication:** Secure login and signup flow.
- **Role-Based Access Control (RBAC):**
  - `admin`: Full system management, user role control, and teacher account creation.
  - `teacher`: Course management, student assignments, and invite code generation.
  - `mature_student`: Standard student with full access to their own progress.
  - `school_student`: Managed student accounts linked to a specific teacher.
- **Profile Management:** Edit display names, gender, and passwords.

### 📚 Course Persistence
- **Database Storage:** All generated courses are saved to Supabase.
- **Incremental Saves:** Courses are saved scene-by-scene during generation to prevent data loss on timeouts.
- **Metadata Enhancement:** Automatic AI-driven subject classification, grade level assignment, and course title generation.

### 👩‍🏫 Teacher & Admin Tools
- **Teacher Dashboard:** 
  - Manage students and view their progress.
  - Assign/unassign courses to specific students.
  - Generate and manage invite codes for student onboarding.
- **Exam System:** Generate timed AI exams from course content and track student results.
- **Admin Dashboard:** View all users, modify roles, and manage accounts via the GoTrue Admin API.

---

## 🚀 Deployment

### Production Build
The project uses Next.js standalone mode to minimize the production footprint.

```bash
# Build the application
pnpm build

# CRITICAL: Copy environment variables to the standalone folder
cp .env.local .next/standalone/.env.local

# The deployment script automates this process
/opt/deploy-prod.sh
```

### Environment Variables
The following variables are required for the multi-user system:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=       # Port 8000 (Kong)
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=           # For admin operations
SUPABASE_AUTH_URL=              # Port 9999 (GoTrue direct)

# AI Providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
# ... other provider keys
```

---

## 🛠️ Known Issues & Roadmap

- **Unassign Courses:** UI/API for unassigning courses is currently in progress (Phase 12).
- **524 Timeouts:** Cloudflare may return a 524 timeout on extremely long course generations (>10 scenes). Incremental saves mitigate data loss.
- **TTS Stability:** Text-to-speech occasionally fails due to upstream API rate limits or proxy issues.
- **Auth Cookies:** Cloudflare tunnels occasionally interfere with cookie-based auth for server-side reads; use `getUser()` pattern where possible.

---

## 🤝 Contributing

This fork follows the same core architecture as the original OpenMAIC but adds database and auth layers. See `GEMINI.md` for the latest developer handoff notes and implementation details.

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

