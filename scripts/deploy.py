#!/usr/bin/env python3
"""
Deploy and verify Kea DHCP UI on remote server (192.168.153.8)
Usage: python scripts/deploy.py
"""

import os
import sys
import time
import posixpath
import paramiko

# Load environment variables from .env if present
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
try:
    from dotenv import load_dotenv
    load_dotenv(env_path)
except ImportError:
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip()
                    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                        v = v[1:-1]
                    os.environ.setdefault(k, v)

# Target Configuration
REMOTE_HOST = os.environ.get("REMOTE_HOST", "192.168.153.8")
REMOTE_PORT = int(os.environ.get("REMOTE_PORT", 22))
REMOTE_USER = os.environ.get("REMOTE_USER", "localadm")
REMOTE_PASS = os.environ.get("REMOTE_PASS")
REMOTE_DIR = os.environ.get("REMOTE_DIR", "/opt/kea-dhcp-ui")

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

def get_ssh_client():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    # Try SSH key first, then password
    key_path = os.path.expanduser("~/.ssh/id_ed25519")
    try:
        if os.path.exists(key_path):
            ssh.connect(REMOTE_HOST, port=REMOTE_PORT, username=REMOTE_USER, key_filename=key_path, timeout=5)
            return ssh
    except Exception:
        pass

    ssh.connect(REMOTE_HOST, port=REMOTE_PORT, username=REMOTE_USER, password=REMOTE_PASS, timeout=8)
    return ssh

def setup_ssh_keys_if_needed(ssh):
    key_pub_path = os.path.expanduser("~/.ssh/id_ed25519.pub")
    if not os.path.exists(key_pub_path):
        return
    try:
        with open(key_pub_path, "r", encoding="utf-8") as f:
            pub_key = f.read().strip()
        cmd = (
            f"mkdir -p ~/.ssh && chmod 700 ~/.ssh && "
            f"touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && "
            f"grep -qxF '{pub_key}' ~/.ssh/authorized_keys || echo '{pub_key}' >> ~/.ssh/authorized_keys"
        )
        ssh.exec_command(cmd)
    except Exception as e:
        print(f"[!] Warning: Could not setup SSH keys: {e}")

def sftp_mkdir_p(sftp, remote_dir):
    if not remote_dir or remote_dir == "/":
        return
    parts = [p for p in remote_dir.replace("\\", "/").split("/") if p]
    curr = ""
    for part in parts:
        curr += "/" + part
        try:
            sftp.stat(curr)
        except IOError:
            try:
                sftp.mkdir(curr)
            except IOError:
                pass

def sync_files(sftp, local_root, remote_root):
    # Files and folders to sync
    include_paths = [
        "package.json",
        "package-lock.json",
        "client/package.json",
        "client/package-lock.json",
        "client/vite.config.ts",
        "client/tsconfig.json",
        "client/tailwind.config.js",
        "client/postcss.config.js",
        "client/index.html",
        "client/src",
        "shared",
        "server"
    ]
    
    exclude_subdirs = {"node_modules", "dist", ".git", "__pycache__"}
    exclude_files = {"users.json"} # preserve remote user accounts

    transferred = 0
    for item in include_paths:
        local_path = os.path.join(local_root, item)
        remote_path = posixpath.join(remote_root, item.replace("\\", "/"))

        if os.path.isfile(local_path):
            sftp_mkdir_p(sftp, posixpath.dirname(remote_path))
            sftp.put(local_path, remote_path)
            transferred += 1
        elif os.path.isdir(local_path):
            for root, dirs, files in os.walk(local_path):
                # Filter out excluded directories
                dirs[:] = [d for d in dirs if d not in exclude_subdirs]
                
                rel_dir = os.path.relpath(root, local_root).replace("\\", "/")
                target_dir = posixpath.join(remote_root, rel_dir)
                sftp_mkdir_p(sftp, target_dir)

                for f in files:
                    if f in exclude_files:
                        continue
                    local_f = os.path.join(root, f)
                    remote_f = posixpath.join(target_dir, f)
                    sftp.put(local_f, remote_f)
                    transferred += 1
    return transferred

def run_remote_command(ssh, cmd, sudo=False):
    if sudo:
        cmd = f"echo '{REMOTE_PASS}' | sudo -S bash -c \"{cmd}\""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    return exit_code, out, err

def main():
    if not REMOTE_PASS:
        print("[ERROR] REMOTE_PASS is not set in environment or .env file.")
        print("Please copy .env.example to .env and configure REMOTE_PASS:")
        print("  cp .env.example .env")
        sys.exit(1)

    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"=== Deploying Kea DHCP UI to {REMOTE_USER}@{REMOTE_HOST}:{REMOTE_DIR} ===")
    
    # 1. Connect
    print("[1/5] Connecting via SSH...")
    ssh = get_ssh_client()
    setup_ssh_keys_if_needed(ssh)
    # Ensure remote directory permissions and clean legacy uncompiled JS directories
    run_remote_command(ssh, f"chmod -R 777 {REMOTE_DIR}", sudo=True)
    run_remote_command(ssh, f"rm -rf {REMOTE_DIR}/server/config {REMOTE_DIR}/server/middleware {REMOTE_DIR}/server/routes {REMOTE_DIR}/server/services {REMOTE_DIR}/server/scripts")
    print("  ✓ Connected successfully and cleaned legacy directories")

    # 2. Sync Files
    print("[2/5] Uploading modified project files...")
    sftp = ssh.open_sftp()
    transferred = sync_files(sftp, workspace_root, REMOTE_DIR)
    sftp.close()
    print(f"  ✓ Synchronized {transferred} files")

    # 3. Build & Install Dependencies on Server
    print("[3/5] Updating dependencies and building client & server...")
    build_cmd = f"cd {REMOTE_DIR} && npm install --omit=dev && npm --prefix server install && npm --prefix server run build && npm --prefix client install && npm --prefix client run build"
    code, out, err = run_remote_command(ssh, build_cmd)
    if code != 0:
        print("  ✗ Build failed:")
        print(out)
        print(err)
        ssh.close()
        sys.exit(1)
    print("  ✓ Client & Server build succeeded")

    # 4. Restart Service
    print("[4/5] Restarting kea-dhcp-ui.service...")
    restart_cmd = "systemctl restart kea-dhcp-ui.service"
    code, out, err = run_remote_command(ssh, restart_cmd, sudo=True)
    if code != 0:
        print("  ✗ Failed to restart service:")
        print(err)
        ssh.close()
        sys.exit(1)
    
    # Wait for service startup
    time.sleep(2)
    code, out, err = run_remote_command(ssh, "systemctl is-active kea-dhcp-ui.service")
    status = out.strip()
    if status != "active":
        print(f"  ✗ Service status is '{status}' (expected active)")
        ssh.close()
        sys.exit(1)
    print(f"  ✓ Service status: {status}")

    # 5. Verify Health Endpoint
    print("[5/5] Checking Health API endpoint...")
    code, out, err = run_remote_command(ssh, "curl -fsS http://127.0.0.1:3000/api/health")
    if code != 0:
        print("  ✗ Health check failed")
        print(err)
        ssh.close()
        sys.exit(1)
    print(f"  ✓ Health check response: {out.strip()}")
    
    ssh.close()
    print(f"\n✨ Successfully deployed and verified on http://{REMOTE_HOST}:3000/")

if __name__ == "__main__":
    main()
