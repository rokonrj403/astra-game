import { useEffect, useState } from 'react'

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** A number that counts from one value to another. With reduced motion (or no animation frames) it shows the final value at once. */
export function CountUp({ from, to, ms = 700 }: { from: number; to: number; ms?: number }) {
  const still = prefersReducedMotion() || typeof requestAnimationFrame !== 'function' || from === to
  const [v, setV] = useState(still ? to : from)
  useEffect(() => {
    if (still) {
      setV(to)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to, ms, still])
  return <span>{v}</span>
}

/** A few falling stars for a finished mission. Purely decorative, hidden from screen readers, off with reduced motion. */
export function Celebrate() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <i key={i} style={{ ['--x' as string]: `${(i * 37) % 100}%`, ['--d' as string]: `${(i % 5) * 0.25}s`, ['--c' as string]: ['var(--sun)', 'var(--air)', 'var(--plants)', 'var(--radio)'][i % 4] }} />
      ))}
    </div>
  )
}
