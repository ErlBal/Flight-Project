import React from 'react'
import { Link } from 'react-router-dom'
import BannerSlider from '../components/BannerSlider'
import QuickSearchForm from '../components/QuickSearchForm'
import HighlightedOffers from '../components/HighlightedOffers'

export default function Landing() {
  return (
    <div style={pageWrap}>
      <header style={heroHeader}>
        <div style={{ flex: 1 }}>
          <h1 style={titleStyle}>FlightProject</h1>
          <p style={subtitleStyle}>Search, compare and book flights quickly.</p>
          <div style={{ marginTop: 12 }}>
            <Link to="/search" style={primaryLink}>Open full search →</Link>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 320 }}>
          <BannerSlider />
        </div>
      </header>

      <section style={{ marginTop: 32 }}>
        <h2 style={sectionTitle}>Quick search</h2>
        <QuickSearchForm />
      </section>

      <section style={{ marginTop: 40 }}>
        <div style={sectionHeaderRow}>
          <h2 style={sectionTitle}>Highlighted offers</h2>
          <Link to="/search" style={smallLink}>See all flights</Link>
        </div>
        <HighlightedOffers limit={6} />
      </section>
    </div>
  )
}

const pageWrap: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '24px 24px 60px'
}

const heroHeader: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'stretch',
  gap: 24
}

const titleStyle: React.CSSProperties = {
  fontSize: 44,
  lineHeight: 1.05,
  margin: 0,
  background: 'linear-gradient(90deg,#1d3557,#457b9d)',
  WebkitBackgroundClip: 'text',
  color: 'transparent'
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: '14px 0 0',
  color: '#475569'
}

const primaryLink: React.CSSProperties = {
  display: 'inline-block',
  background: '#1d3557',
  color: 'white',
  textDecoration: 'none',
  padding: '10px 18px',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14
}

const sectionTitle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 24,
  lineHeight: 1.2
}

const sectionHeaderRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap'
}

const smallLink: React.CSSProperties = {
  fontSize: 13,
  textDecoration: 'none',
  color: '#1d3557'
}
