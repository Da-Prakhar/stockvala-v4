import React, { useState, useEffect } from 'react'
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react'
import Card from '../ui/Card'
import { useCompanyStore } from '../../store/companyStore'

const MarketNews = () => {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { companyName } = useCompanyStore()

  const fallbackNews = [
    { title: 'Markets are open — check your positions', source: companyName || 'Company', time: 'Now', url: null },
  ]

  const fetchNews = async () => {
    setLoading(true)
    setError(false)
    try {
      // Try multiple free news APIs
      let articles = []

      // 1. Try Forex Factory / finnhub style
      try {
        const res = await fetch('https://finnhub.io/api/v1/news?category=forex&token=demo')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            articles = data.slice(0, 8).map((a) => ({
              title: a.headline || a.title || '',
              source: a.source || 'Market',
              time: a.datetime ? new Date(a.datetime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
              url: a.url || null,
              image: a.image || null,
            }))
          }
        }
      } catch (_) {}

      // 2. Fallback: try newsdata or gnews
      if (articles.length === 0) {
        try {
          const res = await fetch('https://gnews.io/api/v4/search?q=forex+trading+market&lang=en&max=8&apikey=demo')
          if (res.ok) {
            const data = await res.json()
            if (data.articles && data.articles.length > 0) {
              articles = data.articles.slice(0, 8).map((a) => ({
                title: a.title || '',
                source: a.source?.name || 'News',
                time: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
                url: a.url || null,
                image: a.image || null,
              }))
            }
          }
        } catch (_) {}
      }

      if (articles.length > 0) {
        setNews(articles)
      } else {
        setNews(fallbackNews)
        setError(true)
      }
    } catch (_) {
      setNews(fallbackNews)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(interval)
  }, [])

  return (
    <Card variant="elevated">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary-500" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Market News</h3>
          </div>
          <button
            onClick={fetchNews}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Refresh news"
          >
            <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {loading && news.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            ))
          ) : (
            news.map((item, idx) => (
              <a
                key={idx}
                href={item.url || '#'}
                target={item.url ? '_blank' : undefined}
                rel="noopener noreferrer"
                className={`block p-3 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${item.url ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 leading-snug">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-primary-500 font-medium">{item.source}</span>
                      {item.time && <span className="text-xs text-slate-400">{item.time}</span>}
                    </div>
                  </div>
                  {item.url && (
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  )}
                </div>
              </a>
            ))
          )}

          {error && !loading && (
            <p className="text-xs text-slate-400 text-center pt-2">
              Unable to load live news. Check back later.
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

export default MarketNews
