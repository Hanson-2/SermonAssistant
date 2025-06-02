import React, { useState, useEffect } from 'react';
import { 
  createSermonSeriesFunc,
  SermonSeries,
  deleteSermonSeriesFunc,
  addSermonToSeriesFunc,
  removeSermonFromSeriesFunc,
  fetchSermons,
  getSermonSeriesFunc,
  Sermon
} from '../services/firebaseService';
import { Link } from 'react-router-dom';
import './SermonSeriesManagementPage.css';

const SermonSeriesManagementPage: React.FC = () => {
  const [series, setSeries] = useState<SermonSeries[]>([]);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  
  // Form states
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [newSeriesDescription, setNewSeriesDescription] = useState('');
  const [newSeriesStartDate, setNewSeriesStartDate] = useState('');
  const [newSeriesEndDate, setNewSeriesEndDate] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [seriesData, sermonsData] = await Promise.all([
        getSermonSeriesFunc(),
        fetchSermons()
      ]);
      setSeries(seriesData);
      setSermons(sermonsData);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSeries = async () => {
    if (!newSeriesTitle.trim()) {
      setError('Please enter a series title.');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await createSermonSeriesFunc({
        name: newSeriesTitle.trim(),
        description: newSeriesDescription.trim() || undefined,
        startDate: newSeriesStartDate || undefined,
        endDate: newSeriesEndDate || undefined
      });
      setSuccess('Series created successfully!');
      
      // Reset form
      setNewSeriesTitle('');
      setNewSeriesDescription('');
      setNewSeriesStartDate('');
      setNewSeriesEndDate('');
      setShowCreateForm(false);
      
      // Refresh series
      const updatedSeries = await getSermonSeriesFunc();
      setSeries(updatedSeries);
    } catch (error) {
      console.error('Error creating series:', error);
      setError('Failed to create series. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSeries = async (seriesId: string) => {
    const seriesToDelete = series.find(s => s.id === seriesId);
    if (!window.confirm(`Are you sure you want to delete the series "${seriesToDelete?.name}"? This will not delete the sermons, but will remove them from the series.`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await deleteSermonSeriesFunc(seriesId);
      setSuccess('Series deleted successfully!');
      
      // Refresh data
      const [updatedSeries, updatedSermons] = await Promise.all([
        getSermonSeriesFunc(),
        fetchSermons()
      ]);
      setSeries(updatedSeries);
      setSermons(updatedSermons);
    } catch (error) {
      console.error('Error deleting series:', error);
      setError('Failed to delete series. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSermonToSeries = async (sermonId: string, seriesId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await addSermonToSeriesFunc(sermonId.toString(), seriesId.toString());
      setSuccess('Sermon added to series successfully!');
      
      // Refresh sermons
      const updatedSermons = await fetchSermons();
      setSermons(updatedSermons);
    } catch (error) {
      console.error('Error adding sermon to series:', error);
      setError('Failed to add sermon to series. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSermonFromSeries = async (sermonId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await removeSermonFromSeriesFunc(selectedSeriesId!, sermonId.toString());
      setSuccess('Sermon removed from series successfully!');
      
      // Refresh sermons
      const updatedSermons = await fetchSermons();
      setSermons(updatedSermons);
    } catch (error) {
      console.error('Error removing sermon from series:', error);
      setError('Failed to remove sermon from series. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeriesSermons = (seriesId: string) => {
    return sermons.filter(sermon => sermon.seriesId === seriesId);
  };

  const getUnassignedSermons = () => {
    return sermons.filter(sermon => !sermon.seriesId);
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="series-management-page">
      <div className="page-header">
        <h1>Sermon Series Management</h1>
        <p>Create and organize sermon series for better content organization</p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="message error">
          {error}
          <button onClick={clearMessages} className="close-btn">×</button>
        </div>
      )}
      {success && (
        <div className="message success">
          {success}
          <button onClick={clearMessages} className="close-btn">×</button>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Processing...</span>
        </div>
      )}

      {/* Create Series Section */}
      <div className="section">
        <div className="section-header">
          <h2>Create New Series</h2>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Cancel' : 'Create Series'}
          </button>
        </div>

        {showCreateForm && (
          <div className="create-series-form">
            <div className="form-group">
              <label htmlFor="seriesTitle">Series Title *</label>
              <input
                id="seriesTitle"
                type="text"
                value={newSeriesTitle}
                onChange={(e) => setNewSeriesTitle(e.target.value)}
                placeholder="e.g., The Fruits of the Spirit"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="seriesDescription">Description</label>
              <textarea
                id="seriesDescription"
                value={newSeriesDescription}
                onChange={(e) => setNewSeriesDescription(e.target.value)}
                placeholder="Optional description of the series..."
                rows={3}
              />
            </div>
            
            <div className="date-group">
              <div className="form-group">
                <label htmlFor="seriesStartDate">Start Date</label>
                <input
                  id="seriesStartDate"
                  type="date"
                  value={newSeriesStartDate}
                  onChange={(e) => setNewSeriesStartDate(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="seriesEndDate">End Date</label>
                <input
                  id="seriesEndDate"
                  type="date"
                  value={newSeriesEndDate}
                  onChange={(e) => setNewSeriesEndDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleCreateSeries}>
                Create Series
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing Series */}
      <div className="section">
        <h2>Existing Series ({series.length})</h2>
        
        {series.length === 0 ? (
          <div className="no-series">
            <p>No sermon series created yet.</p>
            <p>Create your first series to start organizing your sermons!</p>
          </div>
        ) : (
          <div className="series-grid">
            {series.map((s) => {
              const seriesSermons = getSeriesSermons(s.id!);
              return (
                <div key={s.id} className="series-card">
                  <div className="series-header">
                    <h3>{s.name}</h3>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteSeries(s.id!)}
                    >
                      Delete
                    </button>
                  </div>
                  
                  {s.description && (
                    <p className="series-description">{s.description}</p>
                  )}
                  
                  <div className="series-meta">
                    {s.startDate && (
                      <span className="series-date">
                        Start: {new Date(s.startDate).toLocaleDateString()}
                      </span>
                    )}
                    {s.endDate && (
                      <span className="series-date">
                        End: {new Date(s.endDate).toLocaleDateString()}
                      </span>
                    )}
                    <span className="sermon-count">
                      {seriesSermons.length} sermon{seriesSermons.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="series-sermons">
                    <h4>Sermons in this series:</h4>
                    {seriesSermons.length === 0 ? (
                      <p className="no-sermons">No sermons assigned to this series yet.</p>
                    ) : (
                      <div className="sermons-list">
                        {seriesSermons.map((sermon) => (
                          <div key={sermon.id} className="sermon-item">
                            <div className="sermon-info">
                              <Link to={`/expository/${sermon.id}`} className="sermon-title">
                                {sermon.title}
                              </Link>
                              <span className="sermon-scripture">
                                {sermon.bibleBook} {sermon.bibleChapter}:{sermon.bibleStartVerse}-{sermon.bibleEndVerse}
                              </span>
                            </div>
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleRemoveSermonFromSeries(sermon.id!.toString())}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="add-sermon-section">
                    <h4>Add sermons to this series:</h4>
                    <div className="unassigned-sermons">
                      {getUnassignedSermons().map((sermon) => (
                        <div key={sermon.id} className="unassigned-sermon">
                          <div className="sermon-info">
                            <span className="sermon-title">{sermon.title}</span>
                            <span className="sermon-scripture">
                              {sermon.bibleBook} {sermon.bibleChapter}:{sermon.bibleStartVerse}-{sermon.bibleEndVerse}
                            </span>
                          </div>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAddSermonToSeries(sermon.id!.toString(), s.id!.toString())}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                    {getUnassignedSermons().length === 0 && (
                      <p className="no-unassigned">All sermons are already assigned to a series.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unassigned Sermons */}
      {getUnassignedSermons().length > 0 && (
        <div className="section">
          <h2>Unassigned Sermons ({getUnassignedSermons().length})</h2>
          <div className="unassigned-sermons-grid">
            {getUnassignedSermons().map((sermon) => (
              <div key={sermon.id} className="unassigned-sermon-card">
                <div className="sermon-header">
                  <Link to={`/expository/${sermon.id}`} className="sermon-title">
                    {sermon.title}
                  </Link>
                  <span className="sermon-date">
                    {new Date(sermon.dateAdded.seconds * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className="sermon-scripture">
                  {sermon.bibleBook} {sermon.bibleChapter}:{sermon.bibleStartVerse}-{sermon.bibleEndVerse}
                </div>
                <div className="assign-to-series">
                  <label>Assign to series:</label>
                  <select 
                    title="Assign to series"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddSermonToSeries(sermon.id!.toString(), e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Select a series...</option>
                    {series.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SermonSeriesManagementPage;
