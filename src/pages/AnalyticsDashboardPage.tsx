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

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedTimeframe]);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [analyticsData, sermonsData, categoriesData, seriesData] = await Promise.all([
        getSermonAnalyticsFunc(selectedTimeframe),
        fetchSermons(),
        getSermonCategoriesFunc(),
        getSermonSeriesFunc()
      ]);
      
      setAnalytics(analyticsData);
      setSermons(sermonsData);
      setCategories(categoriesData);
      setSeries(seriesData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRecentSermons = (count: number = 5) => {
    return [...sermons]
      .sort((a, b) => b.dateAdded.seconds - a.dateAdded.seconds)
      .slice(0, count);
  };

  const getCategoryStats = () => {
    const categoryCount: { [key: string]: number } = {};
    sermons.forEach(sermon => {
      if (sermon.category) {
        categoryCount[sermon.category] = (categoryCount[sermon.category] || 0) + 1;
      }
    });
    
    return Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getSeriesStats = () => {
    const seriesCount: { [key: string]: number } = {};
    sermons.forEach(sermon => {
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
    sermons.forEach(sermon => {
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
    sermons.forEach(sermon => {
      if (sermon.bibleBook) {
        const bookKey = typeof sermon.bibleBook === 'string'
          ? sermon.bibleBook
          : (React.isValidElement(sermon.bibleBook) && sermon.bibleBook.props && typeof sermon.bibleBook.props === 'object' && sermon.bibleBook.props !== null && 'children' in sermon.bibleBook.props)
            ? String((sermon.bibleBook.props as { children?: React.ReactNode }).children)
            : String(sermon.bibleBook);
        bookCount[bookKey] = (bookCount[bookKey] || 0) + 1;
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
      <div className="page-header">
        <h1>Analytics Dashboard</h1>
        <p>Insights and statistics about your sermon collection</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="message error">
          {error}
          <button onClick={() => setError(null)} className="close-btn">×</button>
        </div>
      )}

      {/* Timeframe Selector */}
      <div className="timeframe-selector">
        <h3>Viewing data for: {getTimeframePeriod()}</h3>
        <div className="timeframe-buttons">
          <button 
            className={`btn ${selectedTimeframe === 'month' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedTimeframe('month')}
          >
            This Month
          </button>
          <button 
            className={`btn ${selectedTimeframe === 'quarter' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedTimeframe('quarter')}
          >
            This Quarter
          </button>
          <button 
            className={`btn ${selectedTimeframe === 'year' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedTimeframe('year')}
          >
            This Year
          </button>
          <button 
            className={`btn ${selectedTimeframe === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedTimeframe('all')}
          >
            All Time
          </button>
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
        {/* Category Distribution */}
        <div className="analytics-card">
          <h3>Sermons by Category</h3>
          <div className="chart-container">
            {getCategoryStats().length === 0 ? (
              <p className="no-data">No categories assigned to sermons yet.</p>
            ) : (
              <div className="bar-chart">
                {getCategoryStats().map(({ category, count }, index) => (
                  <div key={category} className="bar-item">
                    <div className="bar-label">{category}</div>
                    <div className="bar-container">
                      <div 
                        className="bar"
                        style={{ 
                          width: `${(count / Math.max(...getCategoryStats().map(s => s.count))) * 100}%`,
                          backgroundColor: `hsl(${index * 45}, 70%, 60%)`
                        }}
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
          <h3>Sermons by Series</h3>
          <div className="chart-container">
            {getSeriesStats().length === 0 ? (
              <p className="no-data">No series created yet.</p>
            ) : (
              <div className="bar-chart">
                {getSeriesStats().map(({ seriesTitle, count }, index) => (
                  <div key={seriesTitle} className="bar-item">
                    <div className="bar-label">{seriesTitle}</div>
                    <div className="bar-container">
                      <div 
                        className="bar"
                        style={{ 
                          width: `${(count / Math.max(...getSeriesStats().map(s => s.count))) * 100}%`,
                          backgroundColor: `hsl(${index * 60}, 65%, 55%)`
                        }}
                      ></div>
                      <span className="bar-value">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Tags */}
        <div className="analytics-card">
          <h3>Most Used Tags</h3>
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
                      color: `hsl(${index * 30}, 70%, 65%)`
                    }}
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
          <h3>Most Preached Books</h3>
          <div className="chart-container">
            <div className="bar-chart">
              {getBooksStats().slice(0, 10).map(({ book, count }, index) => (
                <div key={book} className="bar-item">
                  <div className="bar-label">{book}</div>
                  <div className="bar-container">
                    <div 
                      className="bar"
                      style={{ 
                        width: `${(count / Math.max(...getBooksStats().map(s => s.count))) * 100}%`,
                        backgroundColor: `hsl(${index * 36}, 60%, 50%)`
                      }}
                    ></div>
                    <span className="bar-value">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <h3>Recent Sermons</h3>
        <div className="recent-sermons-grid">
          {getRecentSermons().map((sermon) => (
            <div key={sermon.id} className="recent-sermon-card">
              <div className="sermon-header">
                <Link to={`/expository/${sermon.id}`} className="sermon-title">
                  {sermon.title}
                </Link>
                <span className="sermon-date">
                  {new Date(sermon.dateAdded.seconds * 1000).toLocaleDateString()}
                </span>
              </div>
              <div className="sermon-details">
                <p className="scripture-ref">
                  {sermon.bibleBook} {sermon.bibleChapter}:{sermon.bibleStartVerse}-{sermon.bibleEndVerse}
                </p>
                {sermon.category && (
                  <span className="category-tag">{sermon.category}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      {analytics && (
        <div className="insights-section">
          <h3>📊 Insights</h3>
          <div className="insights-grid">
            {analytics.insights?.map((insight, index) => (
              <div key={index} className="insight-card">
                <h4>{insight.title}</h4>
                <p>{insight.description}</p>
                <div className="insight-data">
                  <strong>{insight.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboardPage;
