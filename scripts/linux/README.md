# Linux Deployment Scripts

Scripts for deploying and managing the Evernote Clone on Linux servers.

## Quick Start

```bash
# Make scripts executable
chmod +x scripts/linux/*.sh

# Install dependencies, Docker services, and build
./scripts/linux/install.sh

# Start all services
./scripts/linux/start.sh

# Check status
./scripts/linux/status.sh
```

## Scripts

| Script | Description |
|--------|-------------|
| `config.sh` | Shared configuration, environment variables, and helper functions |
| `install.sh` | Install dependencies, start Docker services, run migrations, build apps |
| `start.sh` | Start API and Web servers with automatic port fallback |
| `stop.sh` | Stop all application services (graceful shutdown) |
| `restart.sh` | Restart all services |
| `status.sh` | Show status of all services, health checks, and resource usage |
| `logs.sh` | View application and Docker logs |

## Port Fallback

The start script automatically finds available ports if the default ones are occupied:

- **API**: Tries ports 4000-4005
- **Web**: Tries ports 3000-3005
- **WebSocket**: Tries ports 1234-1239

The actual ports used are saved to `.pids/runtime.conf` and displayed by `status.sh`.

## Commands

### Start Services

```bash
./scripts/linux/start.sh
```

### Stop Services

```bash
# Stop app services (keeps Docker running)
./scripts/linux/stop.sh

# Force stop
./scripts/linux/stop.sh --force

# Stop everything including Docker
./scripts/linux/stop.sh --all
```

### Check Status

```bash
./scripts/linux/status.sh
```

### View Logs

```bash
# View all logs
./scripts/linux/logs.sh

# View specific service
./scripts/linux/logs.sh api
./scripts/linux/logs.sh web
./scripts/linux/logs.sh docker

# Follow logs (like tail -f)
./scripts/linux/logs.sh -f api

# Show more lines
./scripts/linux/logs.sh -n 100 api
```

## Directory Structure

After running, the scripts create:

```
project/
├── .pids/           # PID files for running processes
│   ├── api.pid
│   ├── web.pid
│   └── runtime.conf # Runtime port configuration
└── logs/            # Application log files
    ├── api.log
    └── web.log
```

## Requirements

- **Node.js** 18+
- **pnpm** (installed automatically if missing)
- **Docker** and Docker Compose
- **curl** (for health checks)
