#!/usr/bin/env bash
# ==============================================================================
# Kea DHCP Web UI - Automated Production Installer for Linux Server
# Supports:
#   - Debian 11 / 12
#   - Ubuntu 22.04 / 24.04 LTS
#   - RHEL / CentOS / Rocky Linux / AlmaLinux 8 / 9
#   - Fedora 38+
# ==============================================================================

set -euo pipefail

# Text Formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✔ SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# 1. Verify Root Privileges
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root. Please run with sudo:"
    echo "  sudo bash $0"
    exit 1
fi

echo -e "${BOLD}${CYAN}"
echo "=========================================================="
echo "    Kea DHCP Server Web UI - Linux Automated Installer    "
echo "=========================================================="
echo -e "${NC}"

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log_info "Installation directory: ${INSTALL_DIR}"

# 2. Detect Operating System Distribution
if [[ ! -f /etc/os-release ]]; then
    log_error "Cannot identify Linux distribution (/etc/os-release not found)."
    exit 1
fi

. /etc/os-release

OS_ID="${ID:-unknown}"
OS_LIKE="${ID_LIKE:-}"
OS_NAME="${PRETTY_NAME:-$OS_ID}"

log_info "Detected Operating System: ${BOLD}${OS_NAME}${NC}"

PKG_MANAGER=""
KEA_DHCP4_PKG=""
KEA_AGENT_PKG=""
KEA_DHCP4_SERVICE=""
KEA_AGENT_SERVICE="kea-ctrl-agent"

if [[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" || "$OS_LIKE" =~ (ubuntu|debian) ]]; then
    PKG_MANAGER="apt"
    KEA_DHCP4_PKG="kea-dhcp4-server"
    KEA_AGENT_PKG="kea-ctrl-agent"
    KEA_DHCP4_SERVICE="kea-dhcp4-server"
elif [[ "$OS_ID" =~ (rhel|centos|rocky|almalinux|fedora) || "$OS_LIKE" =~ (rhel|fedora|centos) ]]; then
    PKG_MANAGER="dnf"
    if ! command -v dnf &>/dev/null; then
        PKG_MANAGER="yum"
    fi
    KEA_DHCP4_PKG="kea"
    KEA_AGENT_PKG="kea"
    KEA_DHCP4_SERVICE="kea-dhcp4"
else
    log_error "Unsupported Linux distribution family: ${OS_ID}"
    exit 1
fi

log_info "Package Manager: ${PKG_MANAGER}"
log_info "Kea DHCP4 Service: ${KEA_DHCP4_SERVICE}"
log_info "Kea Control Agent Service: ${KEA_AGENT_SERVICE}"

# 3. Update Package Cache and Install Base Dependencies
log_info "Updating package lists and installing required system packages..."

if [[ "$PKG_MANAGER" == "apt" ]]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y -q
    apt-get install -y -q curl git sudo coreutils net-tools "$KEA_DHCP4_PKG" "$KEA_AGENT_PKG"
elif [[ "$PKG_MANAGER" == "dnf" || "$PKG_MANAGER" == "yum" ]]; then
    $PKG_MANAGER makecache -y
    $PKG_MANAGER install -y epel-release || true
    $PKG_MANAGER install -y curl git sudo coreutils net-tools "$KEA_DHCP4_PKG"
fi

log_success "System packages installed successfully."

# 4. Check / Install Node.js (v20 LTS recommended)
NEED_NODE=true
if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -ge 18 ]]; then
        log_info "Found existing Node.js $(node -v) (Satisfies requirement >= 18)."
        NEED_NODE=false
    else
        log_warn "Existing Node.js $(node -v) is older than v18. Upgrading to Node.js 20 LTS..."
    fi
fi

if [[ "$NEED_NODE" == "true" ]]; then
    log_info "Installing Node.js 20 LTS via official NodeSource repository..."
    if [[ "$PKG_MANAGER" == "apt" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -q nodejs
    else
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        $PKG_MANAGER install -y nodejs
    fi
    log_success "Installed Node.js $(node -v) and npm $(npm -v)."
fi

# 5. Create Dedicated System User 'dhcpui'
SYSTEM_USER="dhcpui"
log_info "Configuring dedicated system user '${SYSTEM_USER}'..."

if ! id -u "$SYSTEM_USER" &>/dev/null; then
    useradd -r -s /usr/sbin/nologin -c "Kea DHCP Web UI Service Account" "$SYSTEM_USER" || \
    useradd -r -s /sbin/nologin -c "Kea DHCP Web UI Service Account" "$SYSTEM_USER"
    log_success "Created system user '${SYSTEM_USER}'."
else
    log_info "System user '${SYSTEM_USER}' already exists."
fi

# 6. Configure Sudoers Permissions for 'dhcpui'
SUDOERS_FILE="/etc/sudoers.d/kea-dhcp-ui"
log_info "Writing restricted sudo privileges to ${SUDOERS_FILE}..."

cat << EOF > "$SUDOERS_FILE"
# Sudo privileges for Kea DHCP Web UI (${SYSTEM_USER})
Defaults:${SYSTEM_USER} !requiretty

# Kea Service lifecycle controls
${SYSTEM_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart ${KEA_DHCP4_SERVICE}, /bin/systemctl reload ${KEA_DHCP4_SERVICE}, /bin/systemctl stop ${KEA_DHCP4_SERVICE}, /bin/systemctl start ${KEA_DHCP4_SERVICE}, /bin/systemctl status ${KEA_DHCP4_SERVICE}
${SYSTEM_USER} ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart ${KEA_DHCP4_SERVICE}, /usr/bin/systemctl reload ${KEA_DHCP4_SERVICE}, /usr/bin/systemctl stop ${KEA_DHCP4_SERVICE}, /usr/bin/systemctl start ${KEA_DHCP4_SERVICE}, /usr/bin/systemctl status ${KEA_DHCP4_SERVICE}

${SYSTEM_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart ${KEA_AGENT_SERVICE}, /bin/systemctl reload ${KEA_AGENT_SERVICE}, /bin/systemctl stop ${KEA_AGENT_SERVICE}, /bin/systemctl start ${KEA_AGENT_SERVICE}, /bin/systemctl status ${KEA_AGENT_SERVICE}
${SYSTEM_USER} ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart ${KEA_AGENT_SERVICE}, /usr/bin/systemctl reload ${KEA_AGENT_SERVICE}, /usr/bin/systemctl stop ${KEA_AGENT_SERVICE}, /usr/bin/systemctl start ${KEA_AGENT_SERVICE}, /usr/bin/systemctl status ${KEA_AGENT_SERVICE}

# Fallback service controls for alternative aliases
${SYSTEM_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart kea-dhcp4-server, /bin/systemctl reload kea-dhcp4-server, /bin/systemctl stop kea-dhcp4-server, /bin/systemctl start kea-dhcp4-server, /bin/systemctl status kea-dhcp4-server
${SYSTEM_USER} ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart kea-dhcp4-server, /usr/bin/systemctl reload kea-dhcp4-server, /usr/bin/systemctl stop kea-dhcp4-server, /usr/bin/systemctl start kea-dhcp4-server, /usr/bin/systemctl status kea-dhcp4-server
${SYSTEM_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart kea-dhcp4, /bin/systemctl reload kea-dhcp4, /bin/systemctl stop kea-dhcp4, /bin/systemctl start kea-dhcp4, /bin/systemctl status kea-dhcp4
${SYSTEM_USER} ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart kea-dhcp4, /usr/bin/systemctl reload kea-dhcp4, /usr/bin/systemctl stop kea-dhcp4, /usr/bin/systemctl start kea-dhcp4, /usr/bin/systemctl status kea-dhcp4

# Logs and validation
${SYSTEM_USER} ALL=(ALL) NOPASSWD: /usr/bin/journalctl, /bin/journalctl
${SYSTEM_USER} ALL=(ALL) NOPASSWD: /usr/sbin/kea-dhcp4, /sbin/kea-dhcp4
EOF

chmod 0440 "$SUDOERS_FILE"
if visudo -cf "$SUDOERS_FILE" &>/dev/null; then
    log_success "Sudoers rules validated successfully."
else
    log_error "Sudoers syntax check failed. Reverting ${SUDOERS_FILE}."
    rm -f "$SUDOERS_FILE"
    exit 1
fi

# 7. Configure Kea Control Agent Systemd Override (Bypass ConditionFileNotEmpty if present)
mkdir -p /etc/systemd/system/kea-ctrl-agent.service.d
cat << 'EOF' > /etc/systemd/system/kea-ctrl-agent.service.d/override.conf
[Unit]
ConditionFileNotEmpty=
EOF
systemctl daemon-reload

# 8. Locate Hook Library & Create Kea Configuration Files
HOOK_PATH=$(find /usr/lib -name "libdhcp_lease_cmds.so" 2>/dev/null | head -n 1 || echo "")
log_info "Discovered Kea lease hook path: ${HOOK_PATH:-'None (Memfile fallback)'}"

mkdir -p /etc/kea/backups
mkdir -p /var/lib/kea
mkdir -p /run/kea

# Kea Control Agent Configuration
cat << 'EOF' > /etc/kea/kea-ctrl-agent.conf
{
  "Control-agent": {
    "http-host": "127.0.0.1",
    "http-port": 8000,
    "control-sockets": {
      "dhcp4": {
        "socket-type": "unix",
        "socket-name": "/run/kea/kea4-ctrl-socket"
      }
    },
    "loggers": [
      {
        "name": "kea-ctrl-agent",
        "output_options": [
          {
            "output": "stdout"
          }
        ],
        "severity": "INFO"
      }
    ]
  }
}
EOF

# Kea DHCP4 Configuration Template
KEA_CONF="/etc/kea/kea-dhcp4.conf"
if [[ -f "$KEA_CONF" ]]; then
    BACKUP_CONF="/etc/kea/kea-dhcp4.conf.bak.$(date +%Y%m%d%H%M%S)"
    cp -p "$KEA_CONF" "$BACKUP_CONF"
    log_info "Backed up existing kea-dhcp4.conf to: ${BACKUP_CONF}"
fi

HOOK_BLOCK=""
if [[ -n "$HOOK_PATH" ]]; then
    HOOK_BLOCK="\"hooks-libraries\": [ { \"library\": \"$HOOK_PATH\" } ],"
fi

cat << EOF > "$KEA_CONF"
{
  "Dhcp4": {
    "interfaces-config": {
      "interfaces": [ "*" ]
    },
    "control-socket": {
      "socket-type": "unix",
      "socket-name": "/run/kea/kea4-ctrl-socket"
    },
    "lease-database": {
      "type": "memfile",
      "persist": true,
      "name": "/var/lib/kea/kea-leases4.csv"
    },
    "valid-lifetime": 4000,
    "renew-timer": 1000,
    "rebind-timer": 2000,
    $HOOK_BLOCK
    "subnet4": [
      {
        "id": 1,
        "subnet": "192.168.100.0/24",
        "pools": [
          { "pool": "192.168.100.10 - 192.168.100.200" }
        ],
        "option-data": [
          {
            "name": "routers",
            "data": "192.168.100.1"
          },
          {
            "name": "domain-name-servers",
            "data": "8.8.8.8, 1.1.1.1"
          }
        ],
        "reservations": []
      }
    ]
  }
}
EOF

# Ensure permissions
chown root:"$SYSTEM_USER" "$KEA_CONF" /etc/kea/kea-ctrl-agent.conf
chmod 664 "$KEA_CONF" /etc/kea/kea-ctrl-agent.conf
chown -R "$SYSTEM_USER":"$SYSTEM_USER" /etc/kea/backups
chmod 775 /etc/kea/backups

# Restart and enable Kea services
systemctl enable "${KEA_DHCP4_SERVICE}" "${KEA_AGENT_SERVICE}" || true
systemctl restart "${KEA_DHCP4_SERVICE}"
systemctl restart "${KEA_AGENT_SERVICE}"

log_success "Kea DHCP Server and Control Agent services started."

# 9. Install NPM Dependencies & Build Production Bundle
log_info "Installing project dependencies and building React frontend..."

cd "$INSTALL_DIR"
npm run install:all
npm run build

chown -R "$SYSTEM_USER":"$SYSTEM_USER" "$INSTALL_DIR"

log_success "Project build completed successfully."

# 10. Configure and Start Systemd Service (kea-dhcp-ui.service)
SERVICE_FILE="/etc/systemd/system/kea-dhcp-ui.service"
NODE_BIN="$(command -v node)"

log_info "Creating systemd unit: ${SERVICE_FILE}..."

cat << EOF > "$SERVICE_FILE"
[Unit]
Description=Kea DHCP Server Web Management UI
After=network.target network-online.target ${KEA_DHCP4_SERVICE}.service ${KEA_AGENT_SERVICE}.service
Wants=network-online.target

[Service]
Type=simple
User=${SYSTEM_USER}
Group=${SYSTEM_USER}
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=KEA_DHCP4_SERVICE=${KEA_DHCP4_SERVICE}
Environment=KEA_CTRL_AGENT_SERVICE=${KEA_AGENT_SERVICE}
Environment=KEA_CTRL_AGENT_URL=http://127.0.0.1:8000
Environment=KEA_CONF_PATH=${KEA_CONF}
ExecStart=${NODE_BIN} server/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kea-dhcp-ui

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable kea-dhcp-ui.service
systemctl restart kea-dhcp-ui.service

# 11. Verification & Summary Output
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

echo -e "\n${BOLD}${GREEN}==========================================================${NC}"
echo -e "${BOLD}${GREEN}      Kea DHCP Web UI Installation Completed!           ${NC}"
echo -e "${BOLD}${GREEN}==========================================================${NC}"
echo -e "Web Management UI:   ${BOLD}${CYAN}http://${SERVER_IP}:3000${NC} (or http://localhost:3000)"
echo -e "Default Username:    ${BOLD}admin${NC}"
echo -e "Default Password:    ${BOLD}admin123${NC}"
echo -e "System Service:      ${BOLD}systemctl status kea-dhcp-ui${NC}"
echo -e "Kea DHCP Daemon:     ${BOLD}systemctl status ${KEA_DHCP4_SERVICE}${NC}"
echo -e "Control Agent:       ${BOLD}systemctl status ${KEA_AGENT_SERVICE}${NC}"
echo -e "Kea Config:          ${BOLD}${KEA_CONF}${NC}"
echo -e "${GREEN}==========================================================${NC}\n"
