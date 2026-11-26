// Rolga qarab dinamik menyu. Har bir rolning birinchi bandi — uning bosh sahifasi.
export const MENU = {
  top_management: [
    { to: '/analytics', label: 'Analitika',  },
    { to: '/branches', label: 'Filiallar',  },
    { to: '/staff', label: 'Xodimlar va maoshlar' },
    { to: '/documents', label: 'Hujjatlar' },
    { to: '/kpi', label: 'KPI',  },
    { to: '/inventory', label: 'Ombor' },
    { to: '/orders', label: 'Buyurtmalar' },
  ],
  sales_manager: [
    { to: '/sales', label: 'Sotuv pipeline'},
    { to: '/catalog', label: 'Avtomobillar katalogi' },
    { to: '/documents', label: 'Hujjatlar' },
    { to: '/kpi', label: "Mening KPI'im" },
  ],
  warehouse_manager: [
    { to: '/inventory', label: 'Ombor qoldiqlari' },
    { to: '/orders', label: 'Buyurtmalar' },
    { to: '/documents', label: 'Hujjatlar' },
    { to: '/kpi', label: "Mening KPI'im" },
  ],
  service_master: [
    { to: '/service', label: "Ta'mirlash kartochkalari" },
    { to: '/inventory', label: 'Ehtiyot qismlar' },
    { to: '/documents', label: 'Hujjatlar' },
    { to: '/kpi', label: "Mening KPI'im" },
  ]
}

export const ROLE_LABELS = {
  top_management: 'Bosh Boshqarma',
  sales_manager: 'Sotuv Menejeri',
  warehouse_manager: 'Omborchi',
  service_master: 'Servis Ustasi',
}

export const homePath = (role) => MENU[role]?.[0]?.to ?? '/login'

export const canAccess = (role, path) => !!MENU[role]?.some((m) => m.to === path)
