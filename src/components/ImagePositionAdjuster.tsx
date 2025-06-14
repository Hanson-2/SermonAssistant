import React, { useState, useRef, useCallback } from 'react';

interface ImagePositionAdjusterProps {
  imageUrl: string;
  initialPosition?: string;
  onPositionChange: (position: string) => void;
  className?: string;
}

export const ImagePositionAdjuster: React.FC<ImagePositionAdjusterProps> = ({
  imageUrl,
  initialPosition = "center center",
  onPositionChange,
  className = ""
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [objectPosition, setObjectPosition] = useState(initialPosition);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current || !imageRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // Calculate movement as percentage of container size
    const moveXPercent = (deltaX / rect.width) * 100;
    const moveYPercent = (deltaY / rect.height) * 100;

    // Parse current position
    const currentPos = objectPosition.split(' ');
    let currentX = currentPos[0];
    let currentY = currentPos[1] || 'center';

    // Convert current position to percentage if it's a keyword
    let xPercent = 50;
    let yPercent = 50;

    if (currentX === 'left') xPercent = 0;
    else if (currentX === 'right') xPercent = 100;
    else if (currentX === 'center') xPercent = 50;
    else if (currentX.includes('%')) xPercent = parseFloat(currentX);

    if (currentY === 'top') yPercent = 0;
    else if (currentY === 'bottom') yPercent = 100;
    else if (currentY === 'center') yPercent = 50;
    else if (currentY.includes('%')) yPercent = parseFloat(currentY);

    // Apply movement
    const newX = Math.max(0, Math.min(100, xPercent - moveXPercent));
    const newY = Math.max(0, Math.min(100, yPercent - moveYPercent));

    const newPosition = `${newX}% ${newY}%`;
    setObjectPosition(newPosition);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, objectPosition]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onPositionChange(objectPosition);
    }
  }, [isDragging, objectPosition, onPositionChange]);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleReset = useCallback(() => {
    const defaultPosition = "center center";
    setObjectPosition(defaultPosition);
    onPositionChange(defaultPosition);
  }, [onPositionChange]);

  return (
    <div className={`image-position-adjuster ${className}`}>
      <div 
        ref={containerRef}
        className="image-container"
        onMouseDown={handleMouseDown}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          borderRadius: '8px'
        }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Adjustable preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: objectPosition,
            transition: isDragging ? 'none' : 'object-position 0.1s ease',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
          draggable={false}
        />
        
        {/* Adjustment hint overlay */}
        <div 
          className="adjustment-hint"
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            opacity: isDragging ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none'
          }}
        >
          Drag to adjust position
        </div>
      </div>
      
      {/* Reset button */}
      <button
        type="button"
        onClick={handleReset}
        className="reset-position-btn"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(255, 255, 255, 0.9)',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 10
        }}
        title="Reset to center"
      >
        Reset
      </button>
    </div>
  );
};

export default ImagePositionAdjuster;
