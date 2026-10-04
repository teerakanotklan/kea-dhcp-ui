# Kea DHCP Server Web Management UI

ระบบบริหารจัดการ **Kea DHCP Server** ผ่าน Web Application สไตล์ Modern Glassmorphism พัฒนาด้วย **Node.js (Express API) + React (Vite)** พร้อมสถาปัตยกรรม Single-Port ให้บริการไฟล์ Production Bundle ได้ทันที

รองรับการสื่อสารและควบคุม Kea DHCPv4 แบบ Real-time ผ่าน **Kea Control Agent (REST API Port 8000)** และคำสั่งมาตรฐาน `systemctl` / `journalctl`

---

## 🌟 จุดเด่นและฟังก์ชันการทำงาน

- 📊 **Dashboard ภาพรวม Real-time (Dual-Service Monitoring)**:
  - แสดงสถานะการทำงานจริงของทั้ง **`kea-dhcp4-server`** (DHCPv4 Engine) และ **`kea-ctrl-agent`** (REST Control Agent)
  - สรุปจำนวน Scopes, Static Reservations, Active Leases และ Pool Capacity
  - กราฟและแถบแสดงอัตราการใช้งาน Address Pool (%) ในแต่ละ Subnet
  - ควบคุมและรีสตาร์ต Service แยกตัวได้อย่างอิสระ
- 🔐 **Authentication & Security (Admin Role)**:
  - ระบบตรวจสอบสิทธิ์ด้วย JWT Token (HMAC-SHA256)
  - บัญชีเริ่มต้น: `admin` / รหัสผ่าน: `admin123`
- 🌐 **Scope & Subnet Management**:
  - จัดการ Kea Subnet CIDR (เช่น `192.168.100.0/24`), Dynamic Pool Range (`192.168.100.10 - 192.168.100.200`)
  - กำหนด Gateway (`routers`), DNS Servers (`domain-name-servers`), Domain Name, และ Custom Kea Option-Data
- 📌 **Integrated Static Host Reservations**:
  - จัดการผูก MAC Address กับ IP Address ถาวร (`reservations`) เข้าไปในแต่ละ Scope โดยตรงตามโครงสร้าง Native ของ Kea
  - ป้องกันการจอง IP หรือ MAC ชนกันใน Subnet เดียวกัน
- 📡 **Lease Management ผ่าน REST API**:
  - ดึงข้อมูล Active Leases สดผ่าน Kea Control Agent (`lease4-get-all`) ร่วมกับ Hook `libdhcp_lease_cmds.so`
  - ค้นหาและกรองสถานะ พร้อมฟังก์ชัน Release Lease (`lease4-del`)
  - ส่งออกข้อมูลเป็นไฟล์ CSV
- 📝 **Configuration & Safety**:
  - ใช้งาน Kea Control Agent เป็น Source of Truth ในการส่งคำสั่ง runtime (`config-set`) และบันทึกลงไฟล์ (`config-write`)
  - ระบบ Auto-Backup สำรองไฟล์ `/etc/kea/kea-dhcp4.conf` อัตโนมัติทุกครั้งก่อนบันทึก
- 📜 **Service Logs**:
  - ดึงข้อมูลบันทึกสดผ่าน `journalctl` โดยสามารถเลือกดูเฉพาะ Kea DHCPv4, Kea Control Agent หรือ All Services พร้อมระบบ Auto-poll

---

## 🐧 การติดตั้งอัตโนมัติบน Linux Server (Automated Installer)

โปรเจกต์มีสคริปต์ `install.sh` สำหรับติดตั้งแบบอัตโนมัติครบวงจร โดยจะตรวจสอบ OS, ติดตั้งแพ็กเกจ Kea DHCP Stack, สร้าง Dedicated User (`dhcpui`), กำหนดสิทธิ์ Sudoers, Build Frontend และเปิดใช้งาน Systemd Service ให้อัตโนมัติ

### ระบบปฏิบัติการที่รองรับ:
- **Debian Family**: Debian 11 / 12, Ubuntu 22.04 / 24.04 LTS (แพ็กเกจ `kea-dhcp4-server` และ `kea-ctrl-agent`)
- **Enterprise Linux (RHEL Family)**: Rocky Linux 8 / 9, AlmaLinux 8 / 9, RHEL 8 / 9, CentOS Stream, Fedora (แพ็กเกจ `kea`)

### ขั้นตอนการติดตั้ง:

```bash
# 1. Clone โปรเจกต์ไปยังเซิร์ฟเวอร์
git clone <repository-url> /opt/kea-dhcp-ui
cd /opt/kea-dhcp-ui

# 2. รันสคริปต์ติดตั้งด้วยสิทธิ์ root
sudo bash install.sh
```

### สคริปต์ `install.sh` จะดำเนินการสิ่งต่อไปนี้ให้อัตโนมัติ:
1. ตรวจจับ Linux Distribution และเลือกใช้ Package Manager (`apt` หรือ `dnf`/`yum`)
2. ติดตั้งแพ็กเกจ Kea DHCP: `kea-dhcp4-server`, `kea-ctrl-agent`, `curl`, `git`
3. ติดตั้ง Node.js 20 LTS จาก NodeSource หากระบบยังไม่มี
4. สร้าง System User เฉพาะ `dhcpui` เพื่อความปลอดภัย
5. ตั้งค่าสิทธิ์ `/etc/sudoers.d/kea-dhcp-ui` เพื่อให้ `dhcpui` สั่งการเฉพาะคำสั่ง lifecycle ของ Kea services
6. ค้นหาและเปิดใช้งาน Hook Library `libdhcp_lease_cmds.so` อัตโนมัติ
7. สร้างไฟล์คอนฟิกเริ่มต้น `/etc/kea/kea-dhcp4.conf` และ `/etc/kea/kea-ctrl-agent.conf` (เชื่อมต่อผ่าน Unix Socket `/run/kea/kea4-ctrl-socket`)
8. ติดตั้ง Node dependencies และคอมไพล์ Frontend Production Bundle (`npm run build`)
9. สร้างและเปิดใช้งาน Systemd Unit: `kea-dhcp-ui.service` ที่พอร์ต `3000`

---

## 🌐 การเข้าใช้งานระบบ

เมื่อติดตั้งสำเร็จ สามารถเปิดเว็บบราวเซอร์และเข้าไปที่:
- **URL**: `http://<IP-ของเซิร์ฟเวอร์>:3000` (หรือ `http://localhost:3000`)
- **Username**: `admin`
- **Password**: `admin123`

---

## 🔧 คำสั่งจัดการ Service บน Linux

```bash
# ตรวจสอบสถานะ Web UI
sudo systemctl status kea-dhcp-ui

# ตรวจสอบสถานะ Kea DHCP Server
sudo systemctl status kea-dhcp4-server

# ตรวจสอบสถานะ Kea Control Agent (REST API)
sudo systemctl status kea-ctrl-agent

# ตรวจสอบ Logs
sudo journalctl -u kea-dhcp-ui -f
sudo journalctl -u kea-dhcp4-server -u kea-ctrl-agent -f
```
