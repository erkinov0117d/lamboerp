// Rolga qarab dinamik menyu. Har bir rolning birinchi bandi — uning bosh sahifasi.
export const MENU = {
  top_management: [
    { to: '/analytics', label: 'Analitika', icon: '📊' },
    { to: '/branches', label: 'Filiallar', icon: '🏢' },
    { to: '/staff', label: 'Xodimlar va maoshlar', icon: '👥' },
    { to: '/inventory', label: 'Ombor', icon: '📦' },
    { to: '/orders', label: 'Buyurtmalar', icon: '🧾' },
  ],
  sales_manager: [
    { to: '/sales', label: 'Sotuv pipeline', icon: '🗂️' },
    { to: '/catalog', label: 'Avtomobillar katalogi', icon: '🏎️' },
  ],
  warehouse_manager: [
    { to: '/inventory', label: 'Ombor qoldiqlari', icon: '📦' },
    { to: '/orders', label: 'Buyurtmalar', icon: '🧾' },
  ],
  service_master: [
    { to: '/service', label: "Ta'mirlash kartochkalari", icon: '🔧' },
    { to: '/inventory', label: 'Ehtiyot qismlar', icon: '📦' },
  ],
}

export const ROLE_LABELS = {
  top_management: 'Bosh Boshqarma',
  sales_manager: 'Sotuv Menejeri',
  warehouse_manager: 'Omborchi',
  service_master: 'Servis Ustasi',
}

export const homePath = (role) => MENU[role]?.[0]?.to ?? '/login'

export const canAccess = (role, path) => !!MENU[role]?.some((m) => m.to === path)
