const path = require('path');
const fs = require('fs');

const isLinux = process.platform === 'linux';

// Auto-detect Linux Distribution Family
let isRhelBased = false;
let isDebianBased = true;

if (fs.existsSync('/etc/os-release')) {
  try {
    const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
    if (/ID_LIKE=.*(?:rhel|fedora|centos)/i.test(osRelease) || /ID=.*(?:rhel|rocky|almalinux|centos|fedora)/i.test(osRelease)) {
      isRhelBased = true;
      isDebianBased = false;
    }
  } catch (e) {
    // Default to Debian/Ubuntu family
  }
}

// Kea Service Names
// On Debian/Ubuntu: 'kea-dhcp4-server' and 'kea-ctrl-agent'
// On RHEL/Fedora: 'kea-dhcp4' and 'kea-ctrl-agent'
const dhcpService = process.env.KEA_DHCP4_SERVICE || (isRhelBased ? 'kea-dhcp4' : 'kea-dhcp4-server');
const ctrlAgentService = process.env.KEA_CTRL_AGENT_SERVICE || 'kea-ctrl-agent';

// User data directory for local operational state
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Kea Control Agent REST API URL
const keaCtrlAgentUrl = process.env.KEA_CTRL_AGENT_URL || 'http://127.0.0.1:8000';

// Configuration paths
let confPath = process.env.KEA_CONF_PATH || '/etc/kea/kea-dhcp4.conf';
let ctrlAgentConfPath = process.env.KEA_CTRL_AGENT_CONF_PATH || '/etc/kea/kea-ctrl-agent.conf';
let backupDir = process.env.KEA_BACKUP_DIR || '/etc/kea/backups';

// Non-Linux development fallback if system paths are unavailable
if (!isLinux) {
  if (!fs.existsSync(confPath) && fs.existsSync(path.join(dataDir, 'kea-dhcp4.conf'))) {
    confPath = path.join(dataDir, 'kea-dhcp4.conf');
  }
  if (!fs.existsSync(backupDir)) {
    backupDir = path.join(dataDir, 'backups');
  }
}

// Ensure backup directory exists if permissions permit
if (!fs.existsSync(backupDir)) {
  try {
    fs.mkdirSync(backupDir, { recursive: true });
  } catch (e) {
    // Handled gracefully if permission denied
  }
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'kea-dhcp-super-secret-key-2026',
  jwtExpiresIn: '24h',
  keaCtrlAgentUrl,
  confPath,
  ctrlAgentConfPath,
  backupDir,
  dhcpService,
  ctrlAgentService,
  isDebianBased,
  isRhelBased,
};
