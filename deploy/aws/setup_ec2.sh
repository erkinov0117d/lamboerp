#!/usr/bin/env bash
# Lamborghini ERP — Amazon EC2 (Ubuntu 24.04) serverini birinchi marta sozlash.
# Ishlatish (EC2'da, ubuntu foydalanuvchisi sifatida):
#   git clone https://github.com/erkinov0117d/lamboerp.git ~/lamboerp
#   cd ~/lamboerp && nano .env            # deploy/aws/.env.aws.example asosida
#   bash deploy/aws/setup_ec2.sh
set -euo pipefail

APP_DIR="$HOME/lamboerp"
cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "XATO: $APP_DIR/.env topilmadi. deploy/aws/.env.aws.example dan nusxa oling va to'ldiring." >&2
  exit 1
fi

echo "==> 1/6 Tizim paketlari"
sudo apt-get update -y
sudo apt-get install -y python3-venv python3-dev nginx git postgresql-client

echo "==> 2/6 Python virtual muhit va kutubxonalar"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo "==> 3/6 Baza migratsiyasi (Amazon RDS) va statik fayllar"
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput

echo "==> 4/6 Gunicorn (systemd servisi)"
sudo cp deploy/aws/gunicorn.service /etc/systemd/system/lamboerp.service
sudo systemctl daemon-reload
sudo systemctl enable --now lamboerp
sudo systemctl restart lamboerp

echo "==> 5/6 Nginx (80-port -> gunicorn)"
sudo cp deploy/aws/nginx.conf /etc/nginx/sites-available/lamboerp
sudo ln -sf /etc/nginx/sites-available/lamboerp /etc/nginx/sites-enabled/lamboerp
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "==> 6/6 Tekshiruv"
sleep 2
curl -fsS http://127.0.0.1/api/health/ && echo
echo
echo "Tayyor. Demo ma'lumotlar uchun: .venv/bin/python manage.py seed_db"
