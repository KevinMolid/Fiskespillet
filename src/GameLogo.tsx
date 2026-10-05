import logo from './assets/brand/godt-haill-logo.png'

export function GameLogo({ className = '', priority = false }: { className?: string; priority?: boolean }) {
  return <img className={`game-logo ${className}`} src={logo} alt="Godt Haill – Bare ett kast til" width={1672} height={941} decoding="async" fetchPriority={priority ? 'high' : 'auto'} />
}
