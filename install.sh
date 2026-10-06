#!/usr/bin/env bash
# ==============================================================================
# Kea DHCP Web UI - Automated Production Installer for Linux Server
# Supports:
#   - Debian 11 / 12
#   - Ubuntu 22.04 / 24.04 LTS
#   - RHEL / CentOS / Rocky Linux / AlmaLinux 8 / 9
#   - Fedora 38+
#
# Safe to re-run (idempotent):
#   - An existing /etc/kea/kea-dhcp4.conf is never replaced by the template
#     (it is backed up and only patched if the control socket / lease hook is
#     missing).
#   - Secrets (JWT_SECRET) live in /etc/kea-dhcp-ui/env and are kept across runs.
#   - The admin account is only created on first install.
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
KEA_DHCP4_SERVICE=""
KEA_AGENT_SERVICE="kea-ctrl-agent"

if [[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" || "$OS_LIKE" =~ (ubuntu|debian) ]]; then
    PKG_MANAGER="apt"
    KEA_DHCP4_SERVICE="kea-dhcp4-server"
elif [[ "$OS_ID" =~ (rhel|centos|rocky|almalinux|fedora) || "$OS_LIKE" =~ (rhel|fedora|centos) ]]; then
    PKG_MANAGER="dnf"
    if ! command -v dnf &>/dev/null; then
        PKG_MANAGER="yum"
    fi
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
    apt-get install -y -q curl ca-certificates sudo coreutils openssl \
        kea-dhcp4-server kea-ctrl-agent
else
    $PKG_MANAGER makecache -y
    if [[ "$OS_ID" != "fedora" ]]; then
        # EPEL is only needed (and only exists) on RHEL-family enterprise distros
        $PKG_MANAGER install -y epel-release \
            || log_warn "Could not install epel-release; continuing without it."
    fi
    $PKG_MANAGER install -y curl ca-certificates sudo coreutils openssl kea
    # Hook libraries (lease_cmds) ship in a separate package on RHEL-family distros
    $PKG_MANAGER install -y kea-hooks \
        || log_warn "Package 'kea-hooks' not available; lease commands hook may be missing."
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
    NODESOURCE_SCRIPT="$(mktemp)"
    trap 'rm -f "$NODESOURCE_SCRIPT"' EXIT
    if [[ "$PKG_MANAGER" == "apt" ]]; then
        curl -fsSL -o "$NODESOURCE_SCRIPT" https://deb.nodesource.com/setup_20.x
        bash "$NODESOURCE_SCRIPT"
        apt-get install -y -q nodejs
    else
        curl -fsSL -o "$NODESOURCE_SCRIPT" https://rpm.nodesource.com/setup_20.x
        bash "$NODESOURCE_SCRIPT"
        $PKG_MANAGER install -y nodejs
    fi
    log_success "Installed Node.js $(node -v) and npm $(npm -v)."
fi

if ! command -v pnpm &>/dev/null; then
    log_info "Installing pnpm package manager..."
    npm install -g pnpm
fi
log_success "Found pnpm $(pnpm -v)."

# Locate required binaries (absolute paths are baked into sudoers / helper)
KEA_BIN="$(command -v kea-dhcp4 || true)"
[[ -z "$KEA_BIN" && -x /usr/sbin/kea-dhcp4 ]] && KEA_BIN=/usr/sbin/kea-dhcp4
if [[ -z "$KEA_BIN" ]]; then
    log_error "kea-dhcp4 binary not found after package installation."
    exit 1
fi
SYSTEMCTL_BIN="$(command -v systemctl)"
JOURNALCTL_BIN="$(command -v journalctl)"

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

# 6. Privileged helper + restricted sudoers for 'dhcpui'
#    The service never gets to run kea-dhcp4 / journalctl with free-form arguments.
#    It may only call the root-owned helper, which validates its own arguments.
HELPER="/usr/local/sbin/kea-dhcp-ui-helper"
log_info "Installing privileged helper ${HELPER}..."

cat << 'EOF' | sed \
    -e "s|@KEA_BIN@|${KEA_BIN}|g" \
    -e "s|@JOURNALCTL@|${JOURNALCTL_BIN}|g" \
    -e "s|@DHCP_SVC@|${KEA_DHCP4_SERVICE}|g" \
    -e "s|@AGENT_SVC@|${KEA_AGENT_SERVICE}|g" > "$HELPER"
#!/usr/bin/env bash
# Managed by kea-dhcp-ui install.sh - do not edit.
set -euo pipefail

KEA_BIN='@KEA_BIN@'
JOURNALCTL='@JOURNALCTL@'
DHCP_SVC='@DHCP_SVC@'
AGENT_SVC='@AGENT_SVC@'

case "${1:-}" in
    validate)
        file="$(realpath -e -- "${2:-}" 2>/dev/null)" || { echo "Config file not found" >&2; exit 2; }
        case "$file" in
            /etc/kea/*) ;;
            *) echo "Path not allowed: $file" >&2; exit 2 ;;
        esac
        exec "$KEA_BIN" -t "$file" 2>&1
        ;;
    logs)
        which="${2:-all}"
        count="${3:-100}"
        if ! [[ "$count" =~ ^[0-9]+$ ]] || (( count < 1 || count > 500 )); then
            echo "Invalid line count" >&2; exit 2
        fi
        case "$which" in
            dhcp4) units=(-u "$DHCP_SVC") ;;
            agent) units=(-u "$AGENT_SVC") ;;
            all)   units=(-u "$DHCP_SVC" -u "$AGENT_SVC") ;;
            *) echo "Invalid log target" >&2; exit 2 ;;
        esac
        exec "$JOURNALCTL" "${units[@]}" -n "$count" --no-pager
        ;;
    *)
        echo "Usage: $0 {validate <file>|logs <dhcp4|agent|all> <lines>}" >&2
        exit 2
        ;;
esac
EOF
chown root:root "$HELPER"
chmod 0755 "$HELPER"

SUDOERS_FILE="/etc/sudoers.d/kea-dhcp-ui"
SUDOERS_TMP="$(mktemp)"
log_info "Writing restricted sudo privileges to ${SUDOERS_FILE}..."

# systemctl may be reachable through /bin and /usr/bin; allow both resolved forms
SYSTEMCTL_PATHS=("$SYSTEMCTL_BIN")
SYSTEMCTL_REAL="$(readlink -f "$SYSTEMCTL_BIN")"
[[ "$SYSTEMCTL_REAL" != "$SYSTEMCTL_BIN" ]] && SYSTEMCTL_PATHS+=("$SYSTEMCTL_REAL")

{
    echo "# Sudo privileges for Kea DHCP Web UI (${SYSTEM_USER}) - managed by install.sh"
    echo "Defaults:${SYSTEM_USER} !requiretty"
    for ctl in "${SYSTEMCTL_PATHS[@]}"; do
        for svc in "$KEA_DHCP4_SERVICE" "$KEA_AGENT_SERVICE"; do
            for action in start stop restart reload status; do
                echo "${SYSTEM_USER} ALL=(root) NOPASSWD: ${ctl} ${action} ${svc}"
            done
        done
    done
    echo "${SYSTEM_USER} ALL=(root) NOPASSWD: ${HELPER} validate *, ${HELPER} logs *"
} > "$SUDOERS_TMP"

if visudo -cf "$SUDOERS_TMP" &>/dev/null; then
    install -m 0440 -o root -g root "$SUDOERS_TMP" "$SUDOERS_FILE"
    rm -f "$SUDOERS_TMP"
    log_success "Sudoers rules validated successfully."
else
    log_error "Sudoers syntax check failed. Not installing ${SUDOERS_FILE}."
    rm -f "$SUDOERS_TMP"
    exit 1
fi

# 7. Configure Kea Control Agent Systemd Override (Bypass ConditionFileNotEmpty if present)
mkdir -p "/etc/systemd/system/${KEA_AGENT_SERVICE}.service.d"
cat << 'EOF' > "/etc/systemd/system/${KEA_AGENT_SERVICE}.service.d/override.conf"
[Unit]
ConditionFileNotEmpty=
EOF
systemctl daemon-reload

# 8. Locate Hook Libraries (Lease Commands & High Availability) & Create / Patch Kea Configuration Files
HOOK_PATH="$(find /usr/lib /usr/lib64 /usr/local/lib -name 'libdhcp_lease_cmds.so' 2>/dev/null | head -n 1 || true)"
HA_HOOK_PATH="$(find /usr/lib /usr/lib64 /usr/local/lib -name 'libdhcp_ha.so' 2>/dev/null | head -n 1 || true)"
log_info "Discovered Kea lease hook path: ${HOOK_PATH:-None (Memfile fallback)}"
log_info "Discovered Kea High Availability hook path: ${HA_HOOK_PATH:-None}"

mkdir -p /etc/kea/backups
mkdir -p /var/lib/kea
mkdir -p /run/kea

KEA_CONF="/etc/kea/kea-dhcp4.conf"
AGENT_CONF="/etc/kea/kea-ctrl-agent.conf"
STAMP="$(date +%Y%m%d%H%M%S)"
CONF_BACKUP=""
AGENT_BACKUP=""
DHCP_CHANGED=false
SOCKET="/run/kea/kea4-ctrl-socket"

rollback_configs() {
    log_warn "Rolling back Kea configuration files..."
    if [[ -n "$CONF_BACKUP" ]]; then cp -p "$CONF_BACKUP" "$KEA_CONF"; fi
    if [[ -n "$AGENT_BACKUP" ]]; then cp -p "$AGENT_BACKUP" "$AGENT_CONF"; fi
}

# --- kea-dhcp4.conf: never overwrite an existing configuration ---
if [[ -f "$KEA_CONF" ]]; then
    CONF_BACKUP="${KEA_CONF}.bak.${STAMP}"
    cp -p "$KEA_CONF" "$CONF_BACKUP"
    log_info "Existing ${KEA_CONF} kept. Backup: ${CONF_BACKUP}"

    # Patch in only what the UI needs (control socket + lease_cmds hook).
    # Comments are stripped if a patch is required; the backup retains them.
    if PATCH_OUT="$(KEA_CONF="$KEA_CONF" HOOK_PATH="$HOOK_PATH" SOCKET="$SOCKET" node - <<'JS'
const fs = require('fs');
const file = process.env.KEA_CONF;
const hook = process.env.HOOK_PATH || '';

function stripComments(s) {
  let out = '', i = 0, inStr = false;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') { out += n; i += 2; continue; }
      if (c === '"') inStr = false;
      i++; continue;
    }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if ((c === '/' && n === '/') || c === '#') {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++;
      i += 2; continue;
    }
    out += c; i++;
  }
  return out;
}

const obj = JSON.parse(stripComments(fs.readFileSync(file, 'utf8')));
const d = obj.Dhcp4;
if (!d) { console.error('No Dhcp4 section found'); process.exit(3); }

let changed = false;
if (!d['control-socket']) {
  d['control-socket'] = { 'socket-type': 'unix', 'socket-name': process.env.SOCKET };
  changed = true;
}
if (hook) {
  const libs = Array.isArray(d['hooks-libraries']) ? d['hooks-libraries'] : [];
  if (!libs.some(h => /lease_cmds/.test(h.library || ''))) {
    libs.push({ library: hook });
    d['hooks-libraries'] = libs;
    changed = true;
  }
}
if (changed) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  console.error('PATCHED');
}
console.log(d['control-socket']['socket-name'] || process.env.SOCKET);
JS
    )"; then
        SOCKET="$PATCH_OUT"
        # Re-detect whether the file was modified compared to the backup
        if ! cmp -s "$CONF_BACKUP" "$KEA_CONF"; then
            DHCP_CHANGED=true
            log_info "Patched ${KEA_CONF} with missing control-socket / lease_cmds hook."
        fi
    else
        log_warn "Could not parse ${KEA_CONF} as JSON; left unchanged."
        log_warn "Ensure it defines a unix control-socket and (optionally) the lease_cmds hook."
    fi
else
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
      "socket-name": "${SOCKET}"
    },
    "lease-database": {
      "type": "memfile",
      "persist": true,
      "name": "/var/lib/kea/kea-leases4.csv"
    },
    "valid-lifetime": 4000,
    "renew-timer": 1000,
    "rebind-timer": 2000,
    ${HOOK_BLOCK}
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
    DHCP_CHANGED=true
    log_info "Created ${KEA_CONF} from template (no previous configuration found)."
fi

# --- kea-ctrl-agent.conf: back up, then write (socket follows dhcp4 config) ---
if [[ -f "$AGENT_CONF" ]]; then
    AGENT_BACKUP="${AGENT_CONF}.bak.${STAMP}"
    cp -p "$AGENT_CONF" "$AGENT_BACKUP"
    log_info "Backed up existing ${AGENT_CONF} to: ${AGENT_BACKUP}"
fi

cat << EOF > "$AGENT_CONF"
{
  "Control-agent": {
    "http-host": "0.0.0.0",
    "http-port": 8000,
    "control-sockets": {
      "dhcp4": {
        "socket-type": "unix",
        "socket-name": "${SOCKET}"
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

# Ensure permissions
chown root:"$SYSTEM_USER" "$KEA_CONF" "$AGENT_CONF"
chmod 664 "$KEA_CONF" "$AGENT_CONF"
chown -R "$SYSTEM_USER":"$SYSTEM_USER" /etc/kea/backups
chmod 775 /etc/kea/backups

# Validate configuration before touching running services
log_info "Validating Kea configuration..."
if ! VALIDATION="$("$KEA_BIN" -t "$KEA_CONF" 2>&1)"; then
    log_error "Kea configuration check failed:"
    echo "$VALIDATION" >&2
    rollback_configs
    exit 1
fi

# Enable and (re)start Kea services; only restart DHCP if its config changed
systemctl enable "${KEA_DHCP4_SERVICE}" "${KEA_AGENT_SERVICE}" || true

wait_active() {
    local svc="$1" i
    for i in $(seq 1 15); do
        if systemctl is-active --quiet "$svc"; then return 0; fi
        sleep 1
    done
    return 1
}

if [[ "$DHCP_CHANGED" == "true" ]]; then
    systemctl restart "${KEA_DHCP4_SERVICE}" || true
else
    systemctl start "${KEA_DHCP4_SERVICE}" || true
fi
systemctl restart "${KEA_AGENT_SERVICE}" || true

if ! wait_active "${KEA_DHCP4_SERVICE}" || ! wait_active "${KEA_AGENT_SERVICE}"; then
    log_error "Kea services did not become active after configuration."
    journalctl -u "${KEA_DHCP4_SERVICE}" -u "${KEA_AGENT_SERVICE}" -n 20 --no-pager >&2 || true
    rollback_configs
    systemctl restart "${KEA_DHCP4_SERVICE}" "${KEA_AGENT_SERVICE}" || true
    exit 1
fi

log_success "Kea DHCP Server and Control Agent services are active."

# 9. Install Dependencies & Build Production Bundle
log_info "Installing project dependencies and building React frontend via pnpm..."

cd "$INSTALL_DIR"
find client/src -name '*.jsx' -delete 2>/dev/null || true
find client/src -name '*.js' -delete 2>/dev/null || true
rm -rf client/dist client/node_modules/.vite
pnpm install --frozen-lockfile
pnpm run build

# Code stays root-owned (the service must not be able to modify itself).
# Only the data directory is writable by the service account.
DATA_DIR="${INSTALL_DIR}/server/data"
mkdir -p "$DATA_DIR"
chown -R root:root "$INSTALL_DIR"
chown -R "$SYSTEM_USER":"$SYSTEM_USER" "$DATA_DIR"
chmod 700 "$DATA_DIR"

if ! runuser -u "$SYSTEM_USER" -- test -r "${INSTALL_DIR}/server/index.js"; then
    log_error "User '${SYSTEM_USER}' cannot read ${INSTALL_DIR}."
    log_error "Move the project to a world-traversable path (e.g. /opt/kea-dhcp-ui) and re-run."
    exit 1
fi

log_success "Project build completed successfully."

# 10. Secrets (/etc/kea-dhcp-ui/env) and initial admin account
ENV_DIR="/etc/kea-dhcp-ui"
ENV_FILE="${ENV_DIR}/env"
mkdir -p "$ENV_DIR"
chmod 700 "$ENV_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
    install -m 0600 -o root -g root /dev/null "$ENV_FILE"
fi
if ! grep -q '^JWT_SECRET=' "$ENV_FILE"; then
    echo "JWT_SECRET=$(openssl rand -hex 32)" >> "$ENV_FILE"
    log_info "Generated new JWT_SECRET in ${ENV_FILE}."
fi
if ! grep -q '^PORT=' "$ENV_FILE"; then
    echo "PORT=3000" >> "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"
UI_PORT="$(sed -n 's/^PORT=//p' "$ENV_FILE" | tail -n 1)"
UI_PORT="${UI_PORT:-3000}"

ADMIN_PASSWORD_MSG="(unchanged - existing account preserved)"
USERS_FILE="${DATA_DIR}/users.json"
if [[ ! -f "$USERS_FILE" ]]; then
    ADMIN_PW="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
    ADMIN_PASSWORD="$ADMIN_PW" NODE_ENV=production \
        runuser -u "$SYSTEM_USER" -- node -e "
const fs = require('fs');
const path = require('path');
const p = [
  path.join('${INSTALL_DIR}', 'server', 'dist', 'server', 'src', 'services', 'authService.js'),
  path.join('${INSTALL_DIR}', 'server', 'dist', 'services', 'authService.js'),
  path.join('${INSTALL_DIR}', 'server', 'services', 'authService.js')
].find(x => fs.existsSync(x));
if (p) require(p);
" >/dev/null
    ADMIN_PASSWORD_MSG="${ADMIN_PW}   <-- shown once, store it now"
    unset ADMIN_PW
else
    if USERS_FILE="$USERS_FILE" node -e "
let b;
try { b = require('${INSTALL_DIR}/server/node_modules/bcryptjs'); }
catch (e) { b = require('${INSTALL_DIR}/node_modules/bcryptjs'); }
const u = JSON.parse(require('fs').readFileSync(process.env.USERS_FILE, 'utf8'));
process.exit(u.some(x => b.compareSync('admin123', x.passwordHash)) ? 0 : 1);" 2>/dev/null; then
        log_warn "An account still uses the default password 'admin123'. Change it in the UI immediately."
    fi
fi

# 11. Configure and Start Systemd Service (kea-dhcp-ui.service)
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
Environment=KEA_DHCP4_SERVICE=${KEA_DHCP4_SERVICE}
Environment=KEA_CTRL_AGENT_SERVICE=${KEA_AGENT_SERVICE}
Environment=KEA_CTRL_AGENT_URL=http://127.0.0.1:8000
Environment=KEA_CONF_PATH=${KEA_CONF}
Environment=KEA_HELPER_PATH=${HELPER}
EnvironmentFile=${ENV_FILE}
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

# 12. Verification & Summary Output
UI_OK=false
for _ in $(seq 1 15); do
    if curl -fsS "http://127.0.0.1:${UI_PORT}/api/health" &>/dev/null; then
        UI_OK=true
        break
    fi
    sleep 1
done
if [[ "$UI_OK" != "true" ]]; then
    log_warn "Web UI health check failed. See: journalctl -u kea-dhcp-ui -n 50"
fi

SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
SERVER_IP="${SERVER_IP:-127.0.0.1}"

echo -e "\n${BOLD}${GREEN}==========================================================${NC}"
echo -e "${BOLD}${GREEN}      Kea DHCP Web UI Installation Completed!           ${NC}"
echo -e "${BOLD}${GREEN}==========================================================${NC}"
echo -e "Web Management UI:   ${BOLD}${CYAN}http://${SERVER_IP}:${UI_PORT}${NC} (or http://localhost:${UI_PORT})"
echo -e "Username:            ${BOLD}admin${NC}"
echo -e "Password:            ${BOLD}${ADMIN_PASSWORD_MSG}${NC}"
echo -e "Secrets File:        ${BOLD}${ENV_FILE}${NC}"
echo -e "System Service:      ${BOLD}systemctl status kea-dhcp-ui${NC}"
echo -e "Kea DHCP Daemon:     ${BOLD}systemctl status ${KEA_DHCP4_SERVICE}${NC}"
echo -e "Control Agent:       ${BOLD}systemctl status ${KEA_AGENT_SERVICE}${NC}"
echo -e "Kea Config:          ${BOLD}${KEA_CONF}${NC}"
echo -e "${GREEN}==========================================================${NC}\n"
