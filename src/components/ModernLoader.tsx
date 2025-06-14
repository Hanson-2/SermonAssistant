import React from 'react';
import './ModernLoader.css';

interface ModernLoaderProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const ModernLoader: React.FC<ModernLoaderProps> = ({ 
  text = 'Loading...', 
  size = 'medium',
  className = '' 
}) => {
  return (
    <div className={`modern-loader-container ${className}`}>
      <div className={`modern-loader ${size}`}>
        <div className="loader-ring"></div>
        <div className="loader-ring"></div>
        <div className="loader-ring"></div>
        <div className="loader-inner">
          <div className="loader-pulse"></div>
        </div>
      </div>
      {text && <p className="modern-loader-text">{text}</p>}
    </div>
  );
};

export default ModernLoader;
