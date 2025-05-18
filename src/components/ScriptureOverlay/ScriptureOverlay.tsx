import React, { useEffect } from "react";
import "./ScriptureOverlay.css";

interface ScriptureOverlayProps {
  reference: string;
  content: string;
  onClose: () => void;
}

export default function ScriptureOverlay({ reference, content, onClose }: ScriptureOverlayProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="scripture-overlay-backdrop" onClick={onClose}>
      <div className="scripture-overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="scripture-overlay-header">
          <span>{reference}</span>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="scripture-overlay-content">
          <pre>{content}</pre>
        </div>
      </div>
    </div>
  );
}
