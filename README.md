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

## ✨ Features (v2.0 Multi-User System)

OpenMAIC 2.0 transforms the platform from a session-based tool into a complete Learning Management System (LMS):

- **Full Auth System:** Supabase integration for secure login/signup.
- **Role-Based Dashboards:** Specialized views for Admin, Teacher, and Students.
- **Course Persistence:** All generated content is saved scene-by-scene to a persistent database.
- **Teacher-Student Linking:** Invite code system to manage student groups.
- **Assignments & Exams:** Distribute courses to students and generate timed assessments.
- **Deep Analytics:** Track student progress, scores, and engagement.
- **AI Classification:** Automatic subject, grade, and title generation for all courses.

## 📚 Documentation

For detailed information, please refer to our documentation files:

- **[Deployment Guide](docs/DEPLOYMENT.md)** — Installation, environment variables, and self-hosting instructions.
- **[Administrator Manual](docs/ADMIN-MANUAL.md)** — Managing users, subjects, and platform statistics.
- **[Teacher Manual](docs/TEACHER-MANUAL.md)** — Managing students, generating courses, and assignments.
- **[Student Manual](docs/STUDENT-MANUAL.md)** — Getting started and using the AI classroom.
- **[API Documentation](docs/API.md)** — Endpoint reference and role-based access control.

---

## 🚀 Quick Start

1. **Install Dependencies:** `pnpm install`
2. **Configure Environment:** Copy `.env.example` to `.env.local` and add your API keys.
3. **Database Setup:** Apply the migrations in `supabase/migrations/` to your PostgreSQL database.
4. **Run Development:** `pnpm dev`
5. **Production Build:** `pnpm build && systemctl restart openmaic`

---

## 🛠️ Known Issues & Roadmap

- **524 Timeouts:** Cloudflare may return a 524 timeout on extremely long course generations (>10 scenes). Incremental saves mitigate data loss.
- **TTS Stability:** Text-to-speech occasionally fails due to upstream API rate limits or proxy issues.
- **Auth Cookies:** Cloudflare tunnels occasionally interfere with cookie-based auth for server-side reads; use `getUser()` pattern where possible.

---

## 🤝 Contributing

This fork follows the same core architecture as the original OpenMAIC but adds database and auth layers. See `GEMINI.md` for the latest developer handoff notes and implementation details.

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

