import { useEffect, useState } from 'react'
import api from '../lib/api'

export default function Search() {
  const [health, setHealth] = useState<string>('checking...')
  useEffect(() => {
    api.get('/health/')
      .then(r => setHealth(r.data.status))
      .catch(() => setHealth('unavailable'))
  }, [])

  return (
    <div>
      <h2>Search Flights</h2>
      <p>API health: {health}</p>
      {/* TODO: search form: origin, destination, date, passengers */}
    </div>
  )
}
