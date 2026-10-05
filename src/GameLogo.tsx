import logo from './assets/brand/godt-haill-logo.png'
import headerLogo from './assets/brand/godt-haill-header.png'

export function GameLogo({ className = '', priority = false, variant = 'full' }: { className?: string; priority?: boolean; variant?: 'full' | 'header' }) {
  const header = variant === 'header'
  return <img className={`game-logo ${className}`} src={header ? headerLogo : logo} alt={header ? 'Godt Haill' : 'Godt Haill – Bare ett kast til'} width={header ? 2172 : 1672} height={header ? 724 : 941} decoding="async" fetchPriority={priority ? 'high' : 'auto'} />
}
