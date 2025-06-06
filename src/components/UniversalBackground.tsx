import React from 'react';
import '../styles/theme_patch_all_pages.css';

/**
 * UniversalBackground renders the branded overlay and ensures the background/wallpaper is always present.
 * It should be placed at the root of the app, below all content but above the body background.
 */
const UniversalBackground: React.FC = () => {
  return <div className="universal-search-bg" aria-hidden="true" />;
};

export default UniversalBackground;
