import tempfile
from io import StringIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Branch, Inventory

PASSWORD = 'lambo12345'


class ERPApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_db', stdout=StringIO())
        cls.tas = Branch.objects.get(name='Lamborghini Tashkent')
        cls.dxb = Branch.objects.get(name='Lamborghini Dubai')

    def login(self, username):
        r = self.client.post('/api/auth/token/', {'username': username, 'password': PASSWORD}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + r.json()['access'])
        return r.json()

    def test_requires_jwt(self):
        self.assertEqual(self.client.get('/api/v1/inventory/').status_code, 401)

    def test_auth_flow(self):
        data = self.login('ceo')
        self.assertEqual(data['user']['role'], 'top_management')
        self.assertEqual(self.client.get('/api/auth/me/').json()['username'], 'ceo')
        r = self.client.post('/api/auth/token/refresh/', {'refresh': data['refresh']}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_top_management_sees_everything(self):
        self.login('ceo')
        self.assertEqual(len(self.client.get('/api/v1/branches/').json()), 3)
        self.assertEqual(len(self.client.get('/api/v1/inventory/').json()), Inventory.objects.count())
        a = self.client.get('/api/v1/analytics/').json()
        self.assertEqual(len(a['by_branch']), 3)
        self.assertGreater(a['sales']['total_revenue'], 0)

    def test_salary_visibility_and_update(self):
        self.login('sales_tas')
        staff = self.client.get('/api/v1/users/').json()
        me = next(u for u in staff if u['username'] == 'sales_tas')
        self.assertIn('salary', me)
        self.assertTrue(all('salary' not in u for u in staff if u['username'] != 'sales_tas'))
        self.assertEqual(self.client.patch(f"/api/v1/users/{me['id']}/", {'salary': '99999'}, format='json').status_code, 403)

        self.login('ceo')
        r = self.client.patch(f"/api/v1/users/{me['id']}/", {'salary': '12000'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()['salary'], '12000.00')
        self.assertEqual(self.client.patch(f"/api/v1/users/{me['id']}/", {'salary': '-1'}, format='json').status_code, 400)
        payroll = self.client.get('/api/v1/analytics/').json()['payroll']
        self.assertGreater(float(payroll['monthly']), 12000)

    def test_kpi(self):
        self.login('ceo')
        data = self.client.get('/api/v1/kpi/?period=year').json()
        roles = {r['role'] for r in data['results']}
        self.assertEqual(roles, {'sales_manager', 'service_master', 'warehouse_manager'})
        self.assertGreater(data['totals']['staff_count'], 9)
        self.assertEqual(self.client.get('/api/v1/kpi/?period=bad').status_code, 400)

        sales = next(r for r in data['results'] if r['username'] == 'sales_tas')
        url = f"/api/v1/kpi/{sales['user_id']}/target/?period=year"
        # Juda katta reja -> bajarilish 70% dan past -> bonus yo'q
        r = self.client.patch(url, {'monthly_revenue_target': '99000000', 'monthly_orders_target': '100'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()['bonus'], 0)
        self.assertEqual(r.json()['rating'], 'low')
        self.assertEqual(self.client.patch(url, {'bonus_rate': 150}, format='json').status_code, 400)

        self.login('sales_tas')
        mine = self.client.get('/api/v1/kpi/').json()['results']
        self.assertEqual([r['username'] for r in mine], ['sales_tas'])
        self.assertEqual(self.client.patch(url, {'bonus_rate': 50}, format='json').status_code, 403)

    def test_health_is_public(self):
        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['status'], 'ok')
        self.assertTrue(r.json()['checks']['database']['ok'])
        self.assertEqual(r.json()['checks']['storage']['backend'], 'Lokal disk')

    def test_documents_and_invoice(self):
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            self.login('sales_tas')
            order = self.client.get('/api/v1/orders/').json()[0]

            # Invoice PDF yaratish -> hujjat sifatida saqlanadi
            r = self.client.post(f"/api/v1/orders/{order['id']}/invoice/")
            self.assertEqual(r.status_code, 201, r.content)
            invoice = r.json()
            self.assertEqual(invoice['kind'], 'invoice')
            self.assertEqual(invoice['order'], order['id'])
            pdf = self.client.get(f"/api/v1/documents/{invoice['id']}/download/")
            self.assertEqual(pdf.status_code, 200)
            self.assertTrue(b''.join(pdf.streaming_content).startswith(b'%PDF'))
            pdf.close()

            # Fayl yuklash: filial avtomatik, ruxsat etilmagan tur rad etiladi
            upload = SimpleUploadedFile('shartnoma.txt', b'Oldi-sotdi shartnomasi', content_type='text/plain')
            r = self.client.post('/api/v1/documents/', {'file': upload, 'title': 'Shartnoma', 'kind': 'contract'})
            self.assertEqual(r.status_code, 201, r.content)
            self.assertEqual(r.json()['branch'], self.tas.id)
            bad = SimpleUploadedFile('virus.exe', b'MZ', content_type='application/octet-stream')
            self.assertEqual(self.client.post('/api/v1/documents/', {'file': bad, 'title': 'x'}).status_code, 400)

            # Boshqa filial xodimi ko'rmaydi, omborchi boshqaning hujjatini o'chira olmaydi
            self.login('sales_dxb')
            self.assertEqual(self.client.get(f"/api/v1/documents/{invoice['id']}/download/").status_code, 404)
            self.login('warehouse_tas')
            self.assertEqual(len(self.client.get('/api/v1/documents/').json()), 2)
            self.assertEqual(self.client.delete(f"/api/v1/documents/{invoice['id']}/").status_code, 403)
            self.login('ceo')
            self.assertEqual(self.client.delete(f"/api/v1/documents/{invoice['id']}/").status_code, 204)

    def test_branches_and_analytics_top_only(self):
        self.login('sales_tas')
        self.assertEqual(self.client.get('/api/v1/branches/').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/analytics/').status_code, 403)

    def test_sales_manager_car_order_lifecycle(self):
        self.login('sales_tas')
        inv = self.client.get('/api/v1/inventory/').json()
        self.assertEqual({i['item_type'] for i in inv}, {'car'})
        self.assertEqual({i['branch'] for i in inv}, {self.tas.id})

        car = next(i for i in inv if i['status'] == 'available')
        payload = {'order_type': 'car_sale', 'customer_name': 'Test', 'customer_phone': '1',
                   'items': [{'inventory_item': car['id']}]}
        r = self.client.post('/api/v1/orders/', payload, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()['branch'], self.tas.id)
        self.assertEqual(r.json()['total_price'], car['price'])
        order_id = r.json()['id']
        self.assertEqual(Inventory.objects.get(pk=car['id']).status, 'reserved')

        # Bitta avtomobilni ikki marta sotib bo'lmaydi
        self.assertEqual(self.client.post('/api/v1/orders/', payload, format='json').status_code, 400)

        self.client.patch(f'/api/v1/orders/{order_id}/', {'status': 'completed'}, format='json')
        self.assertEqual(Inventory.objects.get(pk=car['id']).status, 'sold')

    def test_sales_manager_restrictions(self):
        self.login('sales_tas')
        r = self.client.post('/api/v1/inventory/', {'item_type': 'part', 'name': 'x', 'sku_or_vin': 'X1',
                                                    'price': '1'}, format='json')
        self.assertEqual(r.status_code, 400)
        other = Inventory.objects.filter(branch=self.dxb, item_type='car').first()
        self.assertEqual(self.client.get(f'/api/v1/inventory/{other.id}/').status_code, 404)

    def test_warehouse_manager(self):
        self.login('warehouse_tas')
        low = self.client.get('/api/v1/inventory/?low_stock=1').json()
        self.assertTrue(all(i['is_low_stock'] for i in low))
        r = self.client.post('/api/v1/inventory/', {'item_type': 'part', 'name': 'New Part', 'sku_or_vin': 'NEW-1',
                                                    'price': '99.50', 'stock_quantity': 10}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()['branch'], self.tas.id)
        r = self.client.post('/api/v1/inventory/', {'branch': self.dxb.id, 'item_type': 'part', 'name': 'x',
                                                    'sku_or_vin': 'X2', 'price': '1'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.get('/api/v1/orders/').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/orders/', {}, format='json').status_code, 403)

    def test_service_master_parts_consumption(self):
        self.login('service_tas')
        part = next(i for i in self.client.get('/api/v1/inventory/').json() if i['stock_quantity'] >= 2)
        r = self.client.post('/api/v1/orders/', {
            'order_type': 'service', 'customer_name': 'S', 'customer_phone': '1',
            'items': [{'inventory_item': part['id'], 'quantity': 2}]}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(Inventory.objects.get(pk=part['id']).stock_quantity, part['stock_quantity'] - 2)

        self.client.patch(f"/api/v1/orders/{r.json()['id']}/", {'status': 'cancelled'}, format='json')
        self.assertEqual(Inventory.objects.get(pk=part['id']).stock_quantity, part['stock_quantity'])

        types = {o['order_type'] for o in self.client.get('/api/v1/orders/').json()}
        self.assertEqual(types, {'service'})
        r = self.client.post('/api/v1/orders/', {
            'order_type': 'car_sale', 'customer_name': 'S', 'customer_phone': '1',
            'items': [{'inventory_item': part['id']}]}, format='json')
        self.assertEqual(r.status_code, 400)
