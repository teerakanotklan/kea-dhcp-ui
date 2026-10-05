import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

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

import { DATA_DIR } from './paths';

// User data directory for local operational state
const dataDir = DATA_DIR;
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

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Config] JWT_SECRET is not set; using a random per-process secret (sessions reset on restart).');
    jwtSecret = crypto.randomBytes(32).toString('hex');
  } else {
    jwtSecret = 'kea-dhcp-super-secret-key-2026'; // development only
  }
}

// Root-owned helper invoked through sudo for validation and log reads
const helperPath = process.env.KEA_HELPER_PATH || '/usr/local/sbin/kea-dhcp-ui-helper';

export interface AppConfig {
  port: number;
  jwtSecret: string;
  helperPath: string;
  jwtExpiresIn: string;
  keaCtrlAgentUrl: string;
  confPath: string;
  ctrlAgentConfPath: string;
  backupDir: string;
  dhcpService: string;
  ctrlAgentService: string;
  isDebianBased: boolean;
  isRhelBased: boolean;
}

const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret,
  helperPath,
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

export default config;
