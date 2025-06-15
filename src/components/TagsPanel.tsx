import React, { useState, useEffect } from 'react';
import { fetchTags } from '../services/tagService';
import './TagsPanel.css';

interface Tag {
  id: string;
  name: string;
}

interface TagsPanelProps {
  expositoryTags?: string[];
  onVerseSelect: (verses: any[]) => void;
  onTagClick: (tagName: string) => void;
}

const TagsPanel: React.FC<TagsPanelProps> = ({ expositoryTags = [], onVerseSelect, onTagClick }) => {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);  useEffect(() => {
    loadTags();
  }, []);const loadTags = async () => {
    setLoading(true);
    try {
      const tags = await fetchTags();
      setAllTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const normalizeTagForDisplay = (tag: string): string => {
    return tag
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  const handleTagClick = (tagName: string) => {
    onTagClick(tagName);
  };  // Filter tags that are associated with this expository
  const expositoryTagObjects = allTags.filter(tag => expositoryTags.includes(tag.name));
  
  // Filter remaining tags (not associated with expository) for browsing
  const availableTags = allTags.filter(tag => !expositoryTags.includes(tag.name));

  return (
    <div className="tags-panel">
      <div className="tags-panel-header">
        <h3 className="tags-panel-title">Tags</h3>
      </div>

      {loading && (
        <div className="tags-loading">
          Loading tags...
        </div>
      )}

      {!loading && (
        <div className="tags-content">
          {/* Expository Tags Section */}
          {expositoryTagObjects.length > 0 && (
            <div className="tags-section">
              <h4 className="tags-section-title">Expository Tags</h4>
              <div className="tags-list">
                {expositoryTagObjects.map(tag => (
                  <button
                    key={tag.id}
                    className="tag-item expository-tag"
                    onClick={() => handleTagClick(tag.name)}
                    title={`View verses for ${normalizeTagForDisplay(tag.name)}`}
                  >
                    {normalizeTagForDisplay(tag.name)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All Available Tags Section */}
          <div className="tags-section">
            <h4 className="tags-section-title">
              {expositoryTagObjects.length > 0 ? 'Browse Other Tags' : 'Available Tags'}
            </h4>
            <div className="tags-list scrollable">
              {availableTags.length === 0 ? (
                <div className="no-tags">
                  {expositoryTagObjects.length > 0 ? 'No other tags available' : 'No tags available'}
                </div>
              ) : (
                availableTags.map(tag => (
                  <button
                    key={tag.id}
                    className="tag-item available-tag"
                    onClick={() => handleTagClick(tag.name)}
                    title={`View verses for ${normalizeTagForDisplay(tag.name)}`}
                  >
                    {normalizeTagForDisplay(tag.name)}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>      )}
    </div>
  );
};

export default TagsPanel;
