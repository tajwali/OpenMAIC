# Deployment Guide

This guide provides step-by-step instructions for self-hosting OpenMAIC 2.0 on a private server (e.g., Ubuntu, Proxmox LXC).

## System Requirements

- **Operating System:** Ubuntu 22.04 LTS or similar Linux distribution.
- **Runtime:** Node.js 20.x or higher.
- **Package Manager:** `pnpm` (recommended).
- **Database:** Supabase (Self-hosted stack or Cloud version).
- **Memory:** Minimum 2GB RAM (4GB recommended for build process).
- **Disk:** 5GB+ available space.

## Step 1: Clone and Install

```bash
git clone https://github.com/tajwali/OpenMAIC.git
cd OpenMAIC
pnpm install
```

## Step 2: Environment Configuration

Copy the example environment file and fill in your keys:

```bash
cp .env.example .env.local
nano .env.local
```

### Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Kong URL (API Gateway) | `http://192.168.10.129:8000` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anonymous Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role Key (Admin access) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_AUTH_URL` | Direct GoTrue direct URL (for Auth API) | `http://192.168.10.129:9999` |
| `GOOGLE_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `DEFAULT_MODEL` | Default LLM model string | `google:gemini-2.0-flash` |
| `TAVILY_API_KEY` | Tavily Web Search API Key | `tvly-...` |

> [!IMPORTANT]
> Always ensure `SUPABASE_AUTH_URL` points directly to the GoTrue service (default port 9999 in self-hosted) to bypass potential gateway timeouts or cookie issues.

## Step 3: Supabase Setup

### Database Migrations
If you are self-hosting Supabase, run the SQL migrations found in `supabase/migrations/` in order:

1. `001_phase4_schema.sql` (Core tables: classrooms, user_profiles, assignments)
2. `002_subjects.sql` (Subjects reference data)
3. `003_classrooms_grade.sql` (Grade fields)
4. `004_user_profiles_gender.sql` (Gender fields)
5. `005_platform_settings.sql` (Platform configuration)

### Storage
Ensure the `classrooms` bucket is created in Supabase Storage with public access if you plan to use it for media uploads.

## Step 4: Build and Standalone Mode

OpenMAIC uses Next.js Standalone mode for efficient production deployment.

```bash
pnpm build
# CRITICAL: Standalone mode needs .env.local inside its own folder
cp .env.local .next/standalone/.env.local
```

## Step 5: Systemd Service Setup

Create a service file to manage the application:

```bash
# /etc/systemd/system/openmaic.service
[Unit]
Description=OpenMAIC 2.0 Production
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/openmaic-dev
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable openmaic
systemctl start openmaic
```

## Step 6: Cloudflare Tunnel (Optional)

To expose your instance securely to the internet:

1. Install `cloudflared`.
2. Authenticate: `cloudflared tunnel login`.
3. Create tunnel: `cloudflared tunnel create openmaic`.
4. Route to your domain: `cloudflared tunnel route dns openmaic tutor.yourdomain.com`.
5. Run tunnel: `cloudflared tunnel run --url http://localhost:3000 openmaic`.

## Updating

To update your deployment to the latest version:

```bash
git pull
pnpm install
pnpm build
cp .env.local .next/standalone/.env.local
systemctl restart openmaic
```
