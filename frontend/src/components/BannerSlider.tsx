import React, { useEffect, useRef, useState } from 'react'
import api from '../lib/api'
import type { AxiosResponse } from 'axios'

export interface BannerItem {
  id: number
  title: string
  image_url?: string | null
  link_url?: string | null
  position: number
}

interface Props {
  autoMs?: number
}

/* Simple fade/slide banner slider (no external deps) */
export const BannerSlider: React.FC<Props> = ({ autoMs = 6000 }) => {
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    api.get<BannerItem[]>('/content/banners')
      .then((r: AxiosResponse<BannerItem[]>) => {
        if (!mounted) return
        setBanners(r.data || [])
        setLoading(false)
      })
      .catch((_e: unknown) => {
        if (!mounted) return
        setError('Failed to load banners')
        setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!banners.length) return
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setIndex((i: number) => (i + 1) % banners.length)
    }, autoMs) as unknown as number
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [banners, autoMs])

  if (loading) return <div style={wrapperStyle}>Loading banners…</div>
  if (error) return <div style={wrapperStyle}>{error}</div>
  if (!banners.length) return <div style={wrapperStyle}>No banners</div>

  const current = banners[index]

  return (
    <div style={wrapperStyle}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {banners.map((b, i) => (
          <a
            key={b.id}
            href={b.link_url || '#'}
            style={{
              ...slideStyle,
              opacity: i === index ? 1 : 0,
              transform: `translateX(${i === index ? 0 : i < index ? '-10px' : '10px'})`,
              zIndex: i === index ? 2 : 1,
            }}
          >
            {b.image_url ? (
              <img
                src={b.image_url}
                alt={b.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                loading="lazy"
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                background: '#1d3557',
                color: 'white',
                borderRadius: 8,
              }}>{b.title}</div>
            )}
            <div style={captionStyle}>{b.title}</div>
          </a>
        ))}
        <div style={dotsStyle}>
          {banners.map((b, i) => (
            <button
              key={b.id}
              aria-label={`Go to banner ${i + 1}`}
              onClick={() => setIndex(i)}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                margin: '0 4px',
                border: 'none',
                background: i === index ? '#e63946' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                padding: 0
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const wrapperStyle: React.CSSProperties = {
  width: '100%',
  height: 260,
  position: 'relative',
  overflow: 'hidden',
  background: '#f1f5f9',
  borderRadius: 8,
}

const slideStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  textDecoration: 'none',
  color: 'inherit',
  transition: 'opacity .6s ease, transform .6s ease',
}

const captionStyle: React.CSSProperties = {
  position: 'absolute',
  left: 16,
  bottom: 16,
  background: 'rgba(0,0,0,0.45)',
  color: 'white',
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 14,
  maxWidth: '70%',
}

const dotsStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
}

export default BannerSlider
