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
  const [currentHeading, setCurrentHeading] = useState<string>('p');
  const [currentFontSize, setCurrentFontSize] = useState<string>('16');
  const [currentFontFamily, setCurrentFontFamily] = useState<string>('Arial');

  // Handle content changes
  const handleContentChange = useCallback(() => {
    if (isComposing || !editorRef.current) return;
    
    const currentHtml = editorRef.current.innerHTML;
    if (currentHtml !== lastSetHtml.current) {
      onHtmlChange(currentHtml);
      
      // Extract scripture references if callback provided
      if (onRefsChange) {
        try {
          const textContent = editorRef.current.textContent || '';
          import('../utils/smartParseScriptureInput').then(({ extractScriptureReferences }) => {
            const refs = extractScriptureReferences(textContent);
            onRefsChange(refs);
          }).catch(() => {
            onRefsChange([]);
          });
        } catch (error) {
          console.warn('Error extracting scripture references:', error);
          onRefsChange([]);
        }
      }
    }
  }, [onHtmlChange, onRefsChange, isComposing]);

  // Check what formatting is active at cursor position
  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    
    try {
      if (document.queryCommandState('bold')) formats.add('bold');
      if (document.queryCommandState('italic')) formats.add('italic');
      if (document.queryCommandState('underline')) formats.add('underline');
      if (document.queryCommandState('strikeThrough')) formats.add('strikeThrough');
      if (document.queryCommandState('superscript')) formats.add('superscript');
      if (document.queryCommandState('subscript')) formats.add('subscript');
      if (document.queryCommandState('insertUnorderedList')) formats.add('insertUnorderedList');
      if (document.queryCommandState('insertOrderedList')) formats.add('insertOrderedList');
      if (document.queryCommandState('justifyLeft')) formats.add('justifyLeft');
      if (document.queryCommandState('justifyCenter')) formats.add('justifyCenter');
      if (document.queryCommandState('justifyRight')) formats.add('justifyRight');
      if (document.queryCommandState('justifyFull')) formats.add('justifyFull');
      
      // Check for heading and list context
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let element: Node | null = selection.getRangeAt(0).commonAncestorContainer;
        
        while (element && element !== editorRef.current) {
          if (element.nodeType === Node.ELEMENT_NODE) {
            const tagName = (element as Element).tagName.toLowerCase();
            if (tagName === 'ul') formats.add('insertUnorderedList');
            if (tagName === 'ol') formats.add('insertOrderedList');
          }
          element = element.parentNode as Node | null;
        }
      }
    } catch (e) {
      // Some browsers may not support all query commands
    }
    
    setActiveFormats(formats);
  }, []);

  // Get current heading level for dropdown
  const getCurrentHeading = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 'p';
    
    let element: Node | null = selection.getRangeAt(0).commonAncestorContainer;
    
    while (element && element !== editorRef.current) {
      if (element.nodeType === Node.ELEMENT_NODE) {
        const tagName = (element as Element).tagName.toLowerCase();
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tagName)) {
          return tagName;
        }
      }
      element = element.parentNode as Node | null;
    }
    
    return 'p';
  }, []);

  // Update current heading state
  const updateCurrentHeading = useCallback(() => {
    const heading = getCurrentHeading();
    setCurrentHeading(heading);
  }, [getCurrentHeading]);

  // Custom heading application
  const applyHeading = useCallback((tagName: string) => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    let element: Node | null = range.commonAncestorContainer;
    
    // Find the block element containing the selection
    while (element && element.nodeType !== Node.ELEMENT_NODE) {
      element = element.parentNode as Node | null;
    }
    
    while (element && element !== editorRef.current && 
           !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV'].includes((element as Element).tagName)) {
      element = element.parentNode as Node | null;
    }

    if (element && element !== editorRef.current) {
      const newElement = document.createElement(tagName.toUpperCase());
      newElement.innerHTML = (element as Element).innerHTML;
      element.parentNode?.replaceChild(newElement, element);
      
      // Restore selection
      const newRange = document.createRange();
      newRange.selectNodeContents(newElement);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      // If no block element found, wrap selection in new element
      const content = range.extractContents();
      const newElement = document.createElement(tagName.toUpperCase());
      newElement.appendChild(content);
      range.insertNode(newElement);
      
      // Restore selection
      const newRange = document.createRange();
      newRange.selectNodeContents(newElement);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }, []);

  // Custom list implementation
  const toggleList = useCallback((listType: 'ul' | 'ol') => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    let element: Node | null = range.commonAncestorContainer;
    
    // Find if we're already in a list
    while (element && element !== editorRef.current) {
      if (element.nodeType === Node.ELEMENT_NODE) {
        const tagName = (element as Element).tagName.toLowerCase();
        if (tagName === 'ul' || tagName === 'ol') {
          // We're in a list, convert it or remove it
          if (tagName === listType) {
            // Same type, remove list formatting
            const items = Array.from((element as Element).children);
            const parent = element.parentNode;
            items.forEach(item => {
              const p = document.createElement('p');
              p.innerHTML = item.innerHTML;
              parent?.insertBefore(p, element);
            });
            parent?.removeChild(element);
            return;
          } else {
            // Different type, convert it
            const newList = document.createElement(listType);
            newList.innerHTML = (element as Element).innerHTML;
            element.parentNode?.replaceChild(newList, element);
            return;
          }
        }
      }
      element = element.parentNode as Node | null;
    }

    // Not in a list, create one
    const content = range.extractContents();
    const listElement = document.createElement(listType);
    const listItem = document.createElement('li');
    
    if (content.textContent?.trim()) {
      listItem.appendChild(content);
    } else {
      listItem.textContent = 'List item';
    }
    
    listElement.appendChild(listItem);
    range.insertNode(listElement);
    
    // Place cursor in the list item
    const newRange = document.createRange();
    newRange.selectNodeContents(listItem);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }, []);

  // Format commands using document.execCommand
  const execCommand = useCallback((command: string, value?: string) => {
    if (command === 'formatBlock') {
      applyHeading(value || 'p');
    } else if (command === 'insertUnorderedList') {
      toggleList('ul');
    } else if (command === 'insertOrderedList') {
      toggleList('ol');
    } else if (command === 'fontSize') {
      document.execCommand('fontSize', false, '7'); // Large size, then apply custom
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = value + 'px';
        try {
          range.surroundContents(span);
        } catch (e) {
          // If surroundContents fails, use insertNode
          span.appendChild(range.extractContents());
          range.insertNode(span);
        }
      }
      setCurrentFontSize(value || '16');
    } else if (command === 'fontName') {
      document.execCommand('fontName', false, value);
      setCurrentFontFamily(value || 'Arial');
    } else if (command === 'foreColor') {
      document.execCommand('foreColor', false, value);
    } else if (command === 'backColor' || command === 'hiliteColor') {
      document.execCommand('backColor', false, value);
    } else if (command === 'indent') {
      document.execCommand('indent', false);
    } else if (command === 'outdent') {
      document.execCommand('outdent', false);
    } else {
      document.execCommand(command, false, value);
    }
    editorRef.current?.focus();
    updateActiveFormats();
    updateCurrentHeading();
    handleContentChange();
  }, [applyHeading, toggleList, updateActiveFormats, updateCurrentHeading, handleContentChange]);

  // Handle font size change
  const handleFontSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      execCommand('fontSize', value);
    }
  }, [execCommand]);

  // Handle font family change
  const handleFontFamilyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      execCommand('fontName', value);
    }
  }, [execCommand]);

  // Handle color changes
  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'foreColor' | 'backColor') => {
    const value = e.target.value;
    execCommand(type, value);
  }, [execCommand]);

  // Handle heading dropdown change
  const handleHeadingChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      execCommand('formatBlock', value);
    }
  }, [execCommand]);

  // Set HTML content when prop changes
  useEffect(() => {
    if (!editorRef.current || isComposing) return;
    
    const currentHtml = editorRef.current.innerHTML;
    
    if (html !== currentHtml && html !== lastSetHtml.current) {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const cursorOffset = range ? range.startOffset : 0;
      const anchorNode = range ? range.startContainer : null;
      
      lastSetHtml.current = html;
      editorRef.current.innerHTML = html || '';
      
      if (anchorNode && editorRef.current.contains(anchorNode)) {
        try {
          const newRange = document.createRange();
          newRange.setStart(anchorNode, Math.min(cursorOffset, anchorNode.textContent?.length || 0));
          newRange.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(newRange);
        } catch (e) {
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
      updateCurrentHeading();
    }
  }, [handleContentChange, updateActiveFormats, updateCurrentHeading, isComposing]);

  // Handle selection change to update active formats
  const handleSelectionChange = useCallback(() => {
    updateActiveFormats();
    updateCurrentHeading();
  }, [updateActiveFormats, updateCurrentHeading]);

  // Add event listeners for selection change
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Handle keyboard shortcuts
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
        case '=':
          if (e.shiftKey) { // Ctrl+Shift+= for superscript
            e.preventDefault();
            execCommand('superscript');
          }
          break;
        case '-':
          if (e.shiftKey) { // Ctrl+Shift+- for subscript
            e.preventDefault();
            execCommand('subscript');
          }
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
        case ']':
          e.preventDefault();
          execCommand('indent');
          break;
        case '[':
          e.preventDefault();
          execCommand('outdent');
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
    // Font Controls Group
    { key: 'fontFamily', dropdown: true, type: 'fontFamily', title: 'Font Family' },
    { key: 'fontSize', dropdown: true, type: 'fontSize', title: 'Font Size' },
    { key: 'sep1', separator: true },
    
    // Text Formatting Group
    { key: 'bold', command: 'bold', icon: '𝐁', title: 'Bold (Ctrl+B)' },
    { key: 'italic', command: 'italic', icon: '𝐼', title: 'Italic (Ctrl+I)' },
    { key: 'underline', command: 'underline', icon: '𝐔', title: 'Underline (Ctrl+U)' },
    { key: 'strikethrough', command: 'strikeThrough', icon: '𝒮', title: 'Strikethrough' },
    { key: 'superscript', command: 'superscript', icon: 'X²', title: 'Superscript' },
    { key: 'subscript', command: 'subscript', icon: 'X₂', title: 'Subscript' },
    { key: 'removeFormat', command: 'removeFormat', icon: '✗', title: 'Clear Formatting' },
    { key: 'sep2', separator: true },
    
    // Color Controls Group
    { key: 'fontColor', color: true, type: 'foreColor', icon: '🎨', title: 'Font Color' },
    { key: 'backgroundColor', color: true, type: 'backColor', icon: '🖍', title: 'Background Color' },
    { key: 'sep3', separator: true },
    
    // Paragraph Group
    { key: 'heading', dropdown: true, type: 'heading', title: 'Paragraph Style' },
    { key: 'sep4', separator: true },
    
    // List and Alignment Group
    { key: 'ul', command: 'insertUnorderedList', icon: '•', title: 'Bullet List' },
    { key: 'ol', command: 'insertOrderedList', icon: '1.', title: 'Numbered List' },
    { key: 'sep5', separator: true },
    
    // Alignment Group
    { key: 'left', command: 'justifyLeft', icon: '⚊', title: 'Align Left' },
    { key: 'center', command: 'justifyCenter', icon: '⚌', title: 'Align Center' },
    { key: 'right', command: 'justifyRight', icon: '⚋', title: 'Align Right' },
    { key: 'justify', command: 'justifyFull', icon: '⚍', title: 'Justify' },
    { key: 'sep6', separator: true },
    
    // Indentation Group
    { key: 'outdent', command: 'outdent', icon: '⇤', title: 'Decrease Indent' },
    { key: 'indent', command: 'indent', icon: '⇥', title: 'Increase Indent' },
    { key: 'sep7', separator: true },
    
    // Action Group
    { key: 'undo', command: 'undo', icon: '↶', title: 'Undo (Ctrl+Z)' },
    { key: 'redo', command: 'redo', icon: '↷', title: 'Redo (Ctrl+Shift+Z)' },
  ] as const;

  return (
    <div className="basic-rte-container">
      {/* Toolbar */}
      <div className="basic-rte-toolbar">
        {toolbarButtons.map((button) => {
          if ('separator' in button) {
            return <div key={button.key} className="toolbar-separator" />;
          }
          
          if ('dropdown' in button) {
            if (button.type === 'fontFamily') {
              return (
                <select
                  key={button.key}
                  className="toolbar-dropdown toolbar-font-family"
                  onChange={handleFontFamilyChange}
                  title={button.title}
                  value={currentFontFamily}
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Crimson Text">Crimson Text</option>
                </select>
              );
            }
            
            if (button.type === 'fontSize') {
              return (
                <select
                  key={button.key}
                  className="toolbar-dropdown toolbar-font-size"
                  onChange={handleFontSizeChange}
                  title={button.title}
                  value={currentFontSize}
                >
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                  <option value="11">11</option>
                  <option value="12">12</option>
                  <option value="14">14</option>
                  <option value="16">16</option>
                  <option value="18">18</option>
                  <option value="20">20</option>
                  <option value="24">24</option>
                  <option value="28">28</option>
                  <option value="32">32</option>
                  <option value="36">36</option>
                  <option value="48">48</option>
                  <option value="72">72</option>
                </select>
              );
            }
            
            if (button.type === 'heading') {
              return (
                <select
                  key={button.key}
                  className="toolbar-dropdown toolbar-heading"
                  onChange={handleHeadingChange}
                  title={button.title}
                  value={currentHeading}
                >
                  <option value="p">Normal Text</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                  <option value="h4">Heading 4</option>
                  <option value="h5">Heading 5</option>
                  <option value="h6">Heading 6</option>
                </select>
              );
            }
          }
          
          if ('color' in button) {
            return (
              <div key={button.key} className="toolbar-color-group">
                <label className="toolbar-color-button" title={button.title}>
                  <span className="color-icon">{button.icon}</span>
                  <input
                    type="color"
                    className="color-input"
                    onChange={(e) => handleColorChange(e, button.type as 'foreColor' | 'backColor')}
                  />
                </label>
              </div>
            );
          }
          
          const isActive = activeFormats.has(button.command);
          
          return (
            <button
              key={button.key}
              type="button"
              className={`toolbar-button ${isActive ? 'active' : ''}`}
              onClick={() => execCommand(button.command)}
              title={button.title}
            >
              {button.icon}
            </button>
          );
        })}
      </div>

      {/* Editor */}
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
        data-placeholder="Start typing your sermon notes..."
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
      />
    </div>
  );
}
