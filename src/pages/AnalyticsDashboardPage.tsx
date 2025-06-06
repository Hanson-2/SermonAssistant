import React, { useState, useEffect } from 'react';
import { 
  getSermonAnalyticsFunc, 
  fetchSermons,
  getSermonCategoriesFunc,
  getSermonSeriesFunc 
} from '../services/firebaseService';
import { SermonAnalytics, Sermon, SermonCategory, SermonSeries } from '../services/firebaseService';
import { Link } from 'react-router-dom';
import './AnalyticsDashboardPage.css';

const AnalyticsDashboardPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<SermonAnalytics | null>(null);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [categories, setCategories] = useState<SermonCategory[]>([]);
  const [series, setSeries] = useState<SermonSeries[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'month' | 'quarter' | 'year' | 'all'>('year');
  // --- Enhancement: Tag Filter State ---
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');
  // --- Enhancement: Category Filter State ---
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  // --- Enhancement: Series Filter State ---
  const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>('');

  // Add state for expanded book dropdowns
  const [expandedBooks, setExpandedBooks] = useState<string[]>([]);

  // Collapsible analytics cards state
  const [expandedCards, setExpandedCards] = useState<{ [key: string]: boolean }>({
    tags: true,
    books: true,
    categories: true,
    series: true,
  });

  const toggleCard = (key: string) => {
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Collapsible state for analytics cards ---
  const [collapsedCards, setCollapsedCards] = useState({
    tags: false,
    books: false,
    categories: false,
    series: false,
  });

  const toggleCardCollapse = (card: keyof typeof collapsedCards) => {
    setCollapsedCards(prev => ({ ...prev, [card]: !prev[card] }));
  };

  // Fetch sermons, categories, and series ONCE on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [sermonsData, categoriesData, seriesData] = await Promise.all([
          fetchSermons(),
          getSermonCategoriesFunc(),
          getSermonSeriesFunc()
        ]);
        setSermons(sermonsData);
        setCategories(categoriesData);
        setSeries(seriesData);
      } catch (error) {
        console.error('Error loading initial data:', error);
        setError('Failed to load initial data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
    // eslint-disable-next-line
  }, []);

  // Fetch analytics ONLY when timeframe changes
  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const analyticsData = await getSermonAnalyticsFunc(selectedTimeframe);
        setAnalytics(analyticsData);
      } catch (error) {
        console.error('Error loading analytics:', error);
        setError('Failed to load analytics. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    loadAnalytics();
    // eslint-disable-next-line
  }, [selectedTimeframe]);

  // --- Enhancement: Filtered Sermons Helper (with series) ---
  const getFilteredSermons = () => {
    let filtered = Array.isArray(sermons) ? sermons : [];
    if (selectedTagFilter) {
      filtered = filtered.filter(s => Array.isArray(s.tags) && s.tags.includes(selectedTagFilter));
    }
    if (selectedCategoryFilter) {
      filtered = filtered.filter(s => s.category === selectedCategoryFilter);
    }
    if (selectedSeriesFilter) {
      filtered = filtered.filter(s => s.seriesId === selectedSeriesFilter);
    }
    return filtered.filter(s => !!s && typeof s === 'object');
  };

  // Defensive: If getFilteredSermons() is empty, fallback to all sermons for analytics
  const getSafeSermons = () => {
    const filtered = getFilteredSermons();
    return filtered.length > 0 ? filtered : sermons;
  };

  // --- Recent Sermons: Use sermon.date (prefer Timestamp, fallback to string) ---
  const getRecentSermons = (count: number = 5) => {
    return getSafeSermons()
      .filter(s => s && s.date)
      .sort((a, b) => {
        // Firestore Timestamp: { seconds, nanoseconds }
        const aDate = a.date && typeof a.date === 'object' && a.date !== null && 'seconds' in a.date
          ? (a.date as any).seconds
          : (a.date ? new Date(a.date).getTime() / 1000 : 0);
        const bDate = b.date && typeof b.date === 'object' && b.date !== null && 'seconds' in b.date
          ? (b.date as any).seconds
          : (b.date ? new Date(b.date).getTime() / 1000 : 0);
        return bDate - aDate;
      })
      .slice(0, count);
  };

  const getCategoryStats = () => {
    const categoryCount: { [key: string]: number } = {};
    getSafeSermons().forEach(sermon => {
      if (sermon && sermon.category) {
        categoryCount[sermon.category] = (categoryCount[sermon.category] || 0) + 1;
      }
    });
    return Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getSeriesStats = () => {
    const seriesCount: { [key: string]: number } = {};
    getSafeSermons().forEach(sermon => {
      if (sermon.seriesId) {
        const seriesTitle = series.find(s => s.id === sermon.seriesId)?.name || 'Unknown Series';
        seriesCount[seriesTitle] = (seriesCount[seriesTitle] || 0) + 1;
      }
    });
    
    return Object.entries(seriesCount)
      .map(([seriesTitle, count]) => ({ seriesTitle, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getTagStats = () => {
    const tagCount: { [key: string]: number } = {};
    getSafeSermons().forEach(sermon => {
      if (sermon.tags) {
        sermon.tags.forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      }
    });
    
    return Object.entries(tagCount)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 tags
  };

  // --- Most Referenced Books: Extract from notes, count by book and chapter ---
  const getBooksStats = () => {
    const bookCount: { [book: string]: number } = {};
    const chapterCount: { [book: string]: { [chapter: string]: number } } = {};
    const safeSermons = getSafeSermons();
    safeSermons.forEach(sermon => {
      let allNotes = '';
      // Defensive: Combine notes and description for scripture extraction
      if (sermon.notes && typeof sermon.notes === 'object' && !Array.isArray(sermon.notes)) {
        allNotes = Object.values(sermon.notes).join(' ');
      } else if (Array.isArray(sermon.notes)) {
        allNotes = sermon.notes.join(' ');
      } else if (typeof sermon.notes === 'string') {
        allNotes = sermon.notes;
      }
      // Also include description if present
      if (sermon.description && typeof sermon.description === 'string') {
        allNotes += ' ' + sermon.description;
      }
      if (allNotes) {
        const refs = extractScriptureReferences(allNotes);
        refs.forEach(({ book, chapter }) => {
          bookCount[book] = (bookCount[book] || 0) + 1;
          if (!chapterCount[book]) chapterCount[book] = {};
          chapterCount[book][chapter] = (chapterCount[book][chapter] || 0) + 1;
        });
      }
    });
    const booksArray = Object.entries(bookCount)
      .map(([book, count]) => ({ book, count }))
      .sort((a, b) => b.count - a.count);
    return { booksArray, chapterCount };
  };

  // Utility: Extract all references like "BookName Chapter:Verse" from a string, stripping HTML
  function extractScriptureReferences(text: string): { book: string, chapter: string }[] {
    // Remove HTML tags if present
    const plain = text.replace(/<[^>]+>/g, ' ');
    // Regex matches e.g. "Genesis 1:1", "1 John 2:3", "Song of Solomon 3:4", with optional dash/colon/space
    const regex = /([1-3]?\s?[A-Za-z .]+?)\s+(\d+):\d+(?:[-–]\d+)?/g;
    const results: { book: string, chapter: string }[] = [];
    let match;
    while ((match = regex.exec(plain)) !== null) {
      const book = match[1].replace(/\s+/g, ' ').trim();
      const chapter = match[2];
      results.push({ book, chapter });
    }
    return results;
  }

  const getTimeframePeriod = () => {
    const now = new Date();
    switch (selectedTimeframe) {
      case 'month':
        return `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        return `Q${quarter} ${now.getFullYear()}`;
      case 'year':
        return now.getFullYear().toString();
      case 'all':
        return 'All Time';
      default:
        return '';
    }
  };

  // --- Enhancement: Export Analytics to CSV ---
  const exportAnalyticsToCSV = () => {
    const rows = [
      ['Total Sermons', analytics?.totalSermons || sermons.length],
      ['Categories', categories.length],
      ['Series', series.length],
      // Removed Bible Books and Unique Tags
      ['Avg per Month', getAverageSermonsPerMonth()],
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' +
      rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sermon_analytics.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Enhancement: Sermons Over Time Data ---
  const getSermonsPerMonth = () => {
    const months: { [key: string]: number } = {};
    getFilteredSermons().forEach(sermon => {
      if (sermon.dateAdded && typeof sermon.dateAdded === 'object' && 'seconds' in sermon.dateAdded) {
        const d = new Date(sermon.dateAdded.seconds * 1000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = (months[key] || 0) + 1;
      }
    });
    // Sort by date ascending
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  };

  // --- Helper: Calculate Average Sermons Per Month ---
  const getAverageSermonsPerMonth = () => {
    const filtered = getFilteredSermons();
    if (!filtered.length) return '0.0';
    // Find earliest sermon date
    const earliest = filtered.reduce((min, s) => {
      if (s.dateAdded && typeof s.dateAdded === 'object' && 'seconds' in s.dateAdded) {
        const d = s.dateAdded.seconds;
        return min === null || d < min ? d : min;
      }
      return min;
    }, null);
    if (!earliest) return filtered.length.toFixed(1); // fallback
    const earliestDate = new Date(earliest * 1000);
    const now = new Date();
    const months = Math.max(
      (now.getFullYear() - earliestDate.getFullYear()) * 12 + (now.getMonth() - earliestDate.getMonth()) + 1,
      1
    );
    return (filtered.length / months).toFixed(1);
  };

  const handleBookClick = (book: string) => {
    setExpandedBooks(prev => prev.includes(book)
      ? prev.filter(b => b !== book)
      : [...prev, book]);
  };

  if (isLoading) {
    return (
      <div className="analytics-dashboard-page">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard-page">
      {/* Background overlay for theme consistency */}
      <div className="analytics-dashboard-bg" aria-hidden="true" />
      <div className="page-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 
            className="analytics-dashboard-title"
            style={{
              color: '#ffe082', // Brighter gold for maximum contrast
              background: 'rgba(20,20,20,0.82)',
              borderRadius: '16px',
              border: '2.5px solid #ffe082',
              padding: '0.5em 1.5em',
              display: 'inline-block',
              textShadow: '0 2px 8px #000, 0 1px 0 #000', // Strong black shadow for pop
              boxShadow: '0 4px 18px 0 rgba(0,0,0,0.32)',
              fontSize: '2.8rem',
              fontFamily: 'Trajan Pro, Georgia, serif',
              fontWeight: 700,
              letterSpacing: '1.5px',
              marginBottom: '18px',
              position: 'relative',
              zIndex: 99999,
              isolation: 'isolate',
            }}
          >
            Analytics Dashboard
          </h1>
          <p>Insights and statistics about your sermon collection</p>
        </div>
        <button className="btn export-btn" onClick={exportAnalyticsToCSV} title="Export analytics as CSV">
          Export CSV
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="message error">
          {error}
          <button onClick={() => setError(null)} className="close-btn">×</button>
        </div>
      )}

      {/* Timeframe & Filters Grouped (Styled, Theme-Matched) */}
      <div className="analytics-filters-panel">
        <div className="analytics-filters-header">
          <span className="analytics-filters-title">Filters <span className="analytics-filters-dash">—</span></span>
        </div>
        <div className="analytics-filters-row">
          <div className="analytics-filter-group">
            <label htmlFor="tagFilter" className="analytics-filter-label">Tag:</label>
            <select
              id="tagFilter"
              value={selectedTagFilter}
              onChange={e => setSelectedTagFilter(e.target.value)}
              className="analytics-filter-select"
            >
              <option value="">All Tags</option>
              {Array.from(new Set(sermons.flatMap(s => s.tags || []))).sort().map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
          <div className="analytics-filter-group">
            <label htmlFor="categoryFilter" className="analytics-filter-label">Category:</label>
            <select
              id="categoryFilter"
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="analytics-filter-select"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="analytics-filter-group">
            <label htmlFor="seriesFilter" className="analytics-filter-label">Series:</label>
            <select
              id="seriesFilter"
              value={selectedSeriesFilter}
              onChange={e => setSelectedSeriesFilter(e.target.value)}
              className="analytics-filter-select"
            >
              <option value="">All Series</option>
              {series.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="analytics-filter-group timeframe-group">
            <label className="analytics-filter-label">Timeframe:</label>
            <div className="analytics-timeframe-btns">
              <button 
                className={`btn analytics-btn ${selectedTimeframe === 'month' ? 'analytics-btn-primary' : 'analytics-btn-secondary'}`}
                onClick={() => setSelectedTimeframe('month')}
              >
                This Month
              </button>
              <button 
                className={`btn analytics-btn ${selectedTimeframe === 'quarter' ? 'analytics-btn-primary' : 'analytics-btn-secondary'}`}
                onClick={() => setSelectedTimeframe('quarter')}
              >
                This Quarter
              </button>
              <button 
                className={`btn analytics-btn ${selectedTimeframe === 'year' ? 'analytics-btn-primary' : 'analytics-btn-secondary'}`}
                onClick={() => setSelectedTimeframe('year')}
              >
                This Year
              </button>
              <button 
                className={`btn analytics-btn ${selectedTimeframe === 'all' ? 'analytics-btn-primary' : 'analytics-btn-secondary'}`}
                onClick={() => setSelectedTimeframe('all')}
              >
                All Time
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity - moved to top */}
      <div className="recent-activity">
        <h3>Recent Sermons</h3>
        <div className="recent-sermons-grid">
          {getRecentSermons().map((sermon) => (
            <div key={sermon.id} className="recent-sermon-card">
              <div className="sermon-header">
                <Link to={`/expository/${sermon.id}`} className="sermon-title">
                  {sermon.title || 'Untitled'}
                </Link>
                <span className="sermon-date">
                  {sermon.date && typeof sermon.date === 'object' && sermon.date !== null && 'seconds' in sermon.date
                    ? new Date((sermon.date as any).seconds * 1000).toLocaleDateString()
                    : (sermon.date ? new Date(sermon.date).toLocaleDateString() : 'No date')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="stats-overview">
        <div className="stat-card" title="Total number of sermons in your collection.">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3>Total Sermons</h3>
            <span className="stat-number">{analytics?.totalSermons || sermons.length}</span>
          </div>
        </div>

        <div className="stat-card" title="Number of unique categories assigned to your sermons.">
          <div className="stat-icon">🏷️</div>
          <div className="stat-content">
            <h3>Categories</h3>
            <span className="stat-number">{categories.length}</span>
          </div>
        </div>

        <div className="stat-card" title="Number of unique series your sermons belong to.">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <h3>Series</h3>
            <span className="stat-number">{series.length}</span>
          </div>
        </div>

        <div className="stat-card" title="Average number of sermons added per month (since your first sermon).">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Avg per Month</h3>
            <span className="stat-number">
              {getAverageSermonsPerMonth()}
            </span>
          </div>
        </div>
      </div>

      {/* Charts and Analytics */}
      <div className="analytics-grid">
        {/* Top Tags */}
        <div className={`analytics-card analytics-card-scrollable${collapsedCards.tags ? ' collapsed' : ''}`} title="Shows the top 10 tags used across all sermons.">
          <div className="analytics-card-header" onClick={() => toggleCardCollapse('tags')} style={{cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
            <span>{collapsedCards.tags ? '▶' : '▼'}</span>
            <h3 style={{margin:0}}>Most Used Tags</h3>
          </div>
          {!collapsedCards.tags && (
            <div className="chart-container analytics-card-content-scrollable">
              {getTagStats().length === 0 ? (
                <p className="no-data">No tags assigned to sermons yet.</p>
              ) : (
                <div className="tag-cloud">
                  {getTagStats().map(({ tag, count }, index) => (
                    <span 
                      key={tag} 
                      className="tag-item"
                      style={{
                        fontSize: `${Math.max(0.8, count / 5)}rem`,
                        color: `hsl(${index * 30}, 70%, 65%)`,
                        cursor: 'pointer',
                        margin: '0 6px',
                      }}
                      title={`Used in ${count} sermon${count !== 1 ? 's' : ''}`}
                    >
                      {tag} ({count})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Most Referenced Books */}
        <div className={`analytics-card analytics-card-scrollable${collapsedCards.books ? ' collapsed' : ''}`} title="Shows all Bible books referenced in your sermons, ordered by total references.">
          <div className="analytics-card-header" onClick={() => toggleCardCollapse('books')} style={{cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
            <span>{collapsedCards.books ? '▶' : '▼'}</span>
            <h3 style={{margin:0}}>Most Referenced Books</h3>
          </div>
          {!collapsedCards.books && (
            <div className="chart-container analytics-card-content-scrollable">
              <div className="bar-chart">
                {getBooksStats().booksArray.map(({ book, count }, index) => (
                  <div key={book} className="bar-item">
                    <div
                      className="bar-label clickable"
                      title={`Book: ${book}`}
                      style={{ cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => handleBookClick(book)}
                    >
                      {book}
                      <span style={{ marginLeft: 8, fontSize: '0.9em', color: '#ffe082' }}>
                        {expandedBooks.includes(book) ? '▼' : '▶'}
                      </span>
                    </div>
                    <div className="bar-container">
                      <div
                        className="bar"
                        style={{
                          width: `${(count / Math.max(...getBooksStats().booksArray.map(s => s.count))) * 100}%`,
                          backgroundColor: `hsl(${index * 36}, 60%, 50%)`
                        }}
                        title={`Referenced ${count} time${count !== 1 ? 's' : ''}`}
                      ></div>
                      <span className="bar-value">{count}</span>
                    </div>
                    {/* Chapter breakdown dropdown */}
                    {expandedBooks.includes(book) && (
                      <div style={{ marginLeft: 24, marginTop: 4, paddingBottom: 8 }}>
                        {Object.entries(getBooksStats().chapterCount[book] || {})
                          .sort((a, b) => Number(a[0]) - Number(b[0]))
                          .map(([chapter, chapCount]) => (
                            <div key={chapter} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.98em', color: '#ffe082' }}>
                              <span style={{ minWidth: 40, fontWeight: 500 }}>Ch. {chapter}</span>
                              <span style={{ fontWeight: 400, color: '#fffbe6' }}>{chapCount}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Category Distribution */}
        <div className={`analytics-card analytics-card-scrollable${collapsedCards.categories ? ' collapsed' : ''}`} title="Distribution of sermons by category.">
          <div className="analytics-card-header" onClick={() => toggleCardCollapse('categories')} style={{cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
            <span>{collapsedCards.categories ? '▶' : '▼'}</span>
            <h3 style={{margin:0}}>Sermons by Category</h3>
          </div>
          {!collapsedCards.categories && (
            <div className="chart-container analytics-card-content-scrollable">
              {getCategoryStats().length === 0 ? (
                <p className="no-data">No categories assigned to sermons yet.</p>
              ) : (
                <div className="bar-chart">
                  {getCategoryStats().map(({ category, count }, index) => (
                    <div key={category} className="bar-item">
                      <div className="bar-label" title={`Category: ${category}`}>{category}</div>
                      <div className="bar-container">
                        <div 
                          className="bar"
                          style={{ 
                            width: `${(count / Math.max(...getCategoryStats().map(s => s.count))) * 100}%`,
                            backgroundColor: `hsl(${index * 45}, 70%, 60%)`
                          }}
                          title={`${count} sermon${count !== 1 ? 's' : ''} in this category`}
                        ></div>
                        <span className="bar-value">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Series Distribution */}
        <div className={`analytics-card analytics-card-scrollable${collapsedCards.series ? ' collapsed' : ''}`} title="Distribution of sermons by series.">
          <div className="analytics-card-header" onClick={() => toggleCardCollapse('series')} style={{cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
            <span>{collapsedCards.series ? '▶' : '▼'}</span>
            <h3 style={{margin:0}}>Sermons by Series</h3>
          </div>
          {!collapsedCards.series && (
            <div className="chart-container analytics-card-content-scrollable">
              {getSeriesStats().length === 0 ? (
                <p className="no-data">No series created yet.</p>
              ) : (
                <div className="bar-chart">
                  {getSeriesStats().map(({ seriesTitle, count }, index) => (
                    <div key={seriesTitle} className="bar-item">
                      <div className="bar-label" title={`Series: ${seriesTitle}`}>{seriesTitle}</div>
                      <div className="bar-container">
                        <div 
                          className="bar"
                          style={{ 
                            width: `${(count / Math.max(...getSeriesStats().map(s => s.count))) * 100}%`,
                            backgroundColor: `hsl(${index * 60}, 65%, 55%)`
                          }}
                          title={`${count} sermon${count !== 1 ? 's' : ''} in this series`}
                        ></div>
                        <span className="bar-value">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- Enhancement: Sermons Over Time Chart --- */}
        {/* Removed Sermons Added Per Month chart */}

      </div>

      {/* Insights */}
      {analytics && analytics.insights && Array.isArray(analytics.insights) && (
        <div className="insights-section">
          <h3>📊 Insights</h3>
          <div className="insights-grid">
            {analytics.insights.map((insight, index) => (
              <div key={index} className="insight-card">
                <h4>{insight.title || 'Insight'}</h4>
                <p>{insight.description || ''}</p>
                <div className="insight-data">
                  <strong>{insight.value !== undefined ? insight.value : ''}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Enhancement: Responsive Styles --- */}
      {/*
      @media (max-width: 900px) {
        .analytics-dashboard-page .stats-overview, .analytics-dashboard-page .analytics-grid {
          flex-direction: column;
          gap: 1.5rem;
        }
        .analytics-dashboard-page .stat-card, .analytics-dashboard-page .analytics-card {
          min-width: 0;
          width: 100%;
          margin-bottom: 1rem;
        }
        .analytics-dashboard-page .recent-sermons-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 600px) {
        .analytics-dashboard-page .page-header, .analytics-dashboard-page .timeframe-selector {
          flex-direction: column;
          align-items: flex-start;
        }
        .analytics-dashboard-page .stat-content h3, .analytics-dashboard-page .stat-number {
          font-size: 1rem;
        }
        .analytics-dashboard-page .bar-label, .analytics-dashboard-page .bar-value {
          font-size: 0.9rem;
        }
        .analytics-dashboard-page .sermon-month-labels {
          font-size: 10px;
        }
      }
      */}
    </div>
  );
};

export default AnalyticsDashboardPage;
