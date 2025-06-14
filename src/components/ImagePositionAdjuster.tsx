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
  const SENSITIVITY_MULTIPLIER = 30; // Adjust this value to tune drag sensitivity

  const [isDragging, setIsDragging] = useState(false);
  const [objectPosition, setObjectPosition] = useState(initialPosition);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Update object position when initialPosition prop changes
  React.useEffect(() => {
    setObjectPosition(initialPosition);
  }, [initialPosition]);  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    console.log('Mouse down triggered on:', e.target);
    
    // Don't start drag if clicking on the reset button
    if ((e.target as HTMLElement).closest('.reset-position-btn')) {
      console.log('Clicked on reset button, ignoring drag');
      return;
    }
    
    if (!containerRef.current) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
    e.stopPropagation();
    console.log('Drag started at:', { x: e.clientX, y: e.clientY });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    console.log('Touch start triggered on:', e.target);
    
    // Don't start drag if touching the reset button
    if ((e.target as HTMLElement).closest('.reset-position-btn')) {
      console.log('Touched reset button, ignoring drag');
      return;
    }
    
    if (!containerRef.current || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
    e.preventDefault();
    e.stopPropagation();
    console.log('Touch drag started at:', { x: touch.clientX, y: touch.clientY });
  }, []);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current || !imageRef.current) return;
    console.log('Mouse move - dragging:', isDragging);

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // Calculate movement as percentage of container size with improved sensitivity
    const moveXPercent = (deltaX / rect.width) * SENSITIVITY_MULTIPLIER; // Adjusted sensitivity
    const moveYPercent = (deltaY / rect.height) * SENSITIVITY_MULTIPLIER; // Adjusted sensitivity

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

    // Apply movement with direct coordinate mapping for intuitive dragging
    const newX = Math.max(0, Math.min(100, xPercent + moveXPercent));
    const newY = Math.max(0, Math.min(100, yPercent + moveYPercent));

    const newPosition = `${newX.toFixed(1)}% ${newY.toFixed(1)}%`;
    console.log('New position:', newPosition, 'Delta:', { deltaX, deltaY }, 'Move:', { moveXPercent, moveYPercent });
    setObjectPosition(newPosition);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, objectPosition]);
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !containerRef.current || !imageRef.current || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;    // Calculate movement as percentage of container size with improved sensitivity
    const moveXPercent = (deltaX / rect.width) * SENSITIVITY_MULTIPLIER; // Adjusted sensitivity
    const moveYPercent = (deltaY / rect.height) * SENSITIVITY_MULTIPLIER; // Adjusted sensitivity

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

    // Apply movement (invert the direction for more intuitive dragging)
    const newX = Math.max(0, Math.min(100, xPercent + moveXPercent));
    const newY = Math.max(0, Math.min(100, yPercent + moveYPercent));

    const newPosition = `${newX.toFixed(1)}% ${newY.toFixed(1)}%`;
    console.log('Touch move - new position:', newPosition, 'Delta:', { deltaX, deltaY });
    setObjectPosition(newPosition);
    setDragStart({ x: touch.clientX, y: touch.clientY });
  }, [isDragging, dragStart, objectPosition]);
  const handleMouseUp = useCallback(() => {
    console.log('Mouse up - isDragging:', isDragging);
    if (isDragging) {
      setIsDragging(false);
      console.log('Calling onPositionChange with:', objectPosition);
      onPositionChange(objectPosition);
    }
  }, [isDragging, objectPosition, onPositionChange]);React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMouseMove(e);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        handleTouchMove(e);
        e.preventDefault(); // Prevent scrolling
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    const handleGlobalTouchEnd = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleMouseUp]);
  const handleReset = useCallback(() => {
    const defaultPosition = "center center";
    console.log('Resetting position to:', defaultPosition);
    setObjectPosition(defaultPosition);
    onPositionChange(defaultPosition);
  }, [onPositionChange]);
  return (
    <div 
      className={`image-position-adjuster ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%'
      }}
    >      
      <div 
        ref={containerRef}
        className="image-container"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          borderRadius: '8px',
          touchAction: 'none', // Prevent default touch behaviors
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          border: isDragging ? '2px solid #FFD700' : '2px dashed rgba(255, 215, 0, 0.4)',
          transition: 'border-color 0.2s ease'
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
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#FFD700',
            padding: '6px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            opacity: isDragging ? 1 : 0.8,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }}
        >
          {isDragging ? 'Drag to adjust position' : 'Click and drag to adjust'}
        </div>
        
        {/* Visual grab handle indicator */}
        <div 
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#FFD700',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '14px',
            opacity: isDragging ? 0 : 0.8,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none',
            fontFamily: 'monospace',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }}
        >
          ⇅ ⇆
        </div>        {/* Reset button - now inside the container */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Reset button clicked');
            handleReset();
          }}
          className="reset-position-btn"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: '#FFD700',
            color: '#000',
            border: '2px solid #FFD700',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            zIndex: 20,
            boxShadow: '0 3px 6px rgba(0, 0, 0, 0.4)',
            transition: 'all 0.2s ease',
            textShadow: 'none',
            minWidth: '70px'
          }}
          title="Reset to center position"
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#FFA500';
            e.currentTarget.style.borderColor = '#FFA500';
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#FFD700';
            e.currentTarget.style.borderColor = '#FFD700';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.4)';
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent triggering drag
            console.log('Reset button mouse down - preventing drag');
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent triggering drag
            console.log('Reset button touch start - preventing drag');
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default ImagePositionAdjuster;
