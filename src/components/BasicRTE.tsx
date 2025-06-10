import React, { useRef, useEffect, useState, useCallback } from 'react';
import './CustomRichTextEditor.css';

interface BasicRTEProps {
  html: string;
  onHtmlChange: (html: string) => void;
  onRefsChange?: (refs: any[]) => void;
}

export default function BasicRTE({ html, onHtmlChange, onRefsChange }: BasicRTEProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSetHtml = useRef<string>('');
  const [isComposing, setIsComposing] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  // Check what formatting is active at cursor position
  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    
    try {
      if (document.queryCommandState('bold')) formats.add('bold');
      if (document.queryCommandState('italic')) formats.add('italic');
      if (document.queryCommandState('underline')) formats.add('underline');
      if (document.queryCommandState('insertUnorderedList')) formats.add('insertUnorderedList');
      if (document.queryCommandState('insertOrderedList')) formats.add('insertOrderedList');
      if (document.queryCommandState('justifyLeft')) formats.add('justifyLeft');
      if (document.queryCommandState('justifyCenter')) formats.add('justifyCenter');
      if (document.queryCommandState('justifyRight')) formats.add('justifyRight');
    } catch (e) {
      // Some browsers may not support all query commands
    }
    
    setActiveFormats(formats);
  }, []);  // Format commands using document.execCommand
  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateActiveFormats();
    handleContentChange();
  }, [updateActiveFormats, handleContentChange]);
  // Handle content changes
  const handleContentChange = useCallback(() => {
    if (isComposing || !editorRef.current) return;
    
    const currentHtml = editorRef.current.innerHTML;
    if (currentHtml !== lastSetHtml.current) {
      onHtmlChange(currentHtml);
      
      // Extract scripture references if callback provided
      if (onRefsChange) {
        try {
          // Extract plain text for scripture reference parsing
          const textContent = editorRef.current.textContent || '';
          // Import and use the scripture extraction utility
          import('../utils/smartParseScriptureInput').then(({ extractScriptureReferences }) => {
            const refs = extractScriptureReferences(textContent);
            onRefsChange(refs);
          }).catch(() => {
            // Fallback if import fails
            onRefsChange([]);
          });
        } catch (error) {
          console.warn('Error extracting scripture references:', error);
          onRefsChange([]);
        }
      }
    }
  }, [onHtmlChange, onRefsChange, isComposing]);
  // Set HTML content when prop changes
  useEffect(() => {
    if (!editorRef.current || isComposing) return;
    
    const currentHtml = editorRef.current.innerHTML;
    
    // Only update if HTML has actually changed and it's different from what we last set
    if (html !== currentHtml && html !== lastSetHtml.current) {
      // Save cursor position
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const cursorOffset = range ? range.startOffset : 0;
      const anchorNode = range ? range.startContainer : null;
      
      // Update content
      lastSetHtml.current = html;
      editorRef.current.innerHTML = html || '';
      
      // Restore cursor position if possible
      if (anchorNode && editorRef.current.contains(anchorNode)) {
        try {
          const newRange = document.createRange();
          newRange.setStart(anchorNode, Math.min(cursorOffset, anchorNode.textContent?.length || 0));
          newRange.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(newRange);
        } catch (e) {
          // If cursor restoration fails, just focus the editor
          editorRef.current.focus();
        }
      }
    }
  }, [html, isComposing]);

  // Handle composition events (for IME input)
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
    setTimeout(handleContentChange, 0);
  }, [handleContentChange]);
  // Handle input events
  const handleInput = useCallback((e: React.FormEvent) => {
    if (!isComposing) {
      handleContentChange();
      updateActiveFormats();
    }
  }, [handleContentChange, updateActiveFormats, isComposing]);

  // Handle selection change to update active formats
  const handleSelectionChange = useCallback(() => {
    updateActiveFormats();
  }, [updateActiveFormats]);

  // Add event listeners for selection change
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);// Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
        case 'z':
          if (e.shiftKey) {
            e.preventDefault();
            execCommand('redo');
          } else {
            e.preventDefault();
            execCommand('undo');
          }
          break;
        default:
          break;
      }
    }
  }, [execCommand]);

  // Handle paste events to clean up pasted content
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    handleContentChange();
  }, [handleContentChange]);
  // Toolbar button configurations
  const toolbarButtons = [
    { command: 'undo', icon: '↶', title: 'Undo (Ctrl+Z)' },
    { command: 'redo', icon: '↷', title: 'Redo (Ctrl+Shift+Z)' },
    { separator: true },
    { command: 'bold', icon: 'B', title: 'Bold (Ctrl+B)' },
    { command: 'italic', icon: 'I', title: 'Italic (Ctrl+I)' },
    { command: 'underline', icon: 'U', title: 'Underline (Ctrl+U)' },
    { separator: true },
    { command: 'formatBlock', value: 'h1', icon: 'H1', title: 'Heading 1' },
    { command: 'formatBlock', value: 'h2', icon: 'H2', title: 'Heading 2' },
    { command: 'formatBlock', value: 'h3', icon: 'H3', title: 'Heading 3' },
    { command: 'formatBlock', value: 'p', icon: 'P', title: 'Paragraph' },
    { separator: true },
    { command: 'insertUnorderedList', icon: '•', title: 'Bullet List' },
    { command: 'insertOrderedList', icon: '1.', title: 'Numbered List' },
    { separator: true },
    { command: 'justifyLeft', icon: '⬅', title: 'Align Left' },
    { command: 'justifyCenter', icon: '⬅➡', title: 'Align Center' },
    { command: 'justifyRight', icon: '➡', title: 'Align Right' },
    { separator: true },
    { command: 'removeFormat', icon: '✗', title: 'Clear Formatting' },
  ];

  return (
    <div className="basic-rte-container">
      {/* Toolbar */}
      <div className="basic-rte-toolbar">        {toolbarButtons.map((button, index) => {
          if (button.separator) {
            return <div key={`sep-${index}`} className="toolbar-separator" />;
          }
          
          const isActive = activeFormats.has(button.command);
          
          return (
            <button
              key={button.command}
              type="button"
              className={`toolbar-button ${isActive ? 'active' : ''}`}
              onClick={() => execCommand(button.command, button.value)}
              title={button.title}
            >
              {button.icon}
            </button>
          );
        })}
      </div>      {/* Editor */}
      <div
        ref={editorRef}
        className="basic-rte-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        style={{
          minHeight: '200px',
          padding: '1rem',
          border: '1px solid #333',
          borderRadius: '4px',
          backgroundColor: '#1e293b',
          color: '#f3f4f6',
          fontSize: '1rem',
          lineHeight: '1.5',
          outline: 'none',
          overflowY: 'auto',
        }}
        placeholder="Start typing your sermon notes..."
      />
    </div>
  );
}
