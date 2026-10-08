#!/usr/bin/env bash
# Kod yangilanganda (git push'dan keyin) EC2'da ishga tushiring: bash deploy/aws/update.sh
set -euo pipefail
cd "$HOME/lamboerp"

git pull
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput
sudo systemctl restart lamboerp
sleep 2
curl -fsS http://127.0.0.1/api/health/ && echo
