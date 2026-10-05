# PythonAnywhere'ga deploy qilish

Backend (Django) va frontend (React) bitta saytda ishlaydi: `https://USERNAME.pythonanywhere.com`.
React oldindan kompyuterda build qilinadi (`frontend/dist`), uni Django + WhiteNoise beradi.

Quyida `USERNAME` — PythonAnywhere'dagi login'ingiz.

---

## 1. Kompyuterda: kodni GitHub'ga yuklash

```powershell
cd C:\Users\user\Desktop\lamboerp
cd frontend; npm run build; cd ..        # React'ni build qilish
git add .
git commit -m "Lamborghini ERP"
```

GitHub'da yangi repozitoriy oching (masalan `lamboerp`), keyin:

```powershell
git remote add origin https://github.com/GITHUB_LOGIN/lamboerp.git
git push -u origin main
```

> Repozitoriy **private** bo'lsa, PythonAnywhere'da clone qilishda GitHub parol o'rniga
> Personal Access Token so'raladi (GitHub → Settings → Developer settings → Tokens).

---

## 2. PythonAnywhere: kod va virtual muhit

pythonanywhere.com'da ro'yxatdan o'ting (Beginner — bepul), **Consoles → Bash** oching:

```bash
git clone https://github.com/GITHUB_LOGIN/lamboerp.git
cd lamboerp

mkvirtualenv --python=/usr/bin/python3.13 lamboerp-venv
pip install -r requirements.txt
```

## 3. `.env` fayli

```bash
cp .env.example .env
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
nano .env
```

`.env` ichida:

```
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<yuqorida chiqqan kalit>
DJANGO_ALLOWED_HOSTS=USERNAME.pythonanywhere.com
```

Saqlash: `Ctrl+O`, `Enter`, `Ctrl+X`.

## 4. Baza va statik fayllar

```bash
python manage.py migrate
python manage.py seed_db          # demo ma'lumotlar (parol: lambo12345)
python manage.py collectstatic --noinput
```

> Haqiqiy foydalanishda demo parollarni almashtiring yoki `seed_db` o'rniga
> `python manage.py createsuperuser` bilan boshlang.

## 5. Web ilova sozlash

**Web** bo'limi → **Add a new web app** → **Manual configuration** → **Python 3.13**.

Keyin shu sahifada:

| Bo'lim | Qiymat |
|---|---|
| **Source code** | `/home/USERNAME/lamboerp` |
| **Working directory** | `/home/USERNAME/lamboerp` |
| **Virtualenv** | `/home/USERNAME/.virtualenvs/lamboerp-venv` |
| **Force HTTPS** | Enabled |

**WSGI configuration file** havolasini bosing, ichidagi hamma narsani o'chirib, quyidagini qo'ying:

```python
import os
import sys

path = '/home/USERNAME/lamboerp'
if path not in sys.path:
    sys.path.insert(0, path)

os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

Saqlang va yuqoridagi yashil **Reload** tugmasini bosing.

Tayyor: `https://USERNAME.pythonanywhere.com` — login `ceo`, parol `lambo12345`.

---

## Yangilash (kod o'zgarganda)

Kompyuterda:

```powershell
cd frontend; npm run build; cd ..       # frontend o'zgargan bo'lsa
git add .; git commit -m "..."; git push
```

PythonAnywhere Bash'da:

```bash
cd ~/lamboerp
workon lamboerp-venv
git pull
pip install -r requirements.txt         # kutubxonalar o'zgargan bo'lsa
python manage.py migrate                # modellar o'zgargan bo'lsa
python manage.py collectstatic --noinput
```

So'ng **Web → Reload**.

## Muammolar

- **Sayt ochilmayapti / 500 xato** → Web bo'limidagi **Error log** ni o'qing.
- **`DJANGO_SECRET_KEY ... berilishi shart`** → `.env` fayli yo'q yoki noto'g'ri joyda (`/home/USERNAME/lamboerp/.env`).
- **`DisallowedHost`** → `.env` dagi `DJANGO_ALLOWED_HOSTS` domen bilan bir xil emas.
- **Sahifa oq / eski ko'rinish** → kompyuterda `npm run build` qilib, `frontend/dist` ni push qilishni unutgansiz.
- **Bepul tarif** → har 3 oyda bir marta Web bo'limida "Run until 3 months from today" tugmasini bosib turish kerak.
