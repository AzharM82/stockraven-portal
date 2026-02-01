import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://stockraven-func.azurewebsites.net/api'
const API_KEY = import.meta.env.VITE_API_KEY || ''

interface Opportunity {
  ticker: string
  company_name: string
  news_score: number
  fundamental_score: number
  technical_score: number
  composite_score: number
  tier: string
  direction: string
  current_price: number
  primary_catalyst: string
  recent_headlines: string[]
  scan_type: string
  scan_timestamp: string
}

function App() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'watchlist'>('leaderboard')
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [newTicker, setNewTicker] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch watchlist
  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`${API_BASE}/manage_watchlist?code=${API_KEY}`)
      const data = await res.json()
      setWatchlist(data.watchlist || [])
    } catch (e) {
      setError('Failed to load watchlist')
    }
  }

  // Fetch opportunities
  const fetchOpportunities = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/get_opportunities?hours_back=24&code=${API_KEY}`)
      const data = await res.json()
      setOpportunities(data.opportunities || [])
    } catch (e) {
      setError('Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWatchlist()
    fetchOpportunities()
  }, [])

  // Add ticker
  const handleAddTicker = async () => {
    const ticker = newTicker.toUpperCase().trim()
    if (!ticker) return
    if (watchlist.includes(ticker)) {
      setError(`${ticker} already in watchlist`)
      return
    }

    try {
      const res = await fetch(`${API_BASE}/manage_watchlist?code=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker })
      })
      const data = await res.json()
      setWatchlist(data.watchlist || [])
      setNewTicker('')
      setSuccess(`Added ${ticker}`)
      setTimeout(() => setSuccess(null), 2000)
    } catch {
      setError('Failed to add ticker')
    }
  }

  // Remove ticker
  const handleRemoveTicker = async (ticker: string) => {
    try {
      const res = await fetch(`${API_BASE}/manage_watchlist?ticker=${ticker}&code=${API_KEY}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      setWatchlist(data.watchlist || [])
      setSuccess(`Removed ${ticker}`)
      setTimeout(() => setSuccess(null), 2000)
    } catch {
      setError('Failed to remove ticker')
    }
  }

  // Trigger scan
  const handleTriggerScan = async () => {
    setSuccess('Scan triggered! Results will appear shortly.')
    try {
      await fetch(`https://stockraven-func.azurewebsites.net/admin/functions/premarket_scan`, {
        method: 'POST',
        headers: { 'x-functions-key': API_KEY, 'Content-Type': 'application/json' },
        body: '{}'
      })
      setTimeout(() => {
        fetchOpportunities()
        setSuccess(null)
      }, 120000) // Refresh after 2 minutes
    } catch {
      setError('Failed to trigger scan')
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 30) return 'text-green-400'
    if (score >= 10) return 'text-yellow-400'
    if (score >= 0) return 'text-gray-400'
    if (score >= -10) return 'text-orange-400'
    return 'text-red-400'
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'A+': return 'bg-green-600'
      case 'A': return 'bg-green-500'
      case 'B': return 'bg-yellow-500'
      case 'C': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">StockRaven</h1>
            <p className="text-gray-400">Stock Opportunity Scanner</p>
          </div>
          <button
            onClick={handleTriggerScan}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
          >
            Run Scan Now
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
            {error}
            <button onClick={() => setError(null)} className="float-right">×</button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'leaderboard' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            Leaderboard ({opportunities.length})
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'watchlist' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            Watchlist ({watchlist.length})
          </button>
        </div>

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Stock Leaderboard</h2>
              <button
                onClick={fetchOpportunities}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading...</div>
            ) : opportunities.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No opportunities found. Run a scan first.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ticker</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Score</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Tier</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Direction</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Catalyst</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Top Headline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {opportunities.map((opp, idx) => (
                      <tr key={opp.ticker} className="hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-bold">{opp.ticker}</td>
                        <td className={`px-4 py-3 text-right font-mono ${getScoreColor(opp.composite_score)}`}>
                          {opp.composite_score > 0 ? '+' : ''}{opp.composite_score.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${getTierColor(opp.tier)}`}>
                            {opp.tier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm ${
                            opp.direction === 'LONG' ? 'text-green-400' :
                            opp.direction === 'SHORT' ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {opp.direction}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">${opp.current_price?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{opp.primary_catalyst}</td>
                        <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                          {opp.recent_headlines?.[0] || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Watchlist Tab */}
        {activeTab === 'watchlist' && (
          <div className="space-y-6">
            {/* Add Ticker */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h3 className="font-semibold mb-4">Add Stock to Watchlist</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTicker()}
                  placeholder="Enter ticker (e.g., AAPL)"
                  className="flex-1 bg-gray-700 px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAddTicker}
                  disabled={!newTicker.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-2">
                Stocks in this list will be scanned during scheduled and manual scans.
              </p>
            </div>

            {/* Current Watchlist */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-semibold">Current Watchlist ({watchlist.length})</h3>
                <button
                  onClick={fetchWatchlist}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Refresh
                </button>
              </div>

              {watchlist.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  No stocks in watchlist. Add some above to start scanning.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4">
                  {watchlist.map((ticker) => (
                    <div
                      key={ticker}
                      className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2"
                    >
                      <span className="font-medium">{ticker}</span>
                      <button
                        onClick={() => handleRemoveTicker(ticker)}
                        className="text-gray-400 hover:text-red-400 ml-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-5">
              <h4 className="text-blue-400 font-medium mb-2">Scan Schedule</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• <strong>Premarket:</strong> 6:15 AM PST - analyzes overnight news</li>
                <li>• <strong>Market Hours:</strong> Every 10 min (9:30 AM - 4:00 PM ET)</li>
                <li>• <strong>Evening:</strong> 6:00 PM ET - daily summary</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
