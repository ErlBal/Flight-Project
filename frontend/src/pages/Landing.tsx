import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div>
      <h1>FlightProject</h1>
      <p>Search, view, and buy flight tickets.</p>
      <div style={{ marginTop: 16 }}>
        <Link to="/search">Start searching flights →</Link>
      </div>
      <section style={{ marginTop: 24 }}>
        <h3>Highlighted offers</h3>
        <ul>
          <li>Almaty → Astana from $39</li>
          <li>Almaty → Dubai from $129</li>
        </ul>
      </section>
    </div>
  )
}
