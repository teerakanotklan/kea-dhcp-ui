# Kea DHCP Server Web Management UI

A modern web management platform for **Kea DHCP Server**, built with a sleek glassmorphic UI. Powered by **Node.js (Express API in TypeScript) + React (Vite + TypeScript + Tailwind CSS)** using a single-port architecture that serves both the REST API and the production frontend bundle directly.

It communicates with and controls Kea DHCPv4 in real time through the **Kea Control Agent (REST API, port 8000)** and standard `systemctl` / `journalctl` commands.

---

## Features

- **Real-time Dashboard (Dual-Service Monitoring)**:
  - Live status tracking of both **`kea-dhcp4-server`** (DHCPv4 engine) and **`kea-ctrl-agent`** (REST Control Agent)
  - Scope counts, static reservations, active leases, and capacity utilization
  - Dynamic pool utilization charts and progress indicators
  - Independent service controls (Start, Stop, Restart)
- **High Availability & Cluster Synchronization**:
  - Multi-node Kea clustering (Primary / Secondary / Standby nodes)
  - Peer heartbeat monitoring, health checks, and automatic config sync
- **Authentication & Security (Admin Role)**:
  - JWT token authentication (HMAC-SHA256)
  - Default credentials: `admin` / `admin123`
- **Scope & Subnet Management**:
  - CIDR subnet definitions (e.g. `192.168.100.0/24`) with dynamic pools (`192.168.100.10 - 192.168.100.200`)
  - Configurable default gateways (`routers`), DNS servers (`domain-name-servers`), domain search list, and custom Kea option-data
- **Integrated Static Host Reservations**:
  - Permanent MAC-to-IP reservations (`reservations`) organized within each scope
  - Conflict prevention against duplicate IPs or MAC addresses
- **Lease Management via REST API**:
  - Fetches live active leases through the Kea Control Agent (`lease4-get-all`) with the `libdhcp_lease_cmds.so` hook
  - Real-time search, filtering, and manual lease release (`lease4-del`)
  - CSV export capability
- **Configuration Safety & Automatic Backups**:
  - Kea Control Agent serves as runtime source-of-truth (`config-set` & `config-write`)
  - Automated timestamped backups of `/etc/kea/kea-dhcp4.conf` prior to configuration commits
- **Integrated Service Logs**:
  - Live system log viewer via `journalctl` with service filtering and auto-polling

---

## Development & Build Guide

### Prerequisites
- **Node.js**: v20 LTS or higher
- **Package Manager**: [pnpm](https://pnpm.io/) v10.x (Recommended: enable via Corepack)
  ```bash
  corepack enable pnpm
  # or install globally:
  npm install -g pnpm
  ```

### Initial Setup
```bash
# 1. Clone repository
git clone <repository-url>
cd kea-dhcp-ui

# 2. Install workspace dependencies
pnpm install

# 3. Create local environment configuration
cp .env.example .env
```

---

### Development Mode (Running with File Watchers)

To run both backend and frontend concurrently in development mode:

```bash
pnpm run dev
```

This starts:
1. **Frontend (Vite dev server)** at `http://localhost:5173` with Hot Module Replacement (HMR).
   - Any API requests sent to `/api/*` are automatically proxied to the Express backend at `http://localhost:3000`.
2. **Backend (Express API + TypeScript Watcher)** at `http://localhost:3000`.
   - Automatically recompiles TypeScript files in `server/src/` via `tsc -w` to `server/dist/`.
   - Node process automatically restarts upon recompile via `node --watch`.

#### Running Client or Server Separately:
```bash
# Run only frontend dev server (Vite)
pnpm run dev:client

# Run only backend dev server (TypeScript watcher + Node watch)
pnpm run dev:server
```

---

### Workflow When Modifying Code

| Area Modified | Location | Behavior & Required Action |
| :--- | :--- | :--- |
| **Frontend UI** | `client/src/**/*` | Vite updates the browser instantly via **Hot Module Replacement (HMR)**. No manual build or restart required. |
| **Backend API** | `server/src/**/*` | In `pnpm run dev`, TypeScript watcher compiles to `server/dist` and Node auto-restarts. When adding new endpoints or types, verify with `pnpm run build`. |
| **Shared Types** | `shared/types/**/*` | Shared TypeScript interfaces and Zod schemas used by both frontend and backend. Automatically picked up in `dev` mode. |

---

### Building for Production & Verification

Before committing code or deploying to production, run the build verification:

```bash
# Build both Backend (server/dist) and Frontend (client/dist)
pnpm run build
```

This performs:
1. **Backend**: Runs `tsc` to compile TypeScript in `server/src` into `server/dist/`.
2. **Frontend**: Runs `tsc` (typecheck) followed by `vite build` into `client/dist/`.

#### Typecheck Command
```bash
# Validates TypeScript compilation across the entire workspace
pnpm run typecheck
```

Ensure that:
- There are **no TypeScript compilation errors** (`tsc` exits with code 0).
- There are **no build warnings or broken imports**.

---

### Testing Single-Port Production Locally

In production, the Express backend serves both the REST API endpoints and the static compiled frontend bundle from `client/dist` on a single port (default: `3000`):

```bash
# 1. Build production bundles
pnpm run build

# 2. Start the production server
pnpm start
# or: node server/index.js
```

Then open your browser at `http://localhost:3000` or check the health check endpoint:

```bash
curl http://localhost:3000/api/health
```

---

## Automated Installation on a Linux Server

For production deployment on Linux servers, use the provided `install.sh` script:

### Supported Operating Systems:
- **Debian family**: Debian 11 / 12, Ubuntu 22.04 / 24.04 LTS (packages `kea-dhcp4-server` and `kea-ctrl-agent`)
- **Enterprise Linux (RHEL family)**: Rocky Linux 8 / 9, AlmaLinux 8 / 9, RHEL 8 / 9, CentOS Stream, Fedora (package `kea`)

### Installation Steps:
```bash
# 1. Clone the project onto the server
git clone <repository-url> /opt/kea-dhcp-ui
cd /opt/kea-dhcp-ui

# 2. Run the installer as root
sudo bash install.sh
```

### The `install.sh` script automatically:
1. Detects the Linux distribution and selects the package manager (`apt` or `dnf`/`yum`)
2. Installs required Kea packages: `kea-dhcp4-server`, `kea-ctrl-agent`, `curl`, `git`
3. Installs Node.js 20 LTS from NodeSource if not present
4. Creates a dedicated unprivileged user `dhcpui`
5. Configures `/etc/sudoers.d/kea-dhcp-ui` for controlled Kea service management
6. Locates and configures the `libdhcp_lease_cmds.so` hook library
7. Generates initial `/etc/kea/kea-dhcp4.conf` and `/etc/kea/kea-ctrl-agent.conf` configurations
8. Installs pnpm/node dependencies and builds the production bundle (`pnpm run build`)
9. Installs and starts the systemd service `kea-dhcp-ui.service` on port `3000`

---

## Accessing the System

After deployment:
- **URL**: `http://<server-ip>:3000` (or `http://localhost:3000`)
- **Default Username**: `admin`
- **Default Password**: `admin123`

---

## Linux Service Management Commands

```bash
# Check Web UI status
sudo systemctl status kea-dhcp-ui

# Check Kea DHCP Server status
sudo systemctl status kea-dhcp4-server

# Check Kea Control Agent (REST API) status
sudo systemctl status kea-ctrl-agent

# View service logs
sudo journalctl -u kea-dhcp-ui -f
sudo journalctl -u kea-dhcp4-server -u kea-ctrl-agent -f
```
