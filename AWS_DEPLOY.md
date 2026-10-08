# Lamborghini ERP — AWS'ga deploy qilish (Bulutli texnologiyalar loyihasi)

Arxitektura:

```
Foydalanuvchi → Internet → [Security Group: 80, 22] → EC2 (Ubuntu, nginx → gunicorn → Django + React)
                                                        │
                                                        ├─→ Amazon RDS PostgreSQL   (5432 — faqat EC2'dan)
                                                        ├─→ Amazon S3               (hujjatlar, invoice PDF — IAM role orqali)
                                                        └─→ Amazon CloudWatch       (CPU/RAM/disk metrikalari, loglar, alarm)
```

| Talab (PDF) | AWS xizmati | Loyihada |
|---|---|---|
| 2.1 Compute | **EC2** (t3.micro, Ubuntu 24.04) | nginx + gunicorn + Django, React build |
| 2.2 Database | **RDS PostgreSQL** (db.t4g.micro / db.t3.micro) | `DB_HOST` va boshqalar `.env` da |
| 2.3 Object Storage | **S3** (yopiq bucket, SSE-S3 shifrlash) | "Hujjatlar" sahifasi, buyurtma invoice PDF'lari |
| 2.4 Security | **Security Groups**, **IAM role** | 22 — faqat sizning IP, 80 — hamma; RDS — faqat EC2 SG; access key yo'q |
| 2.4 Monitoring | **CloudWatch** | Agent (RAM, disk, loglar) + CPU alarm, `/api/health/` |

> **Region**: hamma resurslarni bitta regionda yarating. Quyida **eu-central-1 (Frankfurt)** ishlatilgan.
> Boshqa region tanlasangiz, `.env` dagi `AWS_S3_REGION_NAME` ni ham o'zgartiring.

---

## 0. Xarajatdan himoya (eng birinchi!)

1. AWS hisobini oching: https://aws.amazon.com → **Create an AWS Account** (karta talab qilinadi).
2. **Billing and Cost Management → Budgets → Create budget → Zero spend budget** (yoki $5 oylik) — emailingizga ogohlantirish keladi.
3. Faqat **Free tier** belgisi bor resurslarni tanlang: EC2 `t3.micro` (yoki `t2.micro`), RDS `db.t4g.micro`/`db.t3.micro`.
4. **Yaratmang**: NAT Gateway, Load Balancer, RDS Multi-AZ, Elastic IP (ishlatilmayotgan) — bular pullik.
5. Loyiha himoyasidan keyin resurslarni o'chiring (10-bo'lim).

---

## 1. S3 bucket (hujjatlar ombori)

**S3 → Create bucket**
- Bucket name: `lamboerp-docs-<ismingiz>` (dunyo bo'yicha noyob bo'lishi kerak)
- Region: `eu-central-1`
- **Block all public access: ✅ yoqilgan** (bucket ochiq emas — fayllar faqat ilova orqali)
- Bucket Versioning: Disable
- Default encryption: **SSE-S3**
- **Create bucket**

## 2. IAM role (EC2 → S3, CloudWatch)

Ilova S3'ga **access key'siz** ulanadi: EC2'ga IAM role biriktiriladi, boto3 vaqtinchalik ruxsatni avtomatik oladi.

**IAM → Policies → Create policy → JSON**
- `deploy/aws/iam-s3-policy.json` mazmunini qo'ying, `BUCKET_NOMI` ni o'z bucket nomingizga almashtiring.
- Name: `LamboErpS3Documents` → **Create policy**

**IAM → Roles → Create role**
- Trusted entity: **AWS service → EC2**
- Permissions: `LamboErpS3Documents` va `CloudWatchAgentServerPolicy` (AWS managed)
- Role name: `lamboerp-ec2-role` → **Create role**

> Minimal huquqlar tamoyili: role faqat bitta bucket'ning `lamboerp/` papkasiga yozish/o'qish/o'chirish
> va CloudWatch'ga metrika/log yuborish huquqiga ega. Boshqa hech narsa.

## 3. Security Group'lar

**EC2 → Security Groups → Create security group** (2 ta):

**`lamboerp-web-sg`** (EC2 uchun) — Inbound rules:

| Port | Protokol | Manba | Nima uchun |
|---|---|---|---|
| 22 | SSH | **My IP** | Serverni boshqarish (faqat sizning IP'dan) |
| 80 | HTTP | 0.0.0.0/0 | Web-ilova (nginx) |
| 443 | HTTPS | 0.0.0.0/0 | *Ixtiyoriy* — domen va SSL sertifikat bo'lsa |

**`lamboerp-db-sg`** (RDS uchun) — Inbound rules:

| Port | Protokol | Manba | Nima uchun |
|---|---|---|---|
| 5432 | PostgreSQL | **`lamboerp-web-sg`** (SG ID) | Faqat EC2'dagi ilova bazaga ulanadi |

Outbound — default (hammasi ruxsat). Gunicorn (8000-port) tashqariga **ochilmaydi** — faqat nginx orqali.

## 4. RDS PostgreSQL

**RDS → Create database**
- **Standard create**, Engine: **PostgreSQL** (16 yoki 17)
- Templates: **Free tier**
- DB instance identifier: `lamboerp-db`
- Master username: `lamboerp`, **Self managed** parol — yozib qo'ying (faqat `.env` ga yoziladi)
- Instance: `db.t4g.micro` (yoki `db.t3.micro`), Storage: 20 GB gp3, autoscaling — o'chiring
- Connectivity: **Don't connect to an EC2** (SG'ni o'zimiz beramiz), **Public access: No**
- VPC security group: **Choose existing → `lamboerp-db-sg`** (default'ni olib tashlang)
- Additional configuration → **Initial database name: `lamboerp`**
- Performance Insights / Enhanced monitoring — o'chiring (xarajat)
- **Create database** (5–10 daqiqa). Tayyor bo'lgach **Endpoint** ni nusxalang.

## 5. EC2 instance

**EC2 → Launch instance**
- Name: `lamboerp-web`
- AMI: **Ubuntu Server 24.04 LTS**
- Instance type: **t3.micro** (Free tier eligible)
- Key pair: yangi yarating (`lamboerp-key`, .pem) — yoki brauzerdagi *EC2 Instance Connect* dan foydalaning
- Network: default VPC, **Auto-assign public IP: Enable**, Security group: **`lamboerp-web-sg`**
- Storage: 8–20 GB gp3
- Advanced details → **IAM instance profile: `lamboerp-ec2-role`**
- **Launch instance**. Public IPv4 manzilni yozib oling.

## 6. Ilovani o'rnatish

EC2 → instance → **Connect → EC2 Instance Connect → Connect** (brauzerda terminal ochiladi):

```bash
git clone https://github.com/erkinov0117d/lamboerp.git ~/lamboerp
cd ~/lamboerp
cp deploy/aws/.env.aws.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # SECRET_KEY uchun
nano .env
```

`.env` ni to'ldiring: `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS=<EC2 public IP>`, `DB_HOST=<RDS endpoint>`,
`DB_PASSWORD`, `AWS_STORAGE_BUCKET_NAME`. Saqlash: `Ctrl+O`, `Enter`, `Ctrl+X`.

```bash
bash deploy/aws/setup_ec2.sh
.venv/bin/python manage.py seed_db          # demo ma'lumotlar (parol: lambo12345)
```

Oxirida `{"status":"ok", ... "engine":"postgresql" ... "backend":"Amazon S3"}` chiqsa — baza va S3 ishlayapti.
Brauzerda: `http://<EC2 public IP>/` — login `ceo` / `lambo12345`.

## 7. Tekshiruv (hisobot uchun skrinshotlar)

| Nima | Qanday |
|---|---|
| Ilova ochiladi | `http://<IP>/` — login va analitika sahifasi |
| RDS ishlayapti | `http://<IP>/api/health/` → `"engine": "postgresql"`; EC2'da: `psql "host=<endpoint> user=lamboerp dbname=lamboerp sslmode=require" -c '\dt'` |
| S3 ishlayapti | Ilovada buyurtma kartochkasida **📄 Invoice** → **Hujjatlar** sahifasida "Saqlash joyi: Amazon S3"; AWS konsolida bucket → `lamboerp/documents/...` da PDF |
| Bucket yopiq | S3 konsolida obyektning *Object URL* ini brauzerda ochsangiz → **AccessDenied** |
| Access key yo'q | `.env` va GitHub'da hech qanday `AWS_ACCESS_KEY` yo'q — ruxsat IAM role orqali |

## 8. CloudWatch monitoring

**8.1. Agent (RAM, disk, loglar)** — EC2 terminalida:

```bash
wget https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c file:$HOME/lamboerp/deploy/aws/cloudwatch-agent.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
```

**8.2. Natijani ko'rish**
- **CloudWatch → Metrics → All metrics → LamboERP** — `mem_used_percent`, `disk used_percent`
- **CloudWatch → Metrics → EC2 → Per-Instance** — `CPUUtilization`, `NetworkIn`
- **CloudWatch → Logs → Log groups → `/lamboerp/app`, `/lamboerp/nginx`** — gunicorn va nginx loglari

**8.3. Alarm**: **CloudWatch → Alarms → Create alarm** → `EC2 > Per-Instance > CPUUtilization` (lamboerp-web)
→ Threshold: `> 80` (5 daqiqa) → Notification: yangi SNS topic, emailingiz → **Create alarm** (emailni tasdiqlang).

**8.4. Dashboard** (ixtiyoriy, skrinshot uchun qulay): **Dashboards → Create** → CPU, mem_used_percent,
RDS `DatabaseConnections` vidjetlari.

## 9. Kod yangilanganda

Kompyuterda: `cd frontend; npm run build; cd ..; git add .; git commit -m "..."; git push`
EC2'da: `bash ~/lamboerp/deploy/aws/update.sh`

## 10. Himoyadan keyin tozalash (xarajat bo'lmasligi uchun)

1. EC2 → instance → **Terminate**
2. RDS → `lamboerp-db` → **Delete** (final snapshot — kerak bo'lmasa olib tashlang)
3. S3 → bucket → **Empty** → **Delete**
4. CloudWatch → Alarms, Log groups, Dashboard → **Delete**
5. EC2 → Security Groups, Key pair; IAM → role va policy → **Delete**

## Xavfsizlik bo'yicha qisqacha

- Parollar, `SECRET_KEY`, RDS ma'lumotlari faqat EC2'dagi `.env` faylida (`.gitignore` da — GitHub'ga tushmaydi).
- AWS access key / secret key **umuman ishlatilmaydi** — EC2 IAM role.
- RDS internetga ochiq emas (Public access: No) va faqat `lamboerp-web-sg` dan 5432-portga ruxsat; ulanish SSL bilan (`sslmode=require`).
- S3 bucket: Block Public Access, SSE-S3 shifrlash; fayllar faqat avtorizatsiyadan o'tgan foydalanuvchiga, o'z filiali doirasida, Django orqali beriladi.
- SSH (22) faqat sizning IP manzilingizdan; gunicorn tashqi tarmoqqa ochilmagan.
- Ilovada JWT autentifikatsiya, rollar bo'yicha ruxsatlar (RBAC), fayl turi va hajmi (10 MB) tekshiruvi.
