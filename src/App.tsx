import { useState, useEffect, useRef } from 'react'

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
  suggested_entry: number
  suggested_stop: number
  suggested_target: number
  risk_reward_ratio: number
  max_position_pct: number
  max_risk_pct: number
  primary_catalyst: string
  supporting_factors: string[]
  risk_factors: string[]
  recent_headlines: string[]
  scan_type: string
  scan_timestamp: string
  technical_details?: TechnicalDetails
  fundamental_details?: FundamentalDetails
  news_details?: NewsDetails
}

interface TechnicalDetails {
  trend_score: number
  squeeze_score: number
  momentum_score: number
  rsi?: number
  macd?: number
  macd_signal?: number
  bollinger_width?: number
  support_levels: number[]
  resistance_levels: number[]
  is_in_squeeze: boolean
  squeeze_firing: boolean
  squeeze_direction?: string
  ma_alignment?: string
  direction_bias: string
}

interface FundamentalDetails {
  short_float_pct?: number
  short_ratio?: number
  shares_float_millions?: number
  sector_perf_1m?: number
  has_upcoming_earnings: boolean
  high_squeeze_potential: boolean
  is_heavily_shorted: boolean
  short_squeeze_score: number
  float_score: number
  earnings_score: number
  direction_bias: string
}

interface NewsDetails {
  sentiment_breakdown: { positive: number; negative: number; neutral: number }
  news_velocity: number
  news_count: number
  all_headlines: string[]
  catalysts: string[]
  raw_score: number
}

interface ScanLog {
  sequence: string
  timestamp: string
  level: string
  message: string
  ticker: string
  data: Record<string, unknown>
}

interface ScanProgress {
  total: number
  analyzed: number
  status: string
  start_time: string
}

function App() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'watchlist' | 'analyze' | 'logs'>('leaderboard')
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [newTickers, setNewTickers] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Drill-down modal state
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Single stock analysis state
  const [analyzeSymbol, setAnalyzeSymbol] = useState('')
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<Opportunity | null>(null)

  // Scan logs state
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([])
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [scanActive, setScanActive] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch watchlist
  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`${API_BASE}/manage_watchlist?code=${API_KEY}`)
      const data = await res.json()
      setWatchlist(data.watchlist || [])
    } catch {
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
    } catch {
      setError('Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }

  // Fetch opportunity details for drill-down
  const fetchOpportunityDetail = async (ticker: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`${API_BASE}/get_opportunity_detail?ticker=${ticker}&code=${API_KEY}`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      // Map the detailed response back to our Opportunity structure
      const detailed: Opportunity = {
        ticker: data.ticker,
        company_name: data.company_name,
        news_score: data.scores?.news || 0,
        fundamental_score: data.scores?.fundamental || 0,
        technical_score: data.scores?.technical || 0,
        composite_score: data.scores?.composite || 0,
        tier: data.tier,
        direction: data.direction,
        current_price: data.trade_setup?.current_price || 0,
        suggested_entry: data.trade_setup?.entry || 0,
        suggested_stop: data.trade_setup?.stop || 0,
        suggested_target: data.trade_setup?.target || 0,
        risk_reward_ratio: data.trade_setup?.risk_reward_ratio || 0,
        max_position_pct: data.trade_setup?.max_position_pct || 0,
        max_risk_pct: data.trade_setup?.max_risk_pct || 0,
        primary_catalyst: data.catalysts?.primary || '',
        supporting_factors: data.catalysts?.supporting_factors || [],
        risk_factors: data.catalysts?.risk_factors || [],
        recent_headlines: data.recent_headlines || [],
        scan_type: data.scan_type || '',
        scan_timestamp: data.scan_timestamp || '',
        technical_details: data.technical_details,
        fundamental_details: data.fundamental_details,
        news_details: data.news_details,
      }
      setSelectedOpp(detailed)
    } catch {
      setError('Failed to load opportunity details')
    } finally {
      setDetailLoading(false)
    }
  }

  // Analyze single stock on-demand
  const analyzeStock = async () => {
    const symbol = analyzeSymbol.trim().toUpperCase()
    if (!symbol || !/^[A-Z]{1,5}$/.test(symbol)) {
      setError('Please enter a valid ticker symbol (1-5 letters)')
      return
    }

    setAnalyzeLoading(true)
    setAnalyzeResult(null)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/analyze_ticker?symbol=${symbol}&code=${API_KEY}`)
      const data = await res.json()

      if (data.error) {
        setError(`Analysis failed: ${data.error}`)
        return
      }

      // Map the response to our Opportunity structure
      const result: Opportunity = {
        ticker: data.ticker || symbol,
        company_name: data.company_name || '',
        news_score: data.news_score || 0,
        fundamental_score: data.fundamental_score || 0,
        technical_score: data.technical_score || 0,
        composite_score: data.composite_score || 0,
        tier: data.tier || 'N/A',
        direction: data.direction || 'NEUTRAL',
        current_price: data.current_price || 0,
        suggested_entry: data.suggested_entry || 0,
        suggested_stop: data.suggested_stop || 0,
        suggested_target: data.suggested_target || 0,
        risk_reward_ratio: data.risk_reward_ratio || 0,
        max_position_pct: data.max_position_pct || 0,
        max_risk_pct: data.max_risk_pct || 0,
        primary_catalyst: data.primary_catalyst || '',
        supporting_factors: data.supporting_factors || [],
        risk_factors: data.risk_factors || [],
        recent_headlines: data.recent_headlines || [],
        scan_type: 'on_demand',
        scan_timestamp: new Date().toISOString(),
        technical_details: data.technical_details,
        fundamental_details: data.fundamental_details,
        news_details: data.news_details,
      }

      setAnalyzeResult(result)
      setSuccess(`Successfully analyzed ${symbol}`)
      setTimeout(() => setSuccess(null), 3000)

      // Refresh leaderboard to show new result
      fetchOpportunities()
    } catch (err) {
      setError(`Failed to analyze ${symbol}: ${err}`)
    } finally {
      setAnalyzeLoading(false)
    }
  }

  // Fetch scan logs
  const fetchScanLogs = async (afterSequence?: string) => {
    try {
      let url = `${API_BASE}/get_scan_logs?active=true&code=${API_KEY}`
      if (afterSequence) {
        url += `&after=${afterSequence}`
      }
      const res = await fetch(url)
      const data = await res.json()

      if (data.active && data.logs) {
        setScanActive(true)
        setScanProgress(data.progress || null)

        if (afterSequence) {
          // Append new logs
          setScanLogs(prev => [...prev, ...data.logs])
        } else {
          // Initial load
          setScanLogs(data.logs || [])
        }

        return data.last_sequence
      } else {
        setScanActive(false)
        setScanProgress(null)
        return null
      }
    } catch {
      return null
    }
  }

  // Start polling for logs
  const startLogPolling = () => {
    let lastSequence: string | null = null

    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    // Initial fetch
    fetchScanLogs().then(seq => {
      lastSequence = seq
    })

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      const newSeq = await fetchScanLogs(lastSequence || undefined)
      if (newSeq) {
        lastSequence = newSeq
      } else {
        // Scan completed, stop polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        // Refresh opportunities after scan completes
        setTimeout(fetchOpportunities, 2000)
      }
    }, 2000)
  }

  // Stop polling
  const stopLogPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  useEffect(() => {
    fetchWatchlist()
    fetchOpportunities()

    return () => stopLogPolling()
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [scanLogs, autoScroll])

  // Add tickers (bulk support)
  const handleAddTickers = async () => {
    // Parse input: support comma, space, newline, semicolon separators
    const tickers = newTickers
      .split(/[,\s;]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t && /^[A-Z]{1,5}$/.test(t))

    if (tickers.length === 0) {
      setError('No valid tickers found')
      return
    }

    // Filter out duplicates already in watchlist
    const newOnes = tickers.filter(t => !watchlist.includes(t))
    const dupes = tickers.filter(t => watchlist.includes(t))

    if (newOnes.length === 0) {
      setError(`All tickers already in watchlist: ${dupes.join(', ')}`)
      return
    }

    try {
      const res = await fetch(`${API_BASE}/manage_watchlist?code=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: newOnes })
      })
      const data = await res.json()
      setWatchlist(data.watchlist || [])
      setNewTickers('')

      let msg = `Added ${newOnes.length} ticker${newOnes.length > 1 ? 's' : ''}: ${newOnes.join(', ')}`
      if (dupes.length > 0) {
        msg += ` (${dupes.length} already existed)`
      }
      setSuccess(msg)
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('Failed to add tickers')
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
    setSuccess('Scan triggered! Switching to logs...')
    setScanLogs([])
    setActiveTab('logs')

    try {
      await fetch(`https://stockraven-func.azurewebsites.net/admin/functions/premarket_scan`, {
        method: 'POST',
        headers: { 'x-functions-key': API_KEY, 'Content-Type': 'application/json' },
        body: '{}'
      })

      // Start polling for logs after a short delay
      setTimeout(startLogPolling, 1000)
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

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'success': return 'text-green-400'
      case 'error': return 'text-red-400'
      case 'warning': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'success': return '[OK]'
      case 'error': return '[ERR]'
      case 'warning': return '[WARN]'
      default: return '[INFO]'
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
            <button onClick={() => setError(null)} className="float-right">x</button>
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
            onClick={() => setActiveTab('analyze')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'analyze' ? 'bg-green-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            Analyze Stock
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'watchlist' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            Watchlist ({watchlist.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('logs')
              if (!scanActive && scanLogs.length === 0) {
                fetchScanLogs()
              }
            }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'logs' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            Scan Logs {scanActive && <span className="ml-1 animate-pulse">*</span>}
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
                      <tr
                        key={opp.ticker}
                        className="hover:bg-gray-700/30 cursor-pointer"
                        onClick={() => fetchOpportunityDetail(opp.ticker)}
                      >
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

        {/* Analyze Stock Tab */}
        {activeTab === 'analyze' && (
          <div className="space-y-6">
            {/* Input Section */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h3 className="font-semibold mb-4">Quick Stock Analysis</h3>
              <p className="text-gray-400 text-sm mb-4">
                Enter any stock symbol to get instant analysis with news sentiment, technical indicators, and trade setup.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={analyzeSymbol}
                  onChange={(e) => setAnalyzeSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      analyzeStock()
                    }
                  }}
                  placeholder="Enter ticker (e.g., AAPL)"
                  maxLength={5}
                  className="flex-1 bg-gray-700 px-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:border-green-500 text-lg font-mono uppercase"
                />
                <button
                  onClick={analyzeStock}
                  disabled={analyzeLoading || !analyzeSymbol.trim()}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {analyzeLoading ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>
            </div>

            {/* Loading State */}
            {analyzeLoading && (
              <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent mb-4"></div>
                <p className="text-gray-400">Analyzing {analyzeSymbol}...</p>
                <p className="text-gray-500 text-sm mt-2">Fetching news, technicals, and fundamentals</p>
              </div>
            )}

            {/* Results */}
            {analyzeResult && !analyzeLoading && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-gray-700 bg-gray-900/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold">{analyzeResult.ticker} - {analyzeResult.company_name}</h2>
                      <p className="text-gray-400 mt-1">
                        Composite: <span className={getScoreColor(analyzeResult.composite_score)}>
                          {analyzeResult.composite_score > 0 ? '+' : ''}{analyzeResult.composite_score.toFixed(1)}
                        </span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${getTierColor(analyzeResult.tier)}`}>
                          Tier {analyzeResult.tier}
                        </span>
                        <span className="ml-2">| Direction: <strong>{analyzeResult.direction}</strong></span>
                        <span className="ml-2">| Price: <strong>${analyzeResult.current_price?.toFixed(2)}</strong></span>
                      </p>
                    </div>
                    <button
                      onClick={() => setAnalyzeResult(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-6">
                  {/* Score Boxes */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'News', score: analyzeResult.news_score },
                      { label: 'Technical', score: analyzeResult.technical_score },
                      { label: 'Fundamental', score: analyzeResult.fundamental_score },
                    ].map(({ label, score }) => (
                      <div key={label} className="bg-gray-700 rounded-lg p-4 text-center">
                        <div className="text-xs text-gray-400 uppercase">{label}</div>
                        <div className={`text-3xl font-bold mt-1 ${getScoreColor(score)}`}>
                          {score > 0 ? '+' : ''}{score.toFixed(0)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Technical Breakdown */}
                  {analyzeResult.technical_details && (
                    <div>
                      <h3 className="text-sm text-gray-400 uppercase mb-2">Technical Breakdown</h3>
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <span className="text-gray-400 text-sm">Trend:</span>
                            <span className={`ml-2 ${getScoreColor(analyzeResult.technical_details.trend_score)}`}>
                              {analyzeResult.technical_details.trend_score > 0 ? '+' : ''}{analyzeResult.technical_details.trend_score}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 text-sm">Squeeze:</span>
                            <span className={`ml-2 ${getScoreColor(analyzeResult.technical_details.squeeze_score)}`}>
                              {analyzeResult.technical_details.squeeze_score > 0 ? '+' : ''}{analyzeResult.technical_details.squeeze_score}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 text-sm">Momentum:</span>
                            <span className={`ml-2 ${getScoreColor(analyzeResult.technical_details.momentum_score)}`}>
                              {analyzeResult.technical_details.momentum_score > 0 ? '+' : ''}{analyzeResult.technical_details.momentum_score}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-300">
                          {analyzeResult.technical_details.rsi && <span className="mr-4">RSI: {analyzeResult.technical_details.rsi.toFixed(0)}</span>}
                          {analyzeResult.technical_details.macd && <span className="mr-4">MACD: {analyzeResult.technical_details.macd.toFixed(2)}</span>}
                          {analyzeResult.technical_details.ma_alignment && <span>MA: {analyzeResult.technical_details.ma_alignment}</span>}
                        </div>
                        {analyzeResult.technical_details.squeeze_firing && (
                          <div className="mt-2 text-green-400 text-sm">
                            Squeeze firing {analyzeResult.technical_details.squeeze_direction}
                          </div>
                        )}
                        {analyzeResult.technical_details.is_in_squeeze && !analyzeResult.technical_details.squeeze_firing && (
                          <div className="mt-2 text-yellow-400 text-sm">In TTM Squeeze - watching for breakout</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fundamental Breakdown */}
                  {analyzeResult.fundamental_details && (
                    <div>
                      <h3 className="text-sm text-gray-400 uppercase mb-2">Fundamental Breakdown</h3>
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <div className="text-sm text-gray-300 space-y-1">
                          {analyzeResult.fundamental_details.short_float_pct && (
                            <div>Short Float: <strong>{analyzeResult.fundamental_details.short_float_pct.toFixed(1)}%</strong></div>
                          )}
                          {analyzeResult.fundamental_details.short_ratio && (
                            <div>Days to Cover: <strong>{analyzeResult.fundamental_details.short_ratio.toFixed(1)}</strong></div>
                          )}
                          {analyzeResult.fundamental_details.shares_float_millions && (
                            <div>Float: <strong>{analyzeResult.fundamental_details.shares_float_millions.toFixed(0)}M shares</strong></div>
                          )}
                          <div>
                            Squeeze Potential: <strong className={analyzeResult.fundamental_details.high_squeeze_potential ? 'text-green-400' : 'text-gray-400'}>
                              {analyzeResult.fundamental_details.high_squeeze_potential ? 'HIGH' : 'LOW'}
                            </strong>
                          </div>
                        </div>
                        {analyzeResult.fundamental_details.has_upcoming_earnings && (
                          <div className="mt-2 text-yellow-400 text-sm">Earnings event approaching</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* News Analysis */}
                  {analyzeResult.news_details && (
                    <div>
                      <h3 className="text-sm text-gray-400 uppercase mb-2">
                        News Analysis ({analyzeResult.news_details.news_count} articles, {analyzeResult.news_details.news_velocity.toFixed(1)}/hr)
                      </h3>
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <div className="text-sm mb-3">
                          <span className="text-green-400">{analyzeResult.news_details.sentiment_breakdown?.positive || 0} Bullish</span>
                          <span className="mx-2 text-gray-500">|</span>
                          <span className="text-gray-400">{analyzeResult.news_details.sentiment_breakdown?.neutral || 0} Neutral</span>
                          <span className="mx-2 text-gray-500">|</span>
                          <span className="text-red-400">{analyzeResult.news_details.sentiment_breakdown?.negative || 0} Bearish</span>
                        </div>
                        {analyzeResult.news_details.all_headlines?.length > 0 && (
                          <ul className="text-sm text-gray-300 space-y-1">
                            {analyzeResult.news_details.all_headlines.slice(0, 5).map((headline, i) => (
                              <li key={i} className="flex items-start">
                                <span className="text-gray-500 mr-2">-</span>
                                {headline}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Trade Setup */}
                  <div>
                    <h3 className="text-sm text-gray-400 uppercase mb-2">Trade Setup</h3>
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                        <div>
                          <div className="text-xs text-gray-400">Entry</div>
                          <div className="font-bold text-lg">${analyzeResult.suggested_entry?.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Stop</div>
                          <div className="font-bold text-lg">${analyzeResult.suggested_stop?.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Target</div>
                          <div className="font-bold text-lg">${analyzeResult.suggested_target?.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">R:R</div>
                          <div className="font-bold text-lg">1:{analyzeResult.risk_reward_ratio?.toFixed(1)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Position</div>
                          <div className="font-bold text-lg">{((analyzeResult.max_position_pct || 0) * 100).toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Risk</div>
                          <div className="font-bold text-lg">{((analyzeResult.max_risk_pct || 0) * 100).toFixed(2)}%</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Catalyst & Risks */}
                  <div className="border-t border-gray-700 pt-4">
                    <div className="text-green-400">
                      <strong>Catalyst:</strong> {analyzeResult.primary_catalyst || 'No specific catalyst identified'}
                    </div>
                    {analyzeResult.supporting_factors?.length > 0 && (
                      <div className="text-gray-400 text-sm mt-1">
                        <strong>Supporting:</strong> {analyzeResult.supporting_factors.join(', ')}
                      </div>
                    )}
                    {analyzeResult.risk_factors?.length > 0 && (
                      <div className="text-yellow-400 text-sm mt-1">
                        <strong>Risks:</strong> {analyzeResult.risk_factors.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            {!analyzeResult && !analyzeLoading && (
              <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-5">
                <h4 className="text-green-400 font-medium mb-2">Quick Analysis</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>- Analyzes any stock symbol in real-time</li>
                  <li>- Gets latest news sentiment via AI</li>
                  <li>- Calculates technical indicators (RSI, MACD, squeeze)</li>
                  <li>- Provides entry/stop/target trade setup</li>
                  <li>- Results are saved to the leaderboard</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Watchlist Tab */}
        {activeTab === 'watchlist' && (
          <div className="space-y-6">
            {/* Add Tickers (Bulk) */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h3 className="font-semibold mb-4">Add Stocks to Watchlist</h3>
              <div className="flex gap-3">
                <textarea
                  value={newTickers}
                  onChange={(e) => setNewTickers(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddTickers()
                    }
                  }}
                  placeholder="Enter tickers (e.g., AAPL, MSFT, NVDA or paste multiple)"
                  rows={2}
                  className="flex-1 bg-gray-700 px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                />
                <button
                  onClick={handleAddTickers}
                  disabled={!newTickers.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed self-start"
                >
                  Add
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-2">
                Separate multiple tickers with commas, spaces, or newlines. Example: AAPL, MSFT, NVDA
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
                        x
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
                <li>- <strong>Premarket:</strong> 6:15 AM PST - analyzes overnight news</li>
                <li>- <strong>Market Hours:</strong> Every 10 min (9:30 AM - 4:00 PM ET)</li>
                <li>- <strong>Evening:</strong> 6:00 PM ET - daily summary</li>
              </ul>
            </div>
          </div>
        )}

        {/* Scan Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold">Scan Logs</h2>
                {scanActive && scanProgress && (
                  <span className="text-sm text-gray-400">
                    Progress: {scanProgress.analyzed} of {scanProgress.total} tickers
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded"
                  />
                  Auto-scroll
                </label>
                <button
                  onClick={() => setScanLogs([])}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Progress bar */}
            {scanActive && scanProgress && scanProgress.total > 0 && (
              <div className="px-4 py-2 bg-gray-900/50">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${(scanProgress.analyzed / scanProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Logs */}
            <div className="h-96 overflow-y-auto font-mono text-sm p-4 bg-gray-900">
              {scanLogs.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  {scanActive ? 'Waiting for logs...' : 'No scan logs. Click "Run Scan Now" to start.'}
                </div>
              ) : (
                scanLogs.map((log, idx) => (
                  <div key={idx} className="py-1 flex">
                    <span className="text-gray-600 w-20 flex-shrink-0">
                      {log.timestamp?.substring(11, 19) || ''}
                    </span>
                    <span className={`w-14 flex-shrink-0 ${getLogLevelColor(log.level)}`}>
                      {getLogLevelIcon(log.level)}
                    </span>
                    <span className="text-gray-300">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

            {scanActive && (
              <div className="p-3 bg-gray-900/50 border-t border-gray-700 text-center text-sm text-gray-400">
                <span className="inline-block animate-pulse mr-2">*</span>
                Scan in progress...
              </div>
            )}
          </div>
        )}

        {/* Drill-Down Modal */}
        {(selectedOpp || detailLoading) && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => !detailLoading && setSelectedOpp(null)}
          >
            <div
              className="bg-gray-800 rounded-xl border border-gray-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {detailLoading ? (
                <div className="p-12 text-center text-gray-400">Loading details...</div>
              ) : selectedOpp && (
                <>
                  {/* Header */}
                  <div className="p-5 border-b border-gray-700 flex justify-between items-start bg-gray-900/50">
                    <div>
                      <h2 className="text-2xl font-bold">{selectedOpp.ticker} - {selectedOpp.company_name}</h2>
                      <p className="text-gray-400 mt-1">
                        Composite: <span className={getScoreColor(selectedOpp.composite_score)}>
                          {selectedOpp.composite_score > 0 ? '+' : ''}{selectedOpp.composite_score.toFixed(1)}
                        </span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${getTierColor(selectedOpp.tier)}`}>
                          Tier {selectedOpp.tier}
                        </span>
                        <span className="ml-2">| Direction: <strong>{selectedOpp.direction}</strong></span>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedOpp(null)}
                      className="text-gray-400 hover:text-white text-2xl leading-none"
                    >
                      x
                    </button>
                  </div>

                  <div className="p-5 space-y-6">
                    {/* Score Boxes */}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'News', score: selectedOpp.news_score },
                        { label: 'Technical', score: selectedOpp.technical_score },
                        { label: 'Fundamental', score: selectedOpp.fundamental_score },
                      ].map(({ label, score }) => (
                        <div key={label} className="bg-gray-700 rounded-lg p-4 text-center">
                          <div className="text-xs text-gray-400 uppercase">{label}</div>
                          <div className={`text-2xl font-bold mt-1 ${getScoreColor(score)}`}>
                            {score > 0 ? '+' : ''}{score.toFixed(0)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Technical Breakdown */}
                    {selectedOpp.technical_details && (
                      <div>
                        <h3 className="text-sm text-gray-400 uppercase mb-2">Technical Breakdown</h3>
                        <div className="bg-gray-700/50 rounded-lg p-4">
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <span className="text-gray-400 text-sm">Trend:</span>
                              <span className={`ml-2 ${getScoreColor(selectedOpp.technical_details.trend_score)}`}>
                                {selectedOpp.technical_details.trend_score > 0 ? '+' : ''}{selectedOpp.technical_details.trend_score}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-sm">Squeeze:</span>
                              <span className={`ml-2 ${getScoreColor(selectedOpp.technical_details.squeeze_score)}`}>
                                {selectedOpp.technical_details.squeeze_score > 0 ? '+' : ''}{selectedOpp.technical_details.squeeze_score}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 text-sm">Momentum:</span>
                              <span className={`ml-2 ${getScoreColor(selectedOpp.technical_details.momentum_score)}`}>
                                {selectedOpp.technical_details.momentum_score > 0 ? '+' : ''}{selectedOpp.technical_details.momentum_score}
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-300">
                            {selectedOpp.technical_details.rsi && <span className="mr-4">RSI: {selectedOpp.technical_details.rsi.toFixed(0)}</span>}
                            {selectedOpp.technical_details.macd && <span className="mr-4">MACD: {selectedOpp.technical_details.macd.toFixed(2)}</span>}
                            {selectedOpp.technical_details.ma_alignment && <span>MA: {selectedOpp.technical_details.ma_alignment}</span>}
                          </div>
                          {selectedOpp.technical_details.squeeze_firing && (
                            <div className="mt-2 text-green-400 text-sm">
                              Squeeze firing {selectedOpp.technical_details.squeeze_direction}
                            </div>
                          )}
                          {selectedOpp.technical_details.is_in_squeeze && !selectedOpp.technical_details.squeeze_firing && (
                            <div className="mt-2 text-yellow-400 text-sm">In TTM Squeeze - watching for breakout</div>
                          )}
                          {(selectedOpp.technical_details.support_levels?.length > 0 || selectedOpp.technical_details.resistance_levels?.length > 0) && (
                            <div className="mt-2 text-sm text-gray-400">
                              {selectedOpp.technical_details.support_levels?.length > 0 && (
                                <span className="mr-4">Support: ${selectedOpp.technical_details.support_levels.slice(0, 2).map(s => s.toFixed(2)).join(', $')}</span>
                              )}
                              {selectedOpp.technical_details.resistance_levels?.length > 0 && (
                                <span>Resistance: ${selectedOpp.technical_details.resistance_levels.slice(0, 2).map(r => r.toFixed(2)).join(', $')}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Fundamental Breakdown */}
                    {selectedOpp.fundamental_details && (
                      <div>
                        <h3 className="text-sm text-gray-400 uppercase mb-2">Fundamental Breakdown</h3>
                        <div className="bg-gray-700/50 rounded-lg p-4">
                          <div className="text-sm text-gray-300 space-y-1">
                            {selectedOpp.fundamental_details.short_float_pct && (
                              <div>Short Float: <strong>{selectedOpp.fundamental_details.short_float_pct.toFixed(1)}%</strong></div>
                            )}
                            {selectedOpp.fundamental_details.short_ratio && (
                              <div>Days to Cover: <strong>{selectedOpp.fundamental_details.short_ratio.toFixed(1)}</strong></div>
                            )}
                            {selectedOpp.fundamental_details.shares_float_millions && (
                              <div>Float: <strong>{selectedOpp.fundamental_details.shares_float_millions.toFixed(0)}M shares</strong></div>
                            )}
                            <div>
                              Squeeze Potential: <strong className={selectedOpp.fundamental_details.high_squeeze_potential ? 'text-green-400' : 'text-gray-400'}>
                                {selectedOpp.fundamental_details.high_squeeze_potential ? 'HIGH' : 'LOW'}
                              </strong>
                            </div>
                          </div>
                          {selectedOpp.fundamental_details.has_upcoming_earnings && (
                            <div className="mt-2 text-yellow-400 text-sm">Earnings event approaching</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* News Analysis */}
                    {selectedOpp.news_details && (
                      <div>
                        <h3 className="text-sm text-gray-400 uppercase mb-2">
                          News Analysis ({selectedOpp.news_details.news_count} articles, {selectedOpp.news_details.news_velocity.toFixed(1)}/hr)
                        </h3>
                        <div className="bg-gray-700/50 rounded-lg p-4">
                          <div className="text-sm mb-3">
                            <span className="text-green-400">{selectedOpp.news_details.sentiment_breakdown?.positive || 0} Bullish</span>
                            <span className="mx-2 text-gray-500">|</span>
                            <span className="text-gray-400">{selectedOpp.news_details.sentiment_breakdown?.neutral || 0} Neutral</span>
                            <span className="mx-2 text-gray-500">|</span>
                            <span className="text-red-400">{selectedOpp.news_details.sentiment_breakdown?.negative || 0} Bearish</span>
                          </div>
                          {selectedOpp.news_details.all_headlines?.length > 0 && (
                            <ul className="text-sm text-gray-300 space-y-1">
                              {selectedOpp.news_details.all_headlines.slice(0, 5).map((headline, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="text-gray-500 mr-2">-</span>
                                  {headline}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Trade Setup */}
                    <div>
                      <h3 className="text-sm text-gray-400 uppercase mb-2">Trade Setup</h3>
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                          <div>
                            <div className="text-xs text-gray-400">Entry</div>
                            <div className="font-bold">${selectedOpp.suggested_entry?.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Stop</div>
                            <div className="font-bold">${selectedOpp.suggested_stop?.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Target</div>
                            <div className="font-bold">${selectedOpp.suggested_target?.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">R:R</div>
                            <div className="font-bold">1:{selectedOpp.risk_reward_ratio?.toFixed(1)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Position</div>
                            <div className="font-bold">{((selectedOpp.max_position_pct || 0) * 100).toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Risk</div>
                            <div className="font-bold">{((selectedOpp.max_risk_pct || 0) * 100).toFixed(2)}%</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Catalyst & Risks */}
                    <div className="border-t border-gray-700 pt-4">
                      <div className="text-green-400">
                        <strong>Catalyst:</strong> {selectedOpp.primary_catalyst}
                      </div>
                      {selectedOpp.supporting_factors?.length > 0 && (
                        <div className="text-gray-400 text-sm mt-1">
                          <strong>Supporting:</strong> {selectedOpp.supporting_factors.join(', ')}
                        </div>
                      )}
                      {selectedOpp.risk_factors?.length > 0 && (
                        <div className="text-yellow-400 text-sm mt-1">
                          <strong>Risks:</strong> {selectedOpp.risk_factors.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
