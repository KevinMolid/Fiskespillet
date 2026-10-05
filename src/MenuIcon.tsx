type Icon = 'bag' | 'book' | 'arrow' | 'plus' | 'save' | 'wave' | 'menu' | 'close'

export function MenuIcon({ name }: { name: Icon }) {
  return <svg className="menu-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {name === 'bag' && <><path d="M8 7V5a4 4 0 0 1 8 0v2M6 7h12l2 14H4L6 7Z" /><path d="M9 11h6M8 17h8" /></>}
    {name === 'book' && <><path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15" /><path d="M6 8h2M16 8h2M6 12h2M16 12h2" /></>}
    {name === 'arrow' && <path d="M4 12h16m-6-6 6 6-6 6" />}
    {name === 'plus' && <path d="M12 5v14M5 12h14" />}
    {name === 'save' && <><path d="m6 12 4 4 8-8" /><circle cx="12" cy="12" r="10" /></>}
    {name === 'wave' && <><path d="M2 9c3-5 5 5 10 0s7 5 10 0M2 16c3-5 5 5 10 0s7 5 10 0" /></>}
    {name === 'menu' && <path d="M4 6h16M4 12h16M4 18h16" />}
    {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
  </svg>
}
