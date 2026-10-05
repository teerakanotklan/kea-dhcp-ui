# Project Guidelines & Rules

## Mandatory Deployment & Remote Verification Rule

> [!IMPORTANT]
> **ทุกๆ การแก้ไขโค้ด (ทั้งฝั่ง Client หรือ Server)** จะต้องทำการทดสอบและ Deploy ไปยังเครื่องเซิร์ฟเวอร์ทดสอบ **192.168.153.8** ทุกครั้งก่อนสรุปงาน

### ขั้นตอนการรัน Deploy และ Verification:
ทุกครั้งที่มีการแก้ไขโค้ด ให้รันคำสั่ง:
```bash
python scripts/deploy.py
```
หรือ
```bash
npm run deploy:remote
```

### สิ่งที่สคริปต์ทำโดยอัตโนมัติ:
1. เชื่อมต่อไปยังเซิร์ฟเวอร์ปลายทางผ่าน SSH (ดึงข้อมูล Host, User, Password จากไฟล์ `.env` ที่กำหนดค่าตาม `.env.example`)
2. ซิงค์ไฟล์ซอร์สโค้ดที่มีการแก้ไขไปยัง `/opt/kea-dhcp-ui`
3. สั่ง Build Client (`npm --prefix client run build`) บนเซิร์ฟเวอร์
4. รีสตาร์ท Service (`systemctl restart kea-dhcp-ui.service`)
5. ตรวจสอบสถานะ Service เป็น `active` และยิงเช็ค API Health check (`http://127.0.0.1:3000/api/health`)

เมื่อผลการรันผ่านครบทุกขั้นตอน จึงจะถือว่าการแก้ไขงานเสร็จสมบูรณ์
