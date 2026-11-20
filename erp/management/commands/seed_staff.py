import random
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction

from erp.models import Branch, User

from .seed_db import BRANCHES, DEFAULT_PASSWORD, SALARY

BRANCH_CODE = {name: code for name, _, _, code in BRANCHES}  # 'Lamborghini Dubai' -> 'dxb'

# Filial kodi (BRANCHES nomidagi shahar bo'yicha) -> (erkak ismlari, ayol ismlari, familiyalar)
NAMES = {
    'Tashkent': (
        ['Akmal', 'Bobur', 'Doniyor', 'Eldor', 'Farrux', 'Islom', 'Javohir', 'Jamshid', 'Laziz', 'Mirjalol',
         'Nodir', 'Rustam', 'Sanjar', 'Shoxrux', 'Timur', 'Ulugbek', 'Sherzod', 'Abdulla', 'Azamat', 'Behruz'],
        ['Aziza', 'Dilfuza', 'Gulnora', 'Madina', 'Malika', 'Nigora', 'Nilufar', 'Sevara', 'Shahnoza', 'Zarina'],
        ['Abdullayev', 'Karimov', 'Rahimov', 'Tursunov', 'Yusupov', 'Nazarov', 'Aliyev', 'Ismoilov', 'Qodirov',
         'Mirzayev', 'Saidov', 'Xolmatov', 'Ergashev', 'Hasanov', 'Sobirov'],
    ),
    'Dubai': (
        ['Ahmed', 'Ali', 'Faisal', 'Hamdan', 'Hassan', 'Ibrahim', 'Khalid', 'Majid', 'Mansour', 'Mohammed',
         'Nasser', 'Omar', 'Rashid', 'Saeed', 'Salem', 'Sultan', 'Tariq', 'Yousef', 'Zayed', 'Karim'],
        ['Aisha', 'Fatima', 'Hessa', 'Layla', 'Mariam', 'Noura', 'Reem', 'Salma', 'Shamma', 'Amira'],
        ['Al Maktoum', 'Al Nahyan', 'Al Mansouri', 'Al Falasi', 'Al Suwaidi', 'Al Shamsi', 'Al Hashimi',
         'Al Marri', 'Al Ketbi', 'Al Mazrouei', 'Haddad', 'Rahman', 'Al Farsi', 'Al Zaabi', 'Al Qasimi'],
    ),
    'Milano': (
        ['Alessandro', 'Andrea', 'Davide', 'Federico', 'Francesco', 'Giorgio', 'Giovanni', 'Lorenzo', 'Marco',
         'Matteo', 'Nicola', 'Riccardo', 'Roberto', 'Simone', 'Stefano', 'Tommaso', 'Vincenzo', 'Fabio', 'Emanuele', 'Pietro'],
        ['Alessia', 'Elena', 'Federica', 'Francesca', 'Giulia', 'Martina', 'Sara', 'Silvia', 'Valentina', 'Beatrice'],
        ['Rossi', 'Russo', 'Bianchi', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Costa',
         'Fontana', 'Esposito', 'Moretti', 'Barbieri', 'Lombardi'],
    ),
}

# Yangi xodimlar rollari taqsimoti (har bir filialda shu tartibda aylanadi)
ROLE_CYCLE = ['sales_manager', 'service_master', 'sales_manager', 'service_master', 'warehouse_manager']
PREFIX = {'sales_manager': 'sales', 'service_master': 'service', 'warehouse_manager': 'warehouse'}


def _female(last, city):
    """O'zbek familiyasining ayol shakli (Karimov -> Karimova)."""
    return last + 'a' if city == 'Tashkent' and last.endswith(('ov', 'ev')) else last


class Command(BaseCommand):
    help = "Filiallarga qo'shimcha xodimlar qo'shib, foydalanuvchilar sonini --total ga yetkazadi (standart 100)."

    def add_arguments(self, parser):
        parser.add_argument('--total', type=int, default=100, help='Bazadagi foydalanuvchilar soni kamida shuncha bo\'ladi.')

    @transaction.atomic
    def handle(self, *args, total=100, **options):
        branches = list(Branch.objects.order_by('id'))
        if not branches:
            self.stderr.write("Filiallar yo'q. Avval: python manage.py seed_db")
            return

        need = total - User.objects.count()
        if need <= 0:
            self.stdout.write(f'Foydalanuvchilar allaqachon yetarli: {User.objects.count()}')
            return

        rng = random.Random(2026)
        password = make_password(DEFAULT_PASSWORD)  # bitta hash — 80 ta set_password'dan ancha tez
        used = set(User.objects.values_list('first_name', 'last_name'))
        created = []

        for n in range(need):
            branch = branches[n % len(branches)]
            city = next((c for c in NAMES if c in branch.name), 'Tashkent')
            code = BRANCH_CODE.get(branch.name) or f'b{branch.id}'
            role = ROLE_CYCLE[(n // len(branches)) % len(ROLE_CYCLE)]
            males, females, lasts = NAMES[city]

            while True:
                is_female = rng.random() < 0.3
                first = rng.choice(females if is_female else males)
                last = rng.choice(lasts)
                if is_female:
                    last = _female(last, city)
                if (first, last) not in used:
                    used.add((first, last))
                    break

            i = 2
            while User.objects.filter(username=f'{PREFIX[role]}{i}_{code}').exists() or \
                    any(u.username == f'{PREFIX[role]}{i}_{code}' for u in created):
                i += 1
            username = f'{PREFIX[role]}{i}_{code}'

            base = SALARY[role]
            created.append(User(
                username=username, password=password, role=role, branch=branch,
                first_name=first, last_name=last, email=f'{username}@lamboerp.local',
                salary=(base + rng.randint(-5, 10) * (base / 50)).quantize(Decimal('1')),
            ))

        User.objects.bulk_create(created)
        self.stdout.write(self.style.SUCCESS(
            f"{len(created)} ta xodim qo'shildi. Jami foydalanuvchilar: {User.objects.count()}"))
        self.stdout.write(f'Yangi xodimlar paroli: {DEFAULT_PASSWORD}')
