import { useState } from 'react'

// Brend fayllari: frontend/public/brand/ (build'da dist/brand/ ga ko'chadi, nginx beradi).
export const BRAND_LOGO = '/brand/logo.svg'
export const BRAND_VIDEO = '/brand/login-bg.mp4'

/** Zaxira emblema (logo fayli bo'lmasa): olti qirrali oltin qalqon ichida "L". */
export function Emblem({ className = '' }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="emb-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset=".5" stopColor="#ffc824" />
          <stop offset="1" stopColor="#b88a00" />
        </linearGradient>
      </defs>
      <path d="M32 2 60 18v36L32 70 4 54V18Z" fill="#0b0b0b" stroke="url(#emb-gold)" strokeWidth="3" />
      <path d="M32 9 54 21.5v29L32 63 10 50.5v-29Z" fill="none" stroke="url(#emb-gold)" strokeWidth="1" opacity=".55" />
      <path d="M24 20h7v26h13v6H24Z" fill="url(#emb-gold)" />
    </svg>
  )
}

/** Brend logosi; fayl yuklanmasa — zaxira emblema. */
export function BrandLogo({ className = '' }) {
  const [ok, setOk] = useState(true)
  return ok
    ? <img src={BRAND_LOGO} alt="Logo" className={className} onError={() => setOk(false)} />
    : <Emblem className={className} />
}
