import React, { useState, useCallback, useMemo } from "react";
import CustomRichTextEditor from '../components/CustomRichTextEditor';
import MinimalTiptapTest from '../components/MinimalTiptapTest';
import "./ExpositoryDetailPage.css"; // Reuse styles

export default function TestExpositoryEditorPage() {
  console.log('[TestPage] Simple TestExpositoryEditorPage render');
  
  // Minimal state to test the editor
  const [htmlContent, setHtmlContent] = useState<string>("<p>Simple test content for the editor.</p>");
  
  // Stable callback to prevent re-renders
  const handleHtmlChange = useCallback((newHtml: string) => {
    console.log('[TestPage] HTML changed:', newHtml.substring(0, 50));
    setHtmlContent(newHtml);
  }, []);
  
  // Stable callback for refs
  const handleRefsChange = useCallback((refs: any[]) => {
    console.log('[TestPage] Refs changed:', refs);
  }, []);

  return (
    <div className="expository-detail-root">
      <div className="expository-bg-overlay" />
      <div className="expository-sticky-banner">
        <div className="expository-banner-row">
          <h1 className="expository-banner-title">Simple Editor Test</h1>
        </div>
        <div className="expository-banner-desc">Testing CustomRichTextEditor with minimal complexity</div>
      </div>
      
      <div className="expository-main-layout">
        <div className="expository-main-content">
          <div className="slide-editor-vertical-layout">            <div className="slide-editor-notes-area" style={{ border: '2px dashed green', padding: '1rem', minHeight: '400px' }}>
              <h3 style={{ color: 'white', marginBottom: '1rem' }}>Simple Editor Test</h3>
              
              <MinimalTiptapTest />
              
              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ color: 'white', marginBottom: '1rem' }}>CustomRichTextEditor Test</h4>
                <CustomRichTextEditor
                  html={htmlContent}
                  onHtmlChange={handleHtmlChange}
                  onRefsChange={handleRefsChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
