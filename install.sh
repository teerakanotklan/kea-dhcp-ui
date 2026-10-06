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
#   - Existing configurations and secrets are safely backed up and preserved.
#   - Verbose background tasks are hidden and logged to /var/log/kea-dhcp-ui-install.log.
#   - Supports direct execution via GitHub URL pipe:
#       curl -fsSL https://raw.githubusercontent.com/teerakanotklan/kea-dhcp-ui/main/install.sh | sudo bash
# ==============================================================================

set -euo pipefail

# Text Styling
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

LOG_FILE="/var/log/kea-dhcp-ui-install.log"
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"

echo -e "\n${BOLD}${CYAN}==========================================================${NC}"
echo -e "${BOLD}${CYAN}       Kea DHCP Web UI - Automated Linux Installer        ${NC}"
echo -e "${BOLD}${CYAN}==========================================================${NC}"
echo -e "Installer Log: ${BOLD}${CYAN}${LOG_FILE}${NC}\n"

# Helper for executing tasks silently in background with modern CLI spinner
run_step() {
    local title="$1"
    shift
    local cmd="$*"

    echo "--- [$(date '+%Y-%m-%d %H:%M:%S')] START: ${title} ---" >> "$LOG_FILE"

    if [[ -t 1 ]]; then
        bash -c "$cmd" >> "$LOG_FILE" 2>&1 &
        local pid=$!
        local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
        local i=0
        while kill -0 "$pid" 2>/dev/null; do
            local c="${spin:i++%${#spin}:1}"
            printf "\r  \033[0;36m%s\033[0m %s...   " "$c" "$title"
            sleep 0.1
        done
        wait "$pid"
        local status=$?
    else
        echo "  [RUNNING] ${title}..."
        bash -c "$cmd" >> "$LOG_FILE" 2>&1
        local status=$?
    fi

    echo "--- [$(date '+%Y-%m-%d %H:%M:%S')] END: ${title} (exit: ${status}) ---" >> "$LOG_FILE"

    if [[ $status -eq 0 ]]; then
        printf "\r  \033[0;32m✔\033[0m %s                                                 \n" "$title"
    else
        printf "\r  \033[0;31m✖\033[0m %s (FAILED)                                        \n" "$title"
        echo -e "\n${RED}[ERROR] Step failed:${NC} ${title}" >&2
        echo -e "${YELLOW}--- Last 30 lines of ${LOG_FILE} ---${NC}" >&2
        tail -n 30 "$LOG_FILE" >&2
        echo -e "${YELLOW}------------------------------------------------------------${NC}\n" >&2
        exit 1
    fi
}

# 1. Verify Root Privileges
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[ERROR] This installer must be run as root.${NC}" >&2
    echo "Please run: sudo bash $0 or curl -fsSL ... | sudo bash" >&2
    exit 1
fi

# 2. Identify Linux Distribution
if [[ ! -f /etc/os-release ]]; then
    echo -e "${RED}[ERROR] Cannot identify Linux distribution (/etc/os-release not found).${NC}" >&2
    exit 1
fi

. /etc/os-release
OS_ID="${ID:-unknown}"
OS_LIKE="${ID_LIKE:-}"
OS_NAME="${PRETTY_NAME:-$OS_ID}"

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
    echo -e "${RED}[ERROR] Unsupported Linux distribution family: ${OS_ID}${NC}" >&2
    exit 1
fi

echo -e "Target System: ${BOLD}${OS_NAME}${NC} (Package Manager: ${BOLD}${PKG_MANAGER}${NC})\n"

# Step 1: Install System Base & Kea DHCP Packages
run_step "[1/8] Updating package repository and installing Kea DHCP" '
    if [[ "'"$PKG_MANAGER"'" == "apt" ]]; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -y -q
        apt-get install -y -q curl git ca-certificates sudo coreutils openssl \
            kea-dhcp4-server kea-ctrl-agent
    else
        '"$PKG_MANAGER"' makecache -y
        if [[ "'"$OS_ID"'" != "fedora" ]]; then
            '"$PKG_MANAGER"' install -y epel-release || true
        fi
        '"$PKG_MANAGER"' install -y curl git ca-certificates sudo coreutils openssl kea
        '"$PKG_MANAGER"' install -y kea-hooks || true
    fi
'

# Step 2: Check & Install Node.js (20 LTS) & pnpm
run_step "[2/8] Setting up Node.js 20 LTS runtime & pnpm" '
    NEED_NODE=true
    if command -v node &>/dev/null; then
        V=$(node -v | sed "s/v//" | cut -d"." -f1)
        if [[ "$V" -ge 18 ]]; then
            NEED_NODE=false
        fi
    fi

    if [[ "$NEED_NODE" == "true" ]]; then
        NODESOURCE_TMP="$(mktemp)"
        if [[ "'"$PKG_MANAGER"'" == "apt" ]]; then
            export DEBIAN_FRONTEND=noninteractive
            curl -fsSL -o "$NODESOURCE_TMP" https://deb.nodesource.com/setup_20.x
            bash "$NODESOURCE_TMP"
            apt-get install -y -q nodejs
        else
            curl -fsSL -o "$NODESOURCE_TMP" https://rpm.nodesource.com/setup_20.x
            bash "$NODESOURCE_TMP"
            '"$PKG_MANAGER"' install -y nodejs
        fi
        rm -f "$NODESOURCE_TMP"
    fi

    if ! command -v pnpm &>/dev/null; then
        npm install -g pnpm@10.33.0 || npm install -g pnpm
    fi
'

# Step 3: Determine and prepare INSTALL_DIR (supports curl | bash from GitHub)
SCRIPT_SOURCE="${BASH_SOURCE[0]:-}"
INSTALL_DIR=""

if [[ -n "$SCRIPT_SOURCE" && "$SCRIPT_SOURCE" != "/dev/fd/"* && -f "$SCRIPT_SOURCE" ]]; then
    POTENTIAL_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
    if [[ -f "${POTENTIAL_DIR}/package.json" && -f "${POTENTIAL_DIR}/server/index.js" ]]; then
        INSTALL_DIR="$POTENTIAL_DIR"
    fi
fi

if [[ -z "$INSTALL_DIR" ]]; then
    if [[ -f "$(pwd)/package.json" && -f "$(pwd)/server/index.js" ]]; then
        INSTALL_DIR="$(pwd)"
    else
        INSTALL_DIR="/opt/kea-dhcp-ui"
    fi
fi

run_step "[3/8] Preparing Kea DHCP UI repository at ${INSTALL_DIR}" '
    REPO_URL="https://github.com/teerakanotklan/kea-dhcp-ui.git"
    if [[ ! -d "'"$INSTALL_DIR"'/.git" ]]; then
        mkdir -p "'"$INSTALL_DIR"'"
        if [[ -d "'"$INSTALL_DIR"'" && -z "$(ls -A "'"$INSTALL_DIR"'" 2>/dev/null)" ]]; then
            git clone "$REPO_URL" "'"$INSTALL_DIR"'"
        else
            TMP_CLONE="$(mktemp -d)"
            git clone "$REPO_URL" "$TMP_CLONE"
            cp -r "$TMP_CLONE"/.* "$TMP_CLONE"/* "'"$INSTALL_DIR"'" 2>/dev/null || true
            rm -rf "$TMP_CLONE"
        fi
    else
        git -C "'"$INSTALL_DIR"'" fetch origin main
        git -C "'"$INSTALL_DIR"'" checkout main
        git -C "'"$INSTALL_DIR"'" reset --hard origin/main
    fi
'

cd "$INSTALL_DIR"

# Locate required binaries
KEA_BIN="$(command -v kea-dhcp4 || true)"
[[ -z "$KEA_BIN" && -x /usr/sbin/kea-dhcp4 ]] && KEA_BIN=/usr/sbin/kea-dhcp4
SYSTEMCTL_BIN="$(command -v systemctl)"
JOURNALCTL_BIN="$(command -v journalctl)"

if [[ -z "$KEA_BIN" ]]; then
    echo -e "${RED}[ERROR] kea-dhcp4 binary not found after installation.${NC}" >&2
    exit 1
fi

# Step 4: Configure Dedicated System User 'dhcpui' & Privileged Helper
SYSTEM_USER="dhcpui"
HELPER="/usr/local/sbin/kea-dhcp-ui-helper"
SUDOERS_FILE="/etc/sudoers.d/kea-dhcp-ui"

run_step "[4/8] Configuring system security, user '${SYSTEM_USER}' & sudoers" '
    if ! id -u "'"$SYSTEM_USER"'" &>/dev/null; then
        useradd -r -s /usr/sbin/nologin -c "Kea DHCP Web UI Service Account" "'"$SYSTEM_USER"'" || \
        useradd -r -s /sbin/nologin -c "Kea DHCP Web UI Service Account" "'"$SYSTEM_USER"'"
    fi

    cat << '\''EOF'\'' | sed \
        -e "s|@KEA_BIN@|'"${KEA_BIN}"'|g" \
        -e "s|@JOURNALCTL@|'"${JOURNALCTL_BIN}"'|g" \
        -e "s|@DHCP_SVC@|'"${KEA_DHCP4_SERVICE}"'|g" \
        -e "s|@AGENT_SVC@|'"${KEA_AGENT_SERVICE}"'|g" > "'"$HELPER"'"
#!/usr/bin/env bash
# Managed by kea-dhcp-ui install.sh - do not edit.
set -euo pipefail

KEA_BIN='\''@KEA_BIN@'\''
JOURNALCTL='\''@JOURNALCTL@'\''
DHCP_SVC='\''@DHCP_SVC@'\''
AGENT_SVC='\''@AGENT_SVC@'\''

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
    chown root:root "'"$HELPER"'"
    chmod 0755 "'"$HELPER"'"

    SUDOERS_TMP="$(mktemp)"
    SYSTEMCTL_PATHS=("'"$SYSTEMCTL_BIN"'")
    SYSTEMCTL_REAL="$(readlink -f "'"$SYSTEMCTL_BIN"'")"
    [[ "$SYSTEMCTL_REAL" != "'"$SYSTEMCTL_BIN"'" ]] && SYSTEMCTL_PATHS+=("$SYSTEMCTL_REAL")

    {
        echo "# Sudo privileges for Kea DHCP Web UI ('"$SYSTEM_USER"') - managed by install.sh"
        echo "Defaults:'"$SYSTEM_USER"' !requiretty"
        for ctl in "${SYSTEMCTL_PATHS[@]}"; do
            for svc in "'"$KEA_DHCP4_SERVICE"'" "'"$KEA_AGENT_SERVICE"'"; do
                for action in start stop restart reload status; do
                    echo "'"$SYSTEM_USER"' ALL=(root) NOPASSWD: ${ctl} ${action} ${svc}"
                done
            done
        done
        echo "'"$SYSTEM_USER"' ALL=(root) NOPASSWD: '"$HELPER"' validate *, '"$HELPER"' logs *"
    } > "$SUDOERS_TMP"

    if visudo -cf "$SUDOERS_TMP" &>/dev/null; then
        install -m 0440 -o root -g root "$SUDOERS_TMP" "'"$SUDOERS_FILE"'"
        rm -f "$SUDOERS_TMP"
    else
        rm -f "$SUDOERS_TMP"
        exit 1
    fi

    # Override for kea-ctrl-agent
    mkdir -p "/etc/systemd/system/'"${KEA_AGENT_SERVICE}"'.service.d"
    cat << '\''EOF'\'' > "/etc/systemd/system/'"${KEA_AGENT_SERVICE}"'.service.d/override.conf"
[Unit]
ConditionFileNotEmpty=
EOF
    systemctl daemon-reload
'

# Step 5: Kea DHCP Configuration & Hook Libraries Detection
HOOK_PATH="$(find /usr/lib /usr/lib64 /usr/local/lib -name 'libdhcp_lease_cmds.so' 2>/dev/null | head -n 1 || true)"
HA_HOOK_PATH="$(find /usr/lib /usr/lib64 /usr/local/lib -name 'libdhcp_ha.so' 2>/dev/null | head -n 1 || true)"
KEA_CONF="/etc/kea/kea-dhcp4.conf"
AGENT_CONF="/etc/kea/kea-ctrl-agent.conf"
SOCKET="/run/kea/kea4-ctrl-socket"
STAMP="$(date +%Y%m%d%H%M%S)"

run_step "[5/8] Configuring Kea DHCP & Control Agent sockets" '
    mkdir -p /etc/kea/backups /var/lib/kea /run/kea

    if [[ -f "'"$KEA_CONF"'" ]]; then
        cp -p "'"$KEA_CONF"'" "'"${KEA_CONF}.bak.${STAMP}"'"
        KEA_CONF="'"$KEA_CONF"'" HOOK_PATH="'"$HOOK_PATH"'" SOCKET="'"$SOCKET"'" node - << '\''JS'\''
const fs = require("fs");
const file = process.env.KEA_CONF;
const hook = process.env.HOOK_PATH || "";

function stripComments(s) {
  let out = "", i = 0, inStr = false;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") { out += n; i += 2; continue; }
      if (c === "\"") inStr = false;
      i++; continue;
    }
    if (c === "\"") { inStr = true; out += c; i++; continue; }
    if ((c === "/" && n === "/") || c === "#") {
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i += 2; continue;
    }
    out += c; i++;
  }
  return out;
}

try {
  const obj = JSON.parse(stripComments(fs.readFileSync(file, "utf8")));
  const d = obj.Dhcp4;
  if (d) {
    let changed = false;
    if (!d["control-socket"]) {
      d["control-socket"] = { "socket-type": "unix", "socket-name": process.env.SOCKET };
      changed = true;
    }
    if (hook) {
      const libs = Array.isArray(d["hooks-libraries"]) ? d["hooks-libraries"] : [];
      if (!libs.some(h => /lease_cmds/.test(h.library || ""))) {
        libs.push({ library: hook });
        d["hooks-libraries"] = libs;
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
    }
  }
} catch (e) {
  console.error("Config parse error:", e);
}
JS
    else
        HOOK_BLOCK=""
        if [[ -n "'"$HOOK_PATH"'" ]]; then
            HOOK_BLOCK="\"hooks-libraries\": [ { \"library\": \"'"$HOOK_PATH"'\" } ],"
        fi

        cat << EOF > "'"$KEA_CONF"'"
{
  "Dhcp4": {
    "interfaces-config": {
      "interfaces": [ "*" ]
    },
    "control-socket": {
      "socket-type": "unix",
      "socket-name": "'"$SOCKET"'"
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
    fi

    if [[ -f "'"$AGENT_CONF"'" ]]; then
        cp -p "'"$AGENT_CONF"'" "'"${AGENT_CONF}.bak.${STAMP}"'"
    fi

    cat << EOF > "'"$AGENT_CONF"'"
{
  "Control-agent": {
    "http-host": "0.0.0.0",
    "http-port": 8000,
    "control-sockets": {
      "dhcp4": {
        "socket-type": "unix",
        "socket-name": "'"$SOCKET"'"
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

    chown root:"'"$SYSTEM_USER"'" "'"$KEA_CONF"'" "'"$AGENT_CONF"'"
    chmod 664 "'"$KEA_CONF"'" "'"$AGENT_CONF"'"
    chown -R "'"$SYSTEM_USER"'" /etc/kea/backups
    chmod 775 /etc/kea/backups

    '"$KEA_BIN"' -t "'"$KEA_CONF"'"
    systemctl enable "'"$KEA_DHCP4_SERVICE"'" "'"$KEA_AGENT_SERVICE"'" || true
    systemctl restart "'"$KEA_DHCP4_SERVICE"'" "'"$KEA_AGENT_SERVICE"'" || true
'

# Step 6: Install Project Dependencies and Build
run_step "[6/8] Installing project dependencies & building production bundle via pnpm" '
    cd "'"$INSTALL_DIR"'"
    rm -rf client/dist server/dist client/node_modules/.vite
    pnpm install
    pnpm run build
'

# Step 7: Secrets and Initial Admin Account
ENV_DIR="/etc/kea-dhcp-ui"
ENV_FILE="${ENV_DIR}/env"
DATA_DIR="${INSTALL_DIR}/server/data"
USERS_FILE="${DATA_DIR}/users.json"
ADMIN_PASSWORD_MSG="(unchanged - existing account preserved)"

run_step "[7/8] Initializing environment secrets and user store" '
    mkdir -p "'"$ENV_DIR"'"
    chmod 700 "'"$ENV_DIR"'"
    touch "'"$ENV_FILE"'"
    chmod 600 "'"$ENV_FILE"'"

    if ! grep -q "^JWT_SECRET=" "'"$ENV_FILE"'"; then
        echo "JWT_SECRET=$(openssl rand -hex 32)" >> "'"$ENV_FILE"'"
    fi
    if ! grep -q "^PORT=" "'"$ENV_FILE"'"; then
        echo "PORT=3000" >> "'"$ENV_FILE"'"
    fi

    mkdir -p "'"$DATA_DIR"'"
    chown -R root:root "'"$INSTALL_DIR"'"
    chown -R "'"$SYSTEM_USER"':'"$SYSTEM_USER"'" "'"$DATA_DIR"'"
    chmod 700 "'"$DATA_DIR"'"
'

# Generate Admin password if users.json does not exist
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
" >/dev/null 2>>"$LOG_FILE" || true
    ADMIN_PASSWORD_MSG="${ADMIN_PW}   (save this password!)"
    unset ADMIN_PW
fi

# Step 8: Configure Systemd Service & Health Verification
SERVICE_FILE="/etc/systemd/system/kea-dhcp-ui.service"
NODE_BIN="$(command -v node)"

run_step "[8/8] Configuring systemd service & performing health check" '
    cat << EOF > "'"$SERVICE_FILE"'"
[Unit]
Description=Kea DHCP Server Web Management UI
After=network.target network-online.target '"${KEA_DHCP4_SERVICE}"'.service '"${KEA_AGENT_SERVICE}"'.service
Wants=network-online.target

[Service]
Type=simple
User='"${SYSTEM_USER}"'
Group='"${SYSTEM_USER}"'
WorkingDirectory='"${INSTALL_DIR}"'
Environment=NODE_ENV=production
Environment=KEA_DHCP4_SERVICE='"${KEA_DHCP4_SERVICE}"'
Environment=KEA_CTRL_AGENT_SERVICE='"${KEA_AGENT_SERVICE}"'
Environment=KEA_CTRL_AGENT_URL=http://127.0.0.1:8000
Environment=KEA_CONF_PATH='"${KEA_CONF}"'
Environment=KEA_HELPER_PATH='"${HELPER}"'
EnvironmentFile='"${ENV_FILE}"'
ExecStart='"${NODE_BIN}"' server/index.js
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

    UI_PORT="$(sed -n "s/^PORT=//p" "'"$ENV_FILE"'" | tail -n 1)"
    UI_PORT="${UI_PORT:-3000}"

    OK=false
    for i in $(seq 1 20); do
        if curl -fsS "http://127.0.0.1:${UI_PORT}/api/health" &>/dev/null; then
            OK=true
            break
        fi
        sleep 1
    done

    if [[ "$OK" != "true" ]]; then
        journalctl -u kea-dhcp-ui -n 30 --no-pager
        exit 1
    fi
'

UI_PORT="$(sed -n 's/^PORT=//p' "$ENV_FILE" | tail -n 1)"
UI_PORT="${UI_PORT:-3000}"
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
SERVER_IP="${SERVER_IP:-127.0.0.1}"

echo -e "\n${BOLD}${GREEN}==========================================================${NC}"
echo -e "${BOLD}${GREEN}     ✔ Kea DHCP Web UI Successfully Installed!           ${NC}"
echo -e "${BOLD}${GREEN}==========================================================${NC}"
echo -e "Web Management UI:   ${BOLD}${CYAN}http://${SERVER_IP}:${UI_PORT}${NC}"
echo -e "Username:            ${BOLD}admin${NC}"
echo -e "Password:            ${BOLD}${ADMIN_PASSWORD_MSG}${NC}"
echo -e "Install Directory:   ${BOLD}${INSTALL_DIR}${NC}"
echo -e "Log File:            ${BOLD}${LOG_FILE}${NC}"
echo -e "Service Status:      ${BOLD}systemctl status kea-dhcp-ui${NC}"
echo -e "Kea Service:         ${BOLD}systemctl status ${KEA_DHCP4_SERVICE}${NC}"
echo -e "Control Agent:       ${BOLD}systemctl status ${KEA_AGENT_SERVICE}${NC}"
echo -e "${GREEN}==========================================================${NC}\n"
