import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from erp import services
from erp.models import Branch, Inventory, Order, OrderItem, User

DEFAULT_PASSWORD = 'lambo12345'

BRANCHES = [
    ('Lamborghini Tashkent', 'Toshkent sh., Amir Temur ko\'chasi 107', '+998 71 200 00 01', 'tas'),
    ('Lamborghini Dubai', 'Sheikh Zayed Road, Dubai, UAE', '+971 4 000 0001', 'dxb'),
    ('Lamborghini Milano', 'Via Gattamelata 37, Milano, Italia', '+39 02 0000 001', 'mil'),
]

CARS = [
    ('Lamborghini Revuelto V12', Decimal('608000')),
    ('Lamborghini Huracán Tecnica', Decimal('239000')),
    ('Lamborghini Huracán Sterrato', Decimal('273000')),
    ('Lamborghini Urus Performante', Decimal('260000')),
    ('Lamborghini Urus SE', Decimal('258000')),
    ('Lamborghini Temerario', Decimal('350000')),
]

PARTS = [
    ('Carbon Ceramic Brake Kit', Decimal('18500'), 'CCB'),
    ('Pirelli P Zero Corsa Tyre 20"', Decimal('950'), 'TYR'),
    ('V12 Engine Oil Filter', Decimal('120'), 'OFL'),
    ('Castrol Edge 5W-40 (1L)', Decimal('35'), 'OIL'),
    ('Spark Plug Set (12 pcs)', Decimal('640'), 'SPK'),
    ('Air Filter Assembly', Decimal('410'), 'AFL'),
    ('LED Headlight Unit', Decimal('7200'), 'HDL'),
    ('Carbon Fiber Front Splitter', Decimal('5600'), 'SPL'),
    ('Brake Pad Set (Front)', Decimal('1350'), 'BPF'),
    ('Clutch Hydraulic Pump', Decimal('2100'), 'CHP'),
]

CAR_COPIES = 3              # har bir modeldan filialda nechta avtomobil
CAR_SALES_COMPLETED = 10    # filial bo'yicha 12 oydagi yakunlangan sotuvlar
SERVICE_COMPLETED = 22      # filial bo'yicha 12 oydagi yakunlangan servislar

# Oylik maosh (USD), har bir xodimda rolga qarab -10%..+20% farq bilan
SALARY = {
    'top_management': Decimal('25000'),
    'sales_manager': Decimal('9000'),
    'warehouse_manager': Decimal('5000'),
    'service_master': Decimal('7000'),
}

# Har bir filialga 3 tadan qo'shimcha xodim (BRANCHES tartibida)
EXTRA_STAFF = [
    [('sales_manager', 'Bekzod', 'Rahimov'), ('service_master', 'Otabek', 'Nazarov'), ('warehouse_manager', 'Kamola', 'Yusupova')],
    [('sales_manager', 'Khalid', 'Al Farsi'), ('service_master', 'Omar', 'Haddad'), ('service_master', 'Yusuf', 'Rahman')],
    [('sales_manager', 'Luca', 'Ferrari'), ('service_master', 'Paolo', 'Conti'), ('warehouse_manager', 'Chiara', 'Romano')],
]

CUSTOMERS = [
    ('Aziz Karimov', '+998 90 123 45 67'),
    ('Dilnoza Rahimova', '+998 93 765 43 21'),
    ('Ahmed Al Mansouri', '+971 50 111 2233'),
    ('Marco Rossi', '+39 333 123 4567'),
    ('Jasur Tursunov', '+998 97 555 66 77'),
    ('Fatima Al Zahra', '+971 55 444 7788'),
    ('Giulia Bianchi', '+39 347 987 6543'),
    ('Sardor Aliyev', '+998 99 888 11 22'),
]


class Command(BaseCommand):
    help = "Lamborghini ERP uchun dastlabki (demo) ma'lumotlarni yaratadi."

    def add_arguments(self, parser):
        parser.add_argument('--flush', action='store_true',
                            help="Mavjud ERP ma'lumotlarini o'chirib, qaytadan yaratadi.")

    @transaction.atomic
    def handle(self, *args, flush=False, **options):
        random.seed(42)
        if flush:
            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            Inventory.objects.all().delete()
            User.objects.exclude(is_superuser=True).delete()
            Branch.objects.all().delete()
            self.stdout.write(self.style.WARNING("Eski ma'lumotlar o'chirildi."))
        elif Branch.objects.exists():
            self.stdout.write(self.style.WARNING(
                "Ma'lumotlar allaqachon mavjud. Qayta yaratish uchun: python manage.py seed_db --flush"))
            return

        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@lamboerp.local', DEFAULT_PASSWORD,
                                          role='top_management', first_name='Stephan', last_name='Winkelmann')
        # --flush superuser'ni o'chirmaydi — maoshi bo'sh qolmasligi uchun
        User.objects.filter(username='admin', salary=0).update(salary=SALARY['top_management'])
        self._user('ceo', 'top_management', None, 'Bosh', 'Direktor')

        for (name, location, phone, code), extra_staff in zip(BRANCHES, EXTRA_STAFF):
            branch = Branch.objects.create(name=name, location=location, phone=phone)
            sales = [self._user(f'sales_{code}', 'sales_manager', branch, 'Sotuv', code.upper())]
            self._user(f'warehouse_{code}', 'warehouse_manager', branch, 'Ombor', code.upper())
            masters = [self._user(f'service_{code}', 'service_master', branch, 'Usta', code.upper())]
            # Qo'shimcha xodimlar
            for i, (role, first, last) in enumerate(extra_staff, start=2):
                user = self._user(f'{role.split("_")[0]}{i}_{code}', role, branch, first, last)
                {'sales_manager': sales, 'service_master': masters}.get(role, []).append(user)

            cars = []
            for copy in range(CAR_COPIES):
                for i, (car_name, price) in enumerate(CARS):
                    cars.append(Inventory.objects.create(
                        branch=branch, item_type='car', name=car_name,
                        sku_or_vin=f'ZHW{code.upper()}{copy}{i:02d}{random.randint(100000, 999999)}',
                        price=price, stock_quantity=1,
                    ))
            parts = []
            for part_name, price, sku in PARTS:
                qty = random.choice([14, 18, 25, 40, 60])
                parts.append(Inventory.objects.create(
                    branch=branch, item_type='part', name=part_name,
                    sku_or_vin=f'{sku}-{code.upper()}-{random.randint(1000, 9999)}',
                    price=price, stock_quantity=qty,
                    status='available',
                ))

            self._seed_orders(branch, sales, masters, cars, parts)

        self.stdout.write(self.style.SUCCESS("Seed muvaffaqiyatli yakunlandi."))
        self.stdout.write(f"Barcha foydalanuvchilar paroli: {DEFAULT_PASSWORD}")
        self.stdout.write("Loginlar: admin, ceo, sales_tas, warehouse_tas, service_tas, "
                          "sales_dxb, warehouse_dxb, service_dxb, sales_mil, warehouse_mil, service_mil")

    def _user(self, username, role, branch, first_name, last_name):
        base = SALARY[role]
        user, _ = User.objects.get_or_create(username=username, defaults={
            'role': role, 'branch': branch, 'first_name': first_name, 'last_name': last_name,
            'email': f'{username}@lamboerp.local',
            'salary': base + random.randint(-5, 10) * (base / 50),  # rolga qarab ±10–20% farq
        })
        user.set_password(DEFAULT_PASSWORD)
        user.save()
        return user

    def _seed_orders(self, branch, sales, masters, cars, parts):
        now = timezone.now()
        # Avtomobil sotuvlari 12 oy bo'yicha; oxirgi ikkitasi Kanban uchun ochiq holatda.
        car_statuses = ['completed'] * CAR_SALES_COMPLETED + ['in_progress', 'in_progress', 'pending', 'pending']
        for car, status in zip(random.sample(cars, len(car_statuses)), car_statuses):
            name, phone = random.choice(CUSTOMERS)
            # Odatda chegirma bilan sotiladi, ba'zan individual komplektatsiya (+ustama).
            price = (car.price * Decimal(random.choice(['0.96', '0.98', '1.00', '1.04', '1.12']))).quantize(Decimal('1'))
            order = services.create_order(
                {'branch': branch, 'order_type': 'car_sale', 'customer_name': name,
                 'customer_phone': phone, 'assigned_to': random.choice(sales), 'status': status},
                [{'inventory_item': car, 'quantity': 1, 'unit_price': price}],
            )
            days_ago = random.randint(1, 20) if status != 'completed' else random.randint(5, 360)
            self._backdate(order, now - timedelta(days=days_ago))

        # Servis buyurtmalari
        service_statuses = ['completed'] * SERVICE_COMPLETED + ['in_progress'] * 3 + ['pending'] * 2 + ['cancelled']
        for status in service_statuses:
            name, phone = random.choice(CUSTOMERS)
            for p in parts:
                p.refresh_from_db()
            available = [p for p in parts if p.stock_quantity >= 2]
            if not available:
                break
            items = [{'inventory_item': p, 'quantity': random.choice([1, 1, 2])}
                     for p in random.sample(available, min(len(available), random.choice([1, 2, 3])))]
            order = services.create_order(
                {'branch': branch, 'order_type': 'service', 'customer_name': name,
                 'customer_phone': phone, 'assigned_to': random.choice(masters),
                 'status': 'pending' if status == 'cancelled' else status},
                items,
            )
            if status == 'cancelled':
                services.update_order(order, {'status': 'cancelled'})
            days_ago = random.randint(1, 14) if status != 'completed' else random.randint(3, 360)
            self._backdate(order, now - timedelta(days=days_ago))

    @staticmethod
    def _backdate(order, when):
        Order.objects.filter(pk=order.pk).update(created_at=when)
