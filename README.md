# Evernote Clone

A modern, collaborative note-taking application built with Next.js, NestJS, and real-time collaboration using Yjs.

## Features

- ✍️ **Rich Text Editor** - TipTap-powered editor with formatting, lists, and images
- 🔄 **Real-time Collaboration** - Multiple users can edit the same note simultaneously (Yjs CRDT)
- 📁 **Organization** - Notebooks and tags to categorize your notes
- 🔍 **Full-text Search** - Powered by Meilisearch
- 📎 **File Attachments** - Upload files to S3/MinIO
- 🌙 **Dark Mode** - System-aware theme switching
- 📱 **Responsive** - Works on desktop and mobile

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React 19, TailwindCSS |
| Backend | NestJS, Prisma, PostgreSQL |
| Editor | TipTap + Yjs (CRDT) |
| Search | Meilisearch |
| Storage | MinIO (S3-compatible) |
| Cache | Redis |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### 1. Clone and Install

```bash
cd evernote-cloner2
pnpm install
```

### 2. Start Infrastructure

```bash
pnpm docker:up
```

This starts PostgreSQL, Redis, MinIO, and Meilisearch.

### 3. Setup Database

```bash
# Generate Prisma client and push schema
pnpm db:generate
pnpm db:push

# (Optional) Seed with demo data
pnpm --filter @evernote-clone/database seed
```

### 4. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

## Using Remote Services

To use remote PostgreSQL, Redis, S3, or Meilisearch instead of local Docker containers:

### Option 1: Set USE_REMOTE_SERVICES=true

Edit your `.env` file:

```env
USE_REMOTE_SERVICES="true"
DATABASE_URL="postgresql://user:password@remote-host:5432/database?schema=public&sslmode=require"
REDIS_URL="redis://:password@remote-host:6379"
S3_ENDPOINT="https://s3.amazonaws.com"
S3_FORCE_PATH_STYLE="false"
MEILISEARCH_HOST="https://your-meilisearch-instance.com"
```

### Option 2: Auto-detection

If your `DATABASE_URL` points to a non-localhost address, Docker containers will be skipped automatically.

### S3 Providers

| Provider | Endpoint | S3_FORCE_PATH_STYLE |
|----------|----------|---------------------|
| MinIO (local) | `http://localhost:9000` | `true` |
| AWS S3 | `https://s3.amazonaws.com` | `false` |
| Cloudflare R2 | `https://<account>.r2.cloudflarestorage.com` | `true` |
| DigitalOcean | `https://<region>.digitaloceanspaces.com` | `true` |


### 5. Start Development Servers

```bash
pnpm dev
```

This starts:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000
- **API Docs**: http://localhost:4000/api/docs
- **Yjs Server**: ws://localhost:1234

### Demo Credentials

```
Email: demo@example.com
Password: demo123
```

## Project Structure

```
evernote-cloner2/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # NestJS backend
├── packages/
│   ├── database/         # Prisma schema & client
│   ├── shared/           # Shared types & validation
│   └── yjs-server/       # Real-time collaboration server
├── docker/
│   └── docker-compose.yml
└── package.json
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Login with email/password |
| `POST /api/auth/register` | Create new account |
| `GET /api/notes` | List all notes |
| `POST /api/notes` | Create note |
| `GET /api/notes/:id` | Get single note |
| `PATCH /api/notes/:id` | Update note |
| `DELETE /api/notes/:id` | Delete note |
| `GET /api/notebooks` | List notebooks |
| `GET /api/tags` | List tags |
| `GET /api/search?q=` | Full-text search |
| `POST /api/shares` | Share note |
| `POST /api/storage/upload/:noteId` | Upload file |

Full API documentation available at http://localhost:4000/api/docs

## Development

### Running Individual Services

```bash
# Frontend only
pnpm --filter @evernote-clone/web dev

# Backend only
pnpm --filter @evernote-clone/api dev

# Yjs server only
pnpm --filter @evernote-clone/yjs-server dev
```

### Database Commands

```bash
# Open Prisma Studio
pnpm db:studio

# Create migration
pnpm --filter @evernote-clone/database migrate

# Reset database
pnpm --filter @evernote-clone/database push --force-reset
```

## License

MIT
