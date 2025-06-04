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

  const getRecentSermons = (count: number = 5) => {
    return [...getFilteredSermons()]
      .filter(s => s && s.dateAdded && typeof s.dateAdded === 'object' && 'seconds' in s.dateAdded)
      .sort((a, b) => {
        const aSec = a && a.dateAdded && typeof a.dateAdded === 'object' && 'seconds' in a.dateAdded ? a.dateAdded.seconds : 0;
        const bSec = b && b.dateAdded && typeof b.dateAdded === 'object' && 'seconds' in b.dateAdded ? b.dateAdded.seconds : 0;
        return bSec - aSec;
      })
      .slice(0, count);
  };

  const getCategoryStats = () => {
    const categoryCount: { [key: string]: number } = {};
    getFilteredSermons().forEach(sermon => {
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
    getFilteredSermons().forEach(sermon => {
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
    getFilteredSermons().forEach(sermon => {
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

  const getBooksStats = () => {
    const bookCount: { [key: string]: number } = {};
    getFilteredSermons().forEach(sermon => {
      let bookKey = '';
      if (sermon.bibleBook) {
        if (typeof sermon.bibleBook === 'string') {
          bookKey = sermon.bibleBook;
        } else if (React.isValidElement(sermon.bibleBook) && sermon.bibleBook.props && typeof sermon.bibleBook.props === 'object' && sermon.bibleBook.props !== null && 'children' in sermon.bibleBook.props) {
          bookKey = String((sermon.bibleBook.props as { children?: React.ReactNode }).children);
        } else {
          bookKey = String(sermon.bibleBook);
        }
        if (bookKey) {
          bookCount[bookKey] = (bookCount[bookKey] || 0) + 1;
        }
      }
    });
    return Object.entries(bookCount)
      .map(([book, count]) => ({ book, count }))
      .sort((a, b) => b.count - a.count);
  };

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
      ['Bible Books', getBooksStats().length],
      ['Unique Tags', getTagStats().length],
      ['Avg per Month', analytics?.averageSermonLength || (sermons.length / 12).toFixed(1)],
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
                  {sermon.dateAdded && typeof sermon.dateAdded === 'object' && 'seconds' in sermon.dateAdded
                    ? new Date(sermon.dateAdded.seconds * 1000).toLocaleDateString()
                    : 'No date'}
                </span>
              </div>
              <div className="sermon-details">
                <p className="scripture-ref">
                  {sermon.bibleBook ? String(sermon.bibleBook) : ''}
                  {sermon.bibleChapter ? ` ${sermon.bibleChapter}` : ''}
                  {sermon.bibleStartVerse ? `:${sermon.bibleStartVerse}` : ''}
                  {sermon.bibleEndVerse ? `-${sermon.bibleEndVerse}` : ''}
                </p>
                {sermon.category && (
                  <span className="category-tag">{sermon.category}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3>Total Sermons</h3>
            <span className="stat-number">{analytics?.totalSermons || sermons.length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏷️</div>
          <div className="stat-content">
            <h3>Categories</h3>
            <span className="stat-number">{categories.length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <h3>Series</h3>
            <span className="stat-number">{series.length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📖</div>
          <div className="stat-content">
            <h3>Bible Books</h3>
            <span className="stat-number">{getBooksStats().length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏷️</div>
          <div className="stat-content">
            <h3>Unique Tags</h3>
            <span className="stat-number">{getTagStats().length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Avg per Month</h3>
            <span className="stat-number">
              {analytics?.averageSermonLength || (sermons.length / 12).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Charts and Analytics */}
      <div className="analytics-grid">
        {/* Top Tags */}
        <div className="analytics-card">
          <h3>Most Used Tags <span title="Shows the top 10 tags used across all sermons.">ℹ️</span></h3>
          <div className="chart-container">
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
        </div>

        {/* Bible Books */}
        <div className="analytics-card">
          <h3>Most Preached Books <span title="Shows the top 10 Bible books referenced in your sermons.">ℹ️</span></h3>
          <div className="chart-container">
            <div className="bar-chart">
              {getBooksStats().slice(0, 10).map(({ book, count }, index) => (
                <div key={book} className="bar-item">
                  <div className="bar-label" title={`Book: ${book}`}>{book}</div>
                  <div className="bar-container">
                    <div 
                      className="bar"
                      style={{ 
                        width: `${(count / Math.max(...getBooksStats().map(s => s.count))) * 100}%`,
                        backgroundColor: `hsl(${index * 36}, 60%, 50%)`
                      }}
                      title={`Referenced in ${count} sermon${count !== 1 ? 's' : ''}`}
                    ></div>
                    <span className="bar-value">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="analytics-card">
          <h3>Sermons by Category <span title="Distribution of sermons by category.">ℹ️</span></h3>
          <div className="chart-container">
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
        </div>

        {/* Series Distribution */}
        <div className="analytics-card">
          <h3>Sermons by Series <span title="Distribution of sermons by series.">ℹ️</span></h3>
          <div className="chart-container">
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
        </div>

        {/* --- Enhancement: Sermons Over Time Chart --- */}
        <div className="analytics-card">
          <h3>Sermons Added Per Month</h3>
          <div className="chart-container">
            {getSermonsPerMonth().length === 0 ? (
              <p className="no-data">No sermon data available.</p>
            ) : (
              <svg width="100%" height="120" viewBox="0 0 400 120" style={{ background: '#f8f8fa', borderRadius: 8, marginBottom: 8 }}>
                {(() => {
                  const data = getSermonsPerMonth();
                  const max = Math.max(...data.map(d => d.count), 1);
                  const stepX = 400 / Math.max(data.length - 1, 1);
                  const points = data.map((d, i) => `${i * stepX},${120 - (d.count / max) * 100}`).join(' ');
                  return (
                    <>
                      <polyline
                        fill="none"
                        stroke="#4a90e2"
                        strokeWidth="3"
                        points={points}
                      />
                      {data.map((d, i) => (
                        <circle key={d.month} cx={i * stepX} cy={120 - (d.count / max) * 100} r="4" fill="#4a90e2">
                          <title>{`${d.month}: ${d.count}`}</title>
                        </circle>
                      ))}
                    </>
                  );
                })()}
              </svg>
            )}
            <div className="sermon-month-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              {getSermonsPerMonth().map(d => (
                <span key={d.month}>{d.month}</span>
              ))}
            </div>
          </div>
        </div>
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
