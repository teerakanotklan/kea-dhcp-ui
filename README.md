# Kea DHCP Server Web Management UI

A web application for managing **Kea DHCP Server**, featuring a modern glassmorphism design. It is built with **Node.js (Express API) + React (Vite)** and uses a single-port architecture that serves the production bundle directly.

It communicates with and controls Kea DHCPv4 in real time through the **Kea Control Agent (REST API, port 8000)** and the standard `systemctl` / `journalctl` commands.

---

## Features

- **Real-time Dashboard (Dual-Service Monitoring)**:
  - Shows the live status of both **`kea-dhcp4-server`** (DHCPv4 engine) and **`kea-ctrl-agent`** (REST Control Agent)
  - Summarizes Scopes, Static Reservations, Active Leases, and Pool Capacity
  - Charts and bars showing Address Pool utilization (%) for each subnet
  - Start, stop, and restart each service independently
- **Authentication & Security (Admin Role)**:
  - JWT token authentication (HMAC-SHA256)
  - Default account: `admin` / password: `admin123`
- **Scope & Subnet Management**:
  - Manage Kea subnet CIDRs (e.g. `192.168.100.0/24`) and dynamic pool ranges (`192.168.100.10 - 192.168.100.200`)
  - Configure gateway (`routers`), DNS servers (`domain-name-servers`), domain name, and custom Kea option-data
- **Integrated Static Host Reservations**:
  - Bind MAC addresses to permanent IP addresses (`reservations`) directly within each scope, following Kea's native structure
  - Prevents duplicate IP or MAC reservations within the same subnet
- **Lease Management via REST API**:
  - Fetches live active leases through the Kea Control Agent (`lease4-get-all`) with the `libdhcp_lease_cmds.so` hook
  - Search and filter by state, with a Release Lease function (`lease4-del`)
  - Export data to CSV
- **Configuration & Safety**:
  - Uses the Kea Control Agent as the source of truth for runtime commands (`config-set`) and for persisting to disk (`config-write`)
  - Automatically backs up `/etc/kea/kea-dhcp4.conf` before every save
- **Service Logs**:
  - Fetches live logs through `journalctl`, with filtering for Kea DHCPv4, Kea Control Agent, or All Services, plus auto-polling

---

## Automated Installation on a Linux Server

The project includes an `install.sh` script for fully automated installation. It detects the OS, installs the Kea DHCP stack packages, creates a dedicated user (`dhcpui`), configures sudoers permissions, builds the frontend, and enables the systemd service.

### Supported operating systems:
- **Debian family**: Debian 11 / 12, Ubuntu 22.04 / 24.04 LTS (packages `kea-dhcp4-server` and `kea-ctrl-agent`)
- **Enterprise Linux (RHEL family)**: Rocky Linux 8 / 9, AlmaLinux 8 / 9, RHEL 8 / 9, CentOS Stream, Fedora (package `kea`)

### Installation steps:

```bash
# 1. Clone the project onto the server
git clone <repository-url> /opt/kea-dhcp-ui
cd /opt/kea-dhcp-ui

# 2. Run the installer as root
sudo bash install.sh
```

### The `install.sh` script automatically performs the following:
1. Detects the Linux distribution and selects the package manager (`apt` or `dnf`/`yum`)
2. Installs the Kea DHCP packages: `kea-dhcp4-server`, `kea-ctrl-agent`, `curl`, `git`
3. Installs Node.js 20 LTS from NodeSource if it is not already present
4. Creates a dedicated system user `dhcpui` for security
5. Configures `/etc/sudoers.d/kea-dhcp-ui` so `dhcpui` can run only the Kea service lifecycle commands
6. Locates and enables the `libdhcp_lease_cmds.so` hook library automatically
7. Creates the initial configs `/etc/kea/kea-dhcp4.conf` and `/etc/kea/kea-ctrl-agent.conf` (connected via the Unix socket `/run/kea/kea4-ctrl-socket`)
8. Installs Node dependencies and builds the frontend production bundle (`pnpm run build`)
9. Creates and enables the systemd unit `kea-dhcp-ui.service` on port `3000`

---

## Accessing the System

After a successful installation, open a web browser and go to:
- **URL**: `http://<server-ip>:3000` (or `http://localhost:3000`)
- **Username**: `admin`
- **Password**: `admin123`

---

## Linux Service Management Commands

```bash
# Check Web UI status
sudo systemctl status kea-dhcp-ui

# Check Kea DHCP Server status
sudo systemctl status kea-dhcp4-server

# Check Kea Control Agent (REST API) status
sudo systemctl status kea-ctrl-agent

# View logs
sudo journalctl -u kea-dhcp-ui -f
sudo journalctl -u kea-dhcp4-server -u kea-ctrl-agent -f
```
