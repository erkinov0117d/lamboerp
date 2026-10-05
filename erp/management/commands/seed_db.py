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
        self._user('ceo', 'top_management', None, 'Bosh', 'Direktor')

        for name, location, phone, code in BRANCHES:
            branch = Branch.objects.create(name=name, location=location, phone=phone)
            sales = self._user(f'sales_{code}', 'sales_manager', branch, 'Sotuv', code.upper())
            self._user(f'warehouse_{code}', 'warehouse_manager', branch, 'Ombor', code.upper())
            master = self._user(f'service_{code}', 'service_master', branch, 'Usta', code.upper())

            cars = []
            for i, (car_name, price) in enumerate(CARS):
                cars.append(Inventory.objects.create(
                    branch=branch, item_type='car', name=car_name,
                    sku_or_vin=f'ZHW{code.upper()}{i:02d}{random.randint(100000, 999999)}',
                    price=price, stock_quantity=1,
                ))
            parts = []
            for part_name, price, sku in PARTS:
                qty = random.choice([2, 3, 4, 8, 12, 20, 35])
                parts.append(Inventory.objects.create(
                    branch=branch, item_type='part', name=part_name,
                    sku_or_vin=f'{sku}-{code.upper()}-{random.randint(1000, 9999)}',
                    price=price, stock_quantity=qty,
                    status='available',
                ))

            self._seed_orders(branch, sales, master, cars, parts)

        self.stdout.write(self.style.SUCCESS("Seed muvaffaqiyatli yakunlandi."))
        self.stdout.write(f"Barcha foydalanuvchilar paroli: {DEFAULT_PASSWORD}")
        self.stdout.write("Loginlar: admin, ceo, sales_tas, warehouse_tas, service_tas, "
                          "sales_dxb, warehouse_dxb, service_dxb, sales_mil, warehouse_mil, service_mil")

    def _user(self, username, role, branch, first_name, last_name):
        user, _ = User.objects.get_or_create(username=username, defaults={
            'role': role, 'branch': branch, 'first_name': first_name, 'last_name': last_name,
            'email': f'{username}@lamboerp.local',
        })
        user.set_password(DEFAULT_PASSWORD)
        user.save()
        return user

    def _seed_orders(self, branch, sales, master, cars, parts):
        now = timezone.now()
        # Avtomobil sotuvlari: Kanban uchun turli holatlar
        car_statuses = ['completed', 'completed', 'in_progress', 'pending']
        for car, status in zip(random.sample(cars, len(car_statuses)), car_statuses):
            name, phone = random.choice(CUSTOMERS)
            order = services.create_order(
                {'branch': branch, 'order_type': 'car_sale', 'customer_name': name,
                 'customer_phone': phone, 'assigned_to': sales, 'status': status},
                [{'inventory_item': car, 'quantity': 1}],
            )
            self._backdate(order, now - timedelta(days=random.randint(1, 300)))

        # Servis buyurtmalari
        for status in ['completed', 'completed', 'completed', 'in_progress', 'pending', 'cancelled']:
            name, phone = random.choice(CUSTOMERS)
            used = [p for p in random.sample(parts, 2) if p.stock_quantity > 1]
            for p in used:
                p.refresh_from_db()
            items = [{'inventory_item': p, 'quantity': 1} for p in used if p.stock_quantity >= 1]
            if not items:
                continue
            order = services.create_order(
                {'branch': branch, 'order_type': 'service', 'customer_name': name,
                 'customer_phone': phone, 'assigned_to': master,
                 'status': 'pending' if status == 'cancelled' else status},
                items,
            )
            if status == 'cancelled':
                services.update_order(order, {'status': 'cancelled'})
            self._backdate(order, now - timedelta(days=random.randint(1, 300)))

    @staticmethod
    def _backdate(order, when):
        Order.objects.filter(pk=order.pk).update(created_at=when)
