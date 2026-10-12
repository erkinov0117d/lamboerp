# Lamborghini ERP — AWS Academy Learner Lab'da deploy (kartasiz)

AWS Academy Learner Lab — o'quv kreditli **haqiqiy AWS hisobi**. Karta talab qilinmaydi.
Oddiy AWS hisobi uchun yo'riqnoma: [`AWS_DEPLOY.md`](AWS_DEPLOY.md). Bu fayl — Learner Lab uchun moslangan versiya.

```
Foydalanuvchi → Internet → [SG: 80, 22] → EC2 (nginx → gunicorn → Django + React)
                                            ├─→ RDS PostgreSQL   (5432 — faqat EC2 SG'dan)
                                            ├─→ S3               (hujjatlar, invoice — LabInstanceProfile orqali)
                                            └─→ CloudWatch       (metrikalar, loglar, alarm)
```

## Learner Lab cheklovlari (himoyada tushuntirish uchun)

| Cheklov | Yechim |
|---|---|
| Faqat **us-east-1** / us-west-2 regionlari | Hammasi **us-east-1 (N. Virginia)** da |
| IAM role/policy yaratib bo'lmaydi | Tayyor **`LabInstanceProfile`** (`LabRole`) EC2'ga biriktiriladi — access key'siz. Haqiqiy hisobda o'rniga minimal huquqli `deploy/aws/iam-s3-policy.json` ishlatilardi |
| Sessiya ~4 soat, tugaganda EC2 to'xtaydi | Har safar **Start Lab** → EC2 avtomatik qayta yoqiladi, ilova `systemd` orqali o'zi ko'tariladi |
| EC2 qayta yoqilganda public IP o'zgaradi | **Elastic IP** — manzil o'zgarmaydi |
| Kredit cheklangan (~$50–100) | Faqat micro instance'lar; himoyadan keyin tozalash |

---

## 1. Learner Lab'ga kirish

1. O'qituvchi yuborgan **AWS Academy** taklif xatidagi havola orqali ro'yxatdan o'ting (karta so'ralmaydi).
2. https://awsacademy.instructure.com → kursni oching → **Modules** → **Launch AWS Academy Learner Lab**.
3. **Start Lab** tugmasini bosing. **AWS** yozuvi yonidagi doira **yashil** bo'lguncha kuting (1–3 daqiqa).
4. **AWS** yozuvini bosing — AWS konsoli yangi oynada ochiladi.
5. Konsolda region **N. Virginia (us-east-1)** ekanini tekshiring.

> Ishni tugatgach **End Lab** bosing — kredit tejaladi. Keyingi safar **Start Lab** → hammasi qayta yoqiladi.

## 2. S3 bucket

**S3 → Create bucket**
- Bucket name: `lamboerp-docs-<ismingiz>` (dunyoda noyob)
- **Block all public access: ✅** (o'zgartirmang)
- Default encryption: **SSE-S3**
- **Create bucket**

Keyin bucket → **Permissions → Bucket policy → Edit** → `deploy/aws/s3-bucket-policy.json` mazmunini qo'ying,
`BUCKET_NOMI` ni almashtiring → **Save**. Bu siyosat shifrlanmagan (HTTP) ulanishlarni rad etadi.

## 3. Security Group'lar

**EC2 → Security Groups → Create security group** (VPC — default):

**`lamboerp-web-sg`** — Inbound:

| Port | Manba | Nima uchun |
|---|---|---|
| 22 (SSH) | **My IP** | Serverni boshqarish |
| 80 (HTTP) | 0.0.0.0/0 | Web-ilova |

**`lamboerp-db-sg`** — Inbound:

| Port | Manba | Nima uchun |
|---|---|---|
| 5432 (PostgreSQL) | **`lamboerp-web-sg`** | Faqat ilova serveri bazaga ulanadi |

> EC2 Instance Connect (brauzerdagi terminal) ishlatsangiz va u ulana olmasa — 22-port manbasini vaqtincha
> `0.0.0.0/0` qiling, ish tugagach yana **My IP** ga qaytaring.

## 4. RDS PostgreSQL

**RDS → Create database**
- Standard create · **PostgreSQL** · Templates: **Free tier** (yoki Dev/Test)
- DB instance identifier: `lamboerp-db` · Master username: `lamboerp` · parolni o'zingiz kiriting va yozib qo'ying
- Instance class: **db.t3.micro** · Storage: 20 GB gp2/gp3, autoscaling — o'chiring
- **Public access: No** · VPC security group: **`lamboerp-db-sg`** (default'ni olib tashlang)
- Additional configuration → **Initial database name: `lamboerp`**
- Enhanced monitoring, Performance Insights — o'chiring
- **Create database** (5–10 daqiqa) → **Endpoint** ni nusxalang

## 5. EC2 instance

**EC2 → Launch instance**
- Name: `lamboerp-web` · AMI: **Ubuntu Server 24.04 LTS** · Type: **t3.micro** (yoki t2.micro)
- Key pair: **vockey** (Learner Lab'da tayyor)
- Network settings → Edit → Auto-assign public IP: **Enable** · Security group: **`lamboerp-web-sg`**
- Storage: 20 GB gp3
- Advanced details → **IAM instance profile: `LabInstanceProfile`**
- **Launch instance**

**Elastic IP**: EC2 → **Elastic IPs → Allocate** → yangi IP → **Actions → Associate** → `lamboerp-web`.
Shu IP endi doimiy manzil.

## 6. Ilovani o'rnatish

EC2 → `lamboerp-web` → **Connect → EC2 Instance Connect → Connect**:

```bash
git clone https://github.com/erkinov0117d/lamboerp.git ~/lamboerp
cd ~/lamboerp
cp deploy/aws/.env.aws.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
nano .env
```

`.env` da: `DJANGO_SECRET_KEY` (yuqoridagi natija), `DJANGO_ALLOWED_HOSTS=<Elastic IP>`,
`DB_HOST=<RDS endpoint>`, `DB_PASSWORD`, `AWS_STORAGE_BUCKET_NAME`. Saqlash: `Ctrl+O`, `Enter`, `Ctrl+X`.

```bash
bash deploy/aws/setup_ec2.sh
.venv/bin/python manage.py seed_db
```

Oxirida `"status": "ok"`, `"engine": "postgresql"`, `"backend": "Amazon S3"` chiqishi kerak.
Brauzerda: `http://<Elastic IP>/` → `ceo` / `lambo12345`.

## 7. CloudWatch

```bash
wget https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c file:$HOME/lamboerp/deploy/aws/cloudwatch-agent.json
```

- **CloudWatch → Metrics → LamboERP** — `mem_used_percent`, disk `used_percent`
- **EC2 → Per-Instance Metrics** — `CPUUtilization`
- **Logs → Log groups** — `/lamboerp/app`, `/lamboerp/nginx`
- **Alarms → Create alarm** — CPUUtilization > 80% → SNS email
  (agar Learner Lab SNS'ga ruxsat bermasa — alarm'ni "No notification" bilan yarating, holati baribir ko'rinadi)

## 8. Har bir yangi sessiyada

1. **Start Lab** → yashil → **AWS**
2. EC2 avtomatik yonadi (1–2 daqiqa); RDS to'xtagan bo'lsa — RDS → `lamboerp-db` → **Actions → Start**
3. `http://<Elastic IP>/api/health/` → `"status": "ok"`

Kod yangilanganda EC2'da: `bash ~/lamboerp/deploy/aws/update.sh`

## 9. Himoyadan keyin tozalash

EC2 **Terminate** · Elastic IP **Release** · RDS **Delete** · S3 **Empty → Delete** ·
CloudWatch alarm va log group'lar · Security group'lar.
