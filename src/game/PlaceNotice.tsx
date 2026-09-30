import { useEffect, useState } from 'react'

export function PlaceNotice({ name }: { name: string }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 3200)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null
  return <div className="place-notice" role="status"><span>Du ankommer</span><strong>{name}</strong></div>
}
