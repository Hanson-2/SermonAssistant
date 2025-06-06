import React, { useState } from 'react';
import { exportUserData, importUserData } from '../services/firebaseService';
import './ImportExportPage.css';

interface ExportData {
  userProfile: any;
  sermons: any[];
  userScriptureVersions: any[];
  userScriptures: any[];
  userTags: any[];
  sermonFolders: any[];
  sermonCategories?: any[];
  sermonSeries?: any[];
  exportDate: string;
  version: string;
}

export default function ImportExportPage() {
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ExportData | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  // Clear status messages after 5 seconds
  React.useEffect(() => {
    if (exportSuccess || importSuccess || error) {
      const timer = setTimeout(() => {
        setExportSuccess(null);
        setImportSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [exportSuccess, importSuccess, error]);

  const handleExport = async () => {
    setExportLoading(true);
    setError(null);
    setExportSuccess(null);

    try {
      const exportData = await exportUserData();
      
      // Add metadata to export
      const exportPackage: ExportData = {
        ...exportData,
        exportDate: new Date().toISOString(),
        version: "1.0.0"
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(exportPackage, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sermon-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess('Data exported successfully! Download has started.');
    } catch (err: any) {
      setError(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExportLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Please select a valid JSON backup file.');
      return;
    }

    setSelectedFile(file);
    setError(null);    // Read and preview file contents
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Validate that this is a valid backup file
        if (!data.exportDate || !data.version) {
          setError('Invalid backup file format. Missing required metadata.');
          setImportPreview(null);
          return;
        }

        // Check if this looks like a sermon notes backup
        const hasExpectedData = data.sermons || data.userProfile || data.userTags || data.sermonFolders;
        if (!hasExpectedData) {
          setError('This does not appear to be a valid Sermon Notes Assistant backup file.');
          setImportPreview(null);
          return;
        }

        setImportPreview(data);
      } catch (err) {
        setError('Invalid JSON file format.');
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  };  const handleImport = async () => {
    if (!selectedFile || !importPreview) {
      setError('Please select a valid backup file first.');
      return;
    }
    
    // Show confirmation dialog
    setShowImportConfirm(true);
  };

  const confirmImport = async () => {
    setShowImportConfirm(false);
    
    if (!selectedFile || !importPreview) {
      setError('Please select a valid backup file first.');
      return;
    }

    setImportLoading(true);
    setError(null);
    setImportSuccess(null);

    try {
      // Extract the import data (remove metadata fields)
      const { exportDate, version, ...importData } = importPreview;
      
      // Call the import function
      const result = await importUserData(importData, true); // true = replace existing data
      
      if (result.success) {
        const imported = result.imported;
        const totalItems = Object.values(imported).reduce((sum: number, count: any) => sum + (count || 0), 0);
        setImportSuccess(`Successfully imported ${totalItems} items: ${imported.sermons || 0} sermons, ${imported.userTags || 0} tags, ${imported.sermonFolders || 0} folders, ${imported.userScriptureVersions || 0} scripture versions, ${imported.userScriptures || 0} scriptures, ${imported.sermonCategories || 0} categories, ${imported.sermonSeries || 0} series.`);
        setSelectedFile(null);
        setImportPreview(null);
        
        // Reset the file input
        const fileInput = document.getElementById('backup-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setError('Import completed but some items may not have been imported successfully.');
      }
    } catch (err: any) {
      setError(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setImportLoading(false);
    }
  };

  const formatDataSize = (data: any): string => {
    const size = JSON.stringify(data).length;
    if (size < 1024) return `${size} bytes`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="import-export-layout">
      <div className="import-export-background"></div>
      
      <div className="import-export-container">
        <h1 className="import-export-title">Data Import & Export</h1>
        <p className="import-export-subtitle">
          Backup your sermon notes and scripture data, or restore from a previous backup.
        </p>

        {/* Status Messages */}
        {exportSuccess && (
          <div className="status-message success">
            <div className="status-icon">✅</div>
            <span>{exportSuccess}</span>
          </div>
        )}
        {importSuccess && (
          <div className="status-message success">
            <div className="status-icon">✅</div>
            <span>{importSuccess}</span>
          </div>
        )}
        {error && (
          <div className="status-message error">
            <div className="status-icon">❌</div>
            <span>{error}</span>
          </div>
        )}

        <div className="import-export-grid">
          {/* Export Section */}
          <div className="export-section">
            <div className="section-header">
              <h2 className="section-title">Export Data</h2>
              <div className="section-icon">📤</div>
            </div>
            <p className="section-description">
              Download a backup of all your sermon notes, scripture verses, folders, and settings.
            </p>
            <div className="export-features">
              <div className="feature-item">
                <span className="feature-icon">📝</span>
                <span>All sermon notes and content</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📖</span>
                <span>Personal scripture collection</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📁</span>
                <span>Folders and organization</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">⚙️</span>
                <span>User preferences and settings</span>
              </div>
            </div>
            <button
              className="export-button"
              onClick={handleExport}
              disabled={exportLoading}
            >
              {exportLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Exporting...
                </>
              ) : (
                <>
                  <span className="button-icon">💾</span>
                  Export All Data
                </>
              )}
            </button>
          </div>

          {/* Import Section */}
          <div className="import-section">
            <div className="section-header">
              <h2 className="section-title">Import Data</h2>
              <div className="section-icon">📥</div>
            </div>
            <p className="section-description">
              Restore your data from a previous backup file.
            </p>
              <div className="file-upload-area">
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="file-input"
                id="backup-file"
              />
              <label htmlFor="backup-file" className="file-upload-label">
                <span className="upload-icon">📁</span>
                <span className="upload-text">
                  {selectedFile ? selectedFile.name : 'Choose backup file (.json)'}
                </span>
              </label>
            </div>            {importPreview && (
              <div className="import-preview">
                <h3 className="preview-title">Backup Preview</h3>
                <div className="preview-stats">
                  <div className="stat-item">
                    <span className="stat-label">Export Date:</span>
                    <span className="stat-value">
                      {new Date(importPreview.exportDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Version:</span>
                    <span className="stat-value">{importPreview.version}</span>
                  </div>                  <div className="stat-item">
                    <span className="stat-label">Sermons:</span>
                    <span className="stat-value">{importPreview.sermons?.length || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Scripture Verses:</span>
                    <span className="stat-value">{importPreview.userScriptures?.length || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Scripture Versions:</span>
                    <span className="stat-value">{importPreview.userScriptureVersions?.length || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Tags:</span>
                    <span className="stat-value">{importPreview.userTags?.length || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Folders:</span>
                    <span className="stat-value">{importPreview.sermonFolders?.length || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Categories:</span>
                    <span className="stat-value">{importPreview.sermonCategories?.length || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Series:</span>
                    <span className="stat-value">{importPreview.sermonSeries?.length || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">File Size:</span>
                    <span className="stat-value">{formatDataSize(importPreview)}</span>
                  </div>
                </div>
              </div>
            )}

            <button
              className="import-button"
              onClick={handleImport}
              disabled={importLoading || !selectedFile || !importPreview}
            >
              {importLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Importing...
                </>
              ) : (
                <>
                  <span className="button-icon">📥</span>
                  Import Data
                </>
              )}
            </button>

            {!selectedFile && (
              <p className="import-note">
                ⚠️ Importing will replace your current data. Make sure to export a backup first!
              </p>
            )}
          </div>
        </div>

        {/* Additional Information */}
        <div className="info-section">
          <h3 className="info-title">Important Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <h4>🔐 Data Security</h4>
              <p>All exports are stored locally on your device. We never store your backup files on our servers.</p>
            </div>
            <div className="info-item">
              <h4>📅 Regular Backups</h4>
              <p>We recommend exporting your data regularly to ensure you never lose your important sermon notes.</p>
            </div>
            <div className="info-item">
              <h4>🔄 Data Format</h4>
              <p>Backup files are in JSON format and can be opened with any text editor for inspection.</p>
            </div>
            <div className="info-item">
              <h4>⚡ Quick Restore</h4>
              <p>Import process is designed to be fast and will restore all your data in just a few clicks.</p>
            </div>          </div>
        </div>

        {/* Import Confirmation Modal */}
        {showImportConfirm && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>⚠️ Confirm Data Import</h3>
              <p>
                <strong>Warning:</strong> This will replace ALL your current data with the data from the backup file. 
                This action cannot be undone.
              </p>
              <p>
                Make sure you have exported a current backup of your data before proceeding.
              </p>
              
              {importPreview && (
                <div className="import-summary">
                  <h4>Import Summary:</h4>
                  <ul>
                    <li>{importPreview.sermons?.length || 0} sermons</li>
                    <li>{importPreview.userTags?.length || 0} tags</li>
                    <li>{importPreview.sermonFolders?.length || 0} folders</li>
                    <li>{importPreview.userScriptureVersions?.length || 0} scripture versions</li>
                    <li>{importPreview.userScriptures?.length || 0} scripture verses</li>
                    <li>{importPreview.sermonCategories?.length || 0} categories</li>
                    <li>{importPreview.sermonSeries?.length || 0} series</li>
                  </ul>
                </div>
              )}

              <div className="modal-actions">
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowImportConfirm(false)}
                  disabled={importLoading}
                >
                  Cancel
                </button>
                <button 
                  className="btn-danger" 
                  onClick={confirmImport}
                  disabled={importLoading}
                >
                  {importLoading ? 'Importing...' : 'Yes, Replace My Data'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
