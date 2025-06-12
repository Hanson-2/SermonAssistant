import React, { useRef, useEffect, useState, useCallback } from 'react';
import './CustomRichTextEditor.css';
import { wrapScriptureRefsInEditor, debounceWrapScriptureRefs } from '../utils/wrapScriptureRefsInEditor';
import { fetchTags } from '../services/tagService';

interface BasicRTEProps {
  html: string;
  onHtmlChange: (html: string) => void;
  onRefsChange?: (refs: any[]) => void;
  onTagSelect?: (tagName: string) => void;
  onCompositionStateChange?: (isComposing: boolean) => void; // NEW
}

interface Tag {
  id: string;
  name: string;
}

function BasicRTE({ html, onHtmlChange, onRefsChange, onTagSelect, onCompositionStateChange }: BasicRTEProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSetHtml = useRef<string>('');
  const [isComposing, setIsComposing] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());  const [currentHeading, setCurrentHeading] = useState<string>('p');
  const [currentFontSize, setCurrentFontSize] = useState<string>('16');
  const [currentFontFamily, setCurrentFontFamily] = useState<string>('Arial');
  
  // Tag autocomplete state
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);
  const [tagDropdownPosition, setTagDropdownPosition] = useState({ top: 0, left: 0 });
  const [tagInputRange, setTagInputRange] = useState<Range | null>(null);

  // Debounced scripture reference wrapper - DISABLED for now
  // const debouncedWrapRefs = useRef(
  //   debounceWrapScriptureRefs(null as any, 2000) // Increased to 2 seconds to reduce interruption
  // );

  // // Update the debounced function when editor ref changes - DISABLED
  // useEffect(() => {
  //   if (editorRef.current) {
  //     debouncedWrapRefs.current = debounceWrapScriptureRefs(editorRef.current, 2000);
  //   }
  // }, [editorRef.current]);

  // Helper function to normalize tag display
  const normalizeTagForDisplay = useCallback((tag: string): string => {
    return tag.split(/[\s_-]+/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }, []);

  // Load tag suggestions
  const loadTagSuggestions = useCallback(() => {
    fetchTags().then(tags => {
      setTagSuggestions(tags);
    }).catch(() => {
      setTagSuggestions([]);
    });
  }, []);

  // Tag autocomplete functionality
  const checkForTagTrigger = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return;

    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const textContent = textNode.textContent || '';
    const cursorPos = range.startOffset;
    
    // Look for /tag trigger
    const beforeCursor = textContent.substring(0, cursorPos);
    const lastSlashIndex = beforeCursor.lastIndexOf('/');
    
    if (lastSlashIndex === -1) {
      setShowTagDropdown(false);
      return;
    }
    
    const potentialTag = beforeCursor.substring(lastSlashIndex + 1);
    
    // Check if it's a tag trigger (starts with 'tag')
    if (potentialTag.startsWith('tag') && potentialTag.length <= 20) {
      // Get cursor position for dropdown placement
      const tempRange = document.createRange();
      tempRange.setStart(textNode, lastSlashIndex);
      tempRange.setEnd(textNode, cursorPos);
      const rect = tempRange.getBoundingClientRect();
      
      setTagDropdownPosition({
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX
      });
      
      // Create range for replacement
      const replaceRange = document.createRange();
      replaceRange.setStart(textNode, lastSlashIndex);
      replaceRange.setEnd(textNode, cursorPos);
      setTagInputRange(replaceRange);
      
      // Fetch and filter tags
      fetchTags().then(tags => {
        const filtered = tags.filter(tag => 
          tag.name.toLowerCase().includes(potentialTag.substring(3).toLowerCase())
        );
        setTagSuggestions(filtered);
        setSelectedTagIndex(0);
        setShowTagDropdown(true);
      }).catch(() => {
        setTagSuggestions([]);
        setShowTagDropdown(false);
      });
    } else {
      setShowTagDropdown(false);
    }
  }, []);

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
      // DISABLED: No longer auto-wrapping scripture references inline
      // if (editorRef.current) {
      //   debouncedWrapRefs.current();
      // }
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
  }, []);  // Custom list implementation
  const toggleList = useCallback((listType: 'ul' | 'ol') => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    // Focus editor if needed
    if (!editorRef.current.contains(selection.anchorNode)) {
      editorRef.current.focus();
    }

    // Ensure we have a range
    if (selection.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      selection.addRange(range);
    }

    const range = selection.getRangeAt(0);
    let currentElement: Node | null = range.startContainer;
    
    // Find if we're inside a list or list item
    let existingList: Element | null = null;
    let existingListItem: Element | null = null;
    
    while (currentElement && currentElement !== editorRef.current) {
      if (currentElement.nodeType === Node.ELEMENT_NODE) {
        const element = currentElement as Element;
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === 'li' && !existingListItem) {
          existingListItem = element;
        }
        if ((tagName === 'ul' || tagName === 'ol') && !existingList) {
          existingList = element;
          break;
        }
      }
      currentElement = currentElement.parentNode;
    }

    if (existingList) {
      // We're in a list, handle conversion or removal
      if (existingList.tagName.toLowerCase() === listType) {
        // Same type list, remove list formatting
        const items = Array.from(existingList.children);
        const fragment = document.createDocumentFragment();
        
        items.forEach(item => {
          const p = document.createElement('p');
          p.innerHTML = item.innerHTML || '&nbsp;';
          fragment.appendChild(p);
        });
        
        if (existingList.parentNode) {
          existingList.parentNode.replaceChild(fragment, existingList);
        }
      } else {
        // Different type list, convert it
        const newList = document.createElement(listType);
        newList.innerHTML = existingList.innerHTML;
        if (existingList.parentNode) {
          existingList.parentNode.replaceChild(newList, existingList);
        }
      }
    } else {
      // Not in a list, create one
      let content = '';
      
      if (range.collapsed) {        // No selection, get the current line/paragraph content
        let currentNode = range.startContainer;
        if (currentNode.nodeType === Node.TEXT_NODE) {
          currentNode = currentNode.parentNode as Node;
        }
        
        // Check if we're in a paragraph
        if (currentNode && (currentNode as Element).tagName?.toLowerCase() === 'p') {
          content = (currentNode as Element).innerHTML || '&nbsp;';
          // Replace the paragraph with a list
          const listElement = document.createElement(listType);
          const listItem = document.createElement('li');
          listItem.innerHTML = content;
          listElement.appendChild(listItem);
          
          if (currentNode.parentNode) {
            currentNode.parentNode.replaceChild(listElement, currentNode);
          }
          
          // Position cursor in the list item
          const newRange = document.createRange();
          newRange.setStart(listItem, listItem.childNodes.length);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else {
          // Create new list with empty item
          content = '&nbsp;';
          const listElement = document.createElement(listType);
          const listItem = document.createElement('li');
          listItem.innerHTML = content;
          listElement.appendChild(listItem);
          
          range.insertNode(listElement);
          
          // Position cursor in the list item
          const newRange = document.createRange();
          newRange.selectNodeContents(listItem);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      } else {
        // Get selected content
        const selectedContent = range.extractContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(selectedContent);
        content = tempDiv.innerHTML || '&nbsp;';
        
        // Create the list structure
        const listElement = document.createElement(listType);
        const listItem = document.createElement('li');
        listItem.innerHTML = content;
        listElement.appendChild(listItem);
        
        // Insert the list
        range.insertNode(listElement);
        
        // Position cursor at end of the list item
        const newRange = document.createRange();
        newRange.selectNodeContents(listItem);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }
    
    // Trigger content change and update
    setTimeout(() => {
      handleContentChange();
      updateActiveFormats();
    }, 10);
  }, [handleContentChange, updateActiveFormats]);
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
      // Use simple execCommand approach
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
    } else if (['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].includes(command)) {      // Enhanced alignment handling for lists with proper state clearing
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let element = range.commonAncestorContainer;
        
        // Find if we're in a list
        while (element && element !== editorRef.current) {
          if (element.nodeType === Node.ELEMENT_NODE) {
            const tagName = (element as Element).tagName.toLowerCase();
            if (tagName === 'ul' || tagName === 'ol') {
              // Apply alignment to the list itself with proper state clearing
              const listElement = element as HTMLElement;
              
              // Clear ALL previous alignment styles first
              listElement.style.removeProperty('text-align');
              listElement.style.removeProperty('list-style-position');
              listElement.style.removeProperty('padding-left');
              listElement.style.removeProperty('margin-left');
              listElement.style.removeProperty('margin-right');
              listElement.style.removeProperty('display');
              listElement.style.removeProperty('width');
              
              // Clear existing alignment classes from list items
              const listItems = listElement.querySelectorAll('li');
              listItems.forEach(li => {
                (li as HTMLElement).style.removeProperty('text-align');
                (li as HTMLElement).style.removeProperty('list-style-position');
                (li as HTMLElement).style.removeProperty('margin-left');
                (li as HTMLElement).style.removeProperty('padding-left');
              });
              
              // Apply new alignment
              if (command === 'justifyCenter') {
                listElement.style.setProperty('text-align', 'center', 'important');
                listElement.style.setProperty('list-style-position', 'inside', 'important');
                listElement.style.setProperty('padding-left', '0', 'important');
                listElement.style.setProperty('margin-left', 'auto', 'important');
                listElement.style.setProperty('margin-right', 'auto', 'important');
                listElement.style.setProperty('display', 'block', 'important');
                listElement.style.setProperty('width', 'fit-content', 'important');
                
                listItems.forEach(li => {
                  (li as HTMLElement).style.setProperty('text-align', 'center', 'important');
                  (li as HTMLElement).style.setProperty('list-style-position', 'inside', 'important');
                });
              } else if (command === 'justifyRight') {
                listElement.style.setProperty('text-align', 'right', 'important');
                listElement.style.setProperty('list-style-position', 'inside', 'important');
                listElement.style.setProperty('padding-left', '0', 'important');
                listElement.style.setProperty('margin-left', 'auto', 'important');
                listElement.style.setProperty('display', 'block', 'important');
                listElement.style.setProperty('width', 'fit-content', 'important');
                
                listItems.forEach(li => {
                  (li as HTMLElement).style.setProperty('text-align', 'right', 'important');
                  (li as HTMLElement).style.setProperty('list-style-position', 'inside', 'important');
                });
              } else {
                // Left or justify - restore default list styling
                listElement.style.setProperty('text-align', 'left', 'important');
                listElement.style.setProperty('list-style-position', 'outside', 'important');
                listElement.style.setProperty('padding-left', '2rem', 'important');
                
                listItems.forEach(li => {
                  (li as HTMLElement).style.setProperty('text-align', 'left', 'important');
                  (li as HTMLElement).style.setProperty('list-style-position', 'outside', 'important');
                });
              }
              
              handleContentChange();
              return;
            }
          }
          element = element.parentNode as Node;
        }
      }
      
      // Not in a list, use standard alignment
      document.execCommand(command, false, value);
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

  // Enhanced font family change handler for multi-line selections and list items
  const handleFontFamilyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const fontFamily = e.target.value;
    setCurrentFontFamily(fontFamily);
    
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection) return;
    
    try {
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      
      if (!range || range.collapsed) {
        // No selection - apply to current block element
        let currentNode = range ? range.startContainer : editorRef.current.firstChild;
        if (currentNode?.nodeType === Node.TEXT_NODE) {
          currentNode = currentNode.parentNode as Node;
        }
        
        // Find the nearest block element
        while (currentNode && currentNode !== editorRef.current) {
          if ((currentNode as Element).tagName && 
              ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes((currentNode as Element).tagName)) {
            (currentNode as HTMLElement).style.setProperty('font-family', fontFamily, 'important');
            break;
          }
          currentNode = currentNode.parentNode as Node;
        }
      } else {
        // Has selection - use a robust text node approach
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        
        // Store selection details for restoration
        const startOffset = range.startOffset;
        const endOffset = range.endOffset;
        
        // Create a list of all text nodes that are partially or fully selected
        const textNodesToWrap: Array<{node: Text, startOffset?: number, endOffset?: number}> = [];
        
        // Use TreeWalker to find all text nodes in the range
        const walker = document.createTreeWalker(
          range.commonAncestorContainer,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              if (range.intersectsNode(node)) {
                return NodeFilter.FILTER_ACCEPT;
              }
              return NodeFilter.FILTER_REJECT;
            }
          }
        );
        
        let textNode;
        while (textNode = walker.nextNode()) {
          const textElement = textNode as Text;
          if (textElement.textContent && textElement.textContent.trim()) {
            const isStartNode = textElement === startContainer;
            const isEndNode = textElement === endContainer;
            
            if (isStartNode && isEndNode) {
              // Single text node selection
              textNodesToWrap.push({
                node: textElement,
                startOffset: startOffset,
                endOffset: endOffset
              });
            } else if (isStartNode) {
              // First text node in multi-node selection
              textNodesToWrap.push({
                node: textElement,
                startOffset: startOffset
              });
            } else if (isEndNode) {
              // Last text node in multi-node selection
              textNodesToWrap.push({
                node: textElement,
                endOffset: endOffset
              });
            } else {
              // Full text node in the middle
              textNodesToWrap.push({
                node: textElement
              });
            }
          }
        }
        
        // Apply font to each text node
        let lastSpan: HTMLSpanElement | null = null;
        
        textNodesToWrap.forEach(({node, startOffset, endOffset}) => {
          try {
            const parent = node.parentNode;
            if (!parent) return;
            
            // Check if we're in a list item - if so, be more careful
            let isInListItem = false;
            let checkParent: Node | null = parent;
            while (checkParent && checkParent !== editorRef.current) {
              if ((checkParent as Element).tagName?.toLowerCase() === 'li') {
                isInListItem = true;
                break;
              }
              checkParent = checkParent.parentNode;
            }
            
            const text = node.textContent || '';
            const startPos = startOffset ?? 0;
            const endPos = endOffset ?? text.length;
            
            if (startPos === 0 && endPos === text.length) {
              // Wrap entire text node
              const span = document.createElement('span');
              span.style.setProperty('font-family', fontFamily, 'important');
              span.textContent = text;
              
              // For list items, add special class to prevent structural issues
              if (isInListItem) {
                span.setAttribute('data-list-text', 'true');
              }
              
              parent.replaceChild(span, node);
              lastSpan = span;
            } else {
              // Partial text node - split it
              const beforeText = text.substring(0, startPos);
              const selectedText = text.substring(startPos, endPos);
              const afterText = text.substring(endPos);
              
              // Remove original text node
              parent.removeChild(node);
              
              // Add parts back
              if (beforeText) {
                parent.appendChild(document.createTextNode(beforeText));
              }
              
              if (selectedText) {
                const span = document.createElement('span');
                span.style.setProperty('font-family', fontFamily, 'important');
                span.textContent = selectedText;
                
                if (isInListItem) {
                  span.setAttribute('data-list-text', 'true');
                }
                
                parent.appendChild(span);
                lastSpan = span;
              }
              
              if (afterText) {
                parent.appendChild(document.createTextNode(afterText));
              }
            }
          } catch (error) {
            console.warn('Error applying font to text node:', error);
          }
        });
        
        // Restore selection to the last processed span
        if (lastSpan) {
          try {
            const newRange = document.createRange();
            newRange.selectNodeContents(lastSpan);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } catch (error) {
            console.warn('Could not restore selection:', error);
          }
        }
      }
    } catch (error) {
      console.warn('Font family change failed:', error);
      // Fallback to execCommand if all else fails
      try {
        document.execCommand('fontName', false, fontFamily);
      } catch (cmdError) {
        console.warn('execCommand fontName also failed:', cmdError);
      }
    }
    
    // Force updates
    setTimeout(() => {
      handleContentChange();
      updateActiveFormats();
    }, 10);
  }, [handleContentChange, updateActiveFormats]);

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
  // Handle input events
  const handleInput = useCallback(() => {
    handleContentChange();
    // Check for tag autocomplete trigger
    setTimeout(() => checkForTagTrigger(), 0);
  }, [handleContentChange, checkForTagTrigger]);

  // Handle composition events for international input
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
    if (onCompositionStateChange) onCompositionStateChange(true); // NEW
  }, [onCompositionStateChange]);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
    if (onCompositionStateChange) onCompositionStateChange(false); // NEW
    // Trigger content change after composition ends
    setTimeout(() => {
      handleContentChange();
    }, 0);
  }, [handleContentChange, onCompositionStateChange]);

  // Set HTML content when prop changes
  useEffect(() => {
    if (!editorRef.current || isComposing) return;
    
    const currentHtml = editorRef.current.innerHTML;
    
    if (html !== currentHtml && html !== lastSetHtml.current) {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const cursorOffset = range ? range.startOffset : 0;
      const anchorNode = range ? range.startContainer : null;      lastSetHtml.current = html;
      editorRef.current.innerHTML = html || '';
      
      // DISABLED: No longer auto-wrapping scripture references inline
      // if (editorRef.current && html) {
      //   setTimeout(() => {
      //     if (editorRef.current) {
      //       wrapScriptureRefsInEditor(editorRef.current);
      //     }
      //   }, 100);
      // }
      
      // Clean any existing scripture spans when setting new HTML
      if (editorRef.current && html) {
        setTimeout(() => {
          if (editorRef.current) {
            wrapScriptureRefsInEditor(editorRef.current); // This only clears spans now
          }
        }, 100);
      }
      
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
  // Custom button handlers
  const handleInsertImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string;
          if (editorRef.current) {
            editorRef.current.focus();
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.alt = file.name;
            
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.insertNode(img);
              range.setStartAfter(img);
              range.setEndAfter(img);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              editorRef.current.appendChild(img);
            }
            handleContentChange();
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }, [handleContentChange]);

  const handleInsertLink = useCallback(() => {
    const url = prompt('Enter the URL:');
    if (url && editorRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        // If there's selected text, make it a link
        document.execCommand('createLink', false, url);
      } else {
        // If no selection, create a link with the URL as text
        const a = document.createElement('a');
        a.href = url;
        a.textContent = url;
        a.target = '_blank';
        
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.insertNode(a);
          range.setStartAfter(a);
          range.setEndAfter(a);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      handleContentChange();
    }
  }, [handleContentChange]);

  const handleInsertTable = useCallback(() => {
    const rows = parseInt(prompt('Number of rows:') || '2', 10);
    const cols = parseInt(prompt('Number of columns:') || '2', 10);
    
    if (rows > 0 && cols > 0 && editorRef.current) {
      editorRef.current.focus();
      
      const table = document.createElement('table');
      table.style.borderCollapse = 'collapse';
      table.style.width = '100%';
      table.style.border = '1px solid #ccc';
      
      for (let i = 0; i < rows; i++) {
        const row = document.createElement('tr');
        for (let j = 0; j < cols; j++) {
          const cell = document.createElement(i === 0 ? 'th' : 'td');
          cell.style.border = '1px solid #ccc';
          cell.style.padding = '8px';
          cell.innerHTML = '&nbsp;';
          row.appendChild(cell);
        }
        table.appendChild(row);
      }
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.insertNode(table);
        range.setStartAfter(table);
        range.setEndAfter(table);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editorRef.current.appendChild(table);
      }
      handleContentChange();
    }  }, [handleContentChange]);

  const insertTagLink = useCallback((tag: Tag) => {
    if (!tagInputRange || !editorRef.current) return;

    // Create tag link element
    const tagLink = document.createElement('span');
    tagLink.className = 'tag-link';
    tagLink.textContent = normalizeTagForDisplay(tag.name);
    tagLink.setAttribute('data-tag-name', tag.name);
    tagLink.style.cssText = `
      background: linear-gradient(135deg, #065f46, #064e3b);
      color: #6ee7b7;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-block;
      margin: 0 2px;
      border: 1px solid #10b981;
      text-decoration: none;
    `;

    // Add click handler for the tag
    tagLink.onclick = (e) => {
      e.preventDefault();
      if (onTagSelect) {
        onTagSelect(tag.name);
      }
    };

    // Replace the "/tag" text with the tag link
    tagInputRange.deleteContents();
    tagInputRange.insertNode(tagLink);

    // Position cursor after the tag
    const newRange = document.createRange();
    newRange.setStartAfter(tagLink);
    newRange.collapse(true);
    
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(newRange);

    // Insert a space after the tag
    const spaceNode = document.createTextNode(' ');
    newRange.insertNode(spaceNode);
    newRange.setStartAfter(spaceNode);
    newRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(newRange);

    // Clean up
    setShowTagDropdown(false);
    setTagInputRange(null);
    handleContentChange();
  }, [tagInputRange, onTagSelect, handleContentChange, normalizeTagForDisplay]);

  const handleTagDropdownKeydown = useCallback((e: KeyboardEvent) => {
    if (!showTagDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedTagIndex(prev => Math.min(prev + 1, tagSuggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedTagIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (tagSuggestions[selectedTagIndex]) {
          insertTagLink(tagSuggestions[selectedTagIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowTagDropdown(false);
        setTagInputRange(null);
        break;
    }
  }, [showTagDropdown, tagSuggestions, selectedTagIndex, insertTagLink]);

  // Add keydown listener for tag dropdown
  useEffect(() => {
    if (showTagDropdown) {
      document.addEventListener('keydown', handleTagDropdownKeydown);
      return () => document.removeEventListener('keydown', handleTagDropdownKeydown);
    }
  }, [showTagDropdown, handleTagDropdownKeydown]);

  // Toolbar button configurations
  const toolbarButtons = [
    // Action Group (moved to front)
    { key: 'undo', command: 'undo', icon: '↶', title: 'Undo (Ctrl+Z)' },
    { key: 'redo', command: 'redo', icon: '↷', title: 'Redo (Ctrl+Shift+Z)' },
    { key: 'sep0', separator: true },
      // Media and Insert Group
    { key: 'insertImage', custom: 'insertImage', icon: '🖼️', title: 'Insert Image' },
    { key: 'insertLink', custom: 'insertLink', icon: '🔗', title: 'Insert Link' },
    { key: 'insertTable', custom: 'insertTable', icon: '📋', title: 'Insert Table' },
    { key: 'sep1', separator: true },
    
    // Font Controls Group
    { key: 'fontFamily', dropdown: true, type: 'fontFamily', title: 'Font Family' },
    { key: 'fontSize', dropdown: true, type: 'fontSize', title: 'Font Size' },
    { key: 'sep2', separator: true },
    
    // Text Formatting Group
    { key: 'bold', command: 'bold', icon: '𝐁', title: 'Bold (Ctrl+B)' },
    { key: 'italic', command: 'italic', icon: '𝐼', title: 'Italic (Ctrl+I)' },
    { key: 'underline', command: 'underline', icon: '𝐔', title: 'Underline (Ctrl+U)' },
    { key: 'strikethrough', command: 'strikeThrough', icon: 'S̶', title: 'Strikethrough' },
    { key: 'superscript', command: 'superscript', icon: 'X²', title: 'Superscript' },
    { key: 'subscript', command: 'subscript', icon: 'X₂', title: 'Subscript' },
    { key: 'removeFormat', command: 'removeFormat', icon: '✗', title: 'Clear Formatting' },
    { key: 'sep3', separator: true },
    
    // Color Controls Group
    { key: 'fontColor', color: true, type: 'foreColor', icon: '🎨', title: 'Font Color' },
    { key: 'backgroundColor', color: true, type: 'backColor', icon: '🖍', title: 'Background Color' },
    { key: 'sep4', separator: true },
    
    // Paragraph Group
    { key: 'heading', dropdown: true, type: 'heading', title: 'Paragraph Style' },
    { key: 'sep5', separator: true },
      // List and Alignment Group
    { key: 'ul', command: 'insertUnorderedList', icon: '•', title: 'Bullet List' },
    { key: 'ol', command: 'insertOrderedList', icon: '1.', title: 'Numbered List' },
    { key: 'sep6', separator: true },
      // Alignment Group
    { key: 'left', command: 'justifyLeft', icon: '◧', title: 'Align Left' },
    { key: 'center', command: 'justifyCenter', icon: '▬', title: 'Align Center' },
    { key: 'right', command: 'justifyRight', icon: '◨', title: 'Align Right' },
    { key: 'justify', command: 'justifyFull', icon: '▦', title: 'Justify' },
    { key: 'sep7', separator: true },
    
    // Indentation Group
    { key: 'outdent', command: 'outdent', icon: '⇤', title: 'Decrease Indent' },
    { key: 'indent', command: 'indent', icon: '⇥', title: 'Increase Indent' },
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
            if (button.type === 'fontFamily') {              return (
                <select
                  key={button.key}
                  className="toolbar-dropdown toolbar-font-family"
                  onChange={handleFontFamilyChange}
                  title={button.title}
                  value={currentFontFamily}
                >
                  <option value="Arial" style={{ fontFamily: 'Arial' }}>Arial</option>
                  <option value="Helvetica" style={{ fontFamily: 'Helvetica' }}>Helvetica</option>
                  <option value="Times New Roman" style={{ fontFamily: 'Times New Roman' }}>Times New Roman</option>
                  <option value="Georgia" style={{ fontFamily: 'Georgia' }}>Georgia</option>
                  <option value="Verdana" style={{ fontFamily: 'Verdana' }}>Verdana</option>
                  <option value="Courier New" style={{ fontFamily: 'Courier New' }}>Courier New</option>
                  <option value="Trebuchet MS" style={{ fontFamily: 'Trebuchet MS' }}>Trebuchet MS</option>
                  <option value="Tahoma" style={{ fontFamily: 'Tahoma' }}>Tahoma</option>
                  <option value="Comic Sans MS" style={{ fontFamily: 'Comic Sans MS' }}>Comic Sans MS</option>
                  <option value="Impact" style={{ fontFamily: 'Impact' }}>Impact</option>
                  <option value="'Roboto', sans-serif" style={{ fontFamily: "'Roboto', sans-serif" }}>Roboto</option>
                  <option value="'Open Sans', sans-serif" style={{ fontFamily: "'Open Sans', sans-serif" }}>Open Sans</option>
                  <option value="'Lato', sans-serif" style={{ fontFamily: "'Lato', sans-serif" }}>Lato</option>
                  <option value="'Montserrat', sans-serif" style={{ fontFamily: "'Montserrat', sans-serif" }}>Montserrat</option>
                  <option value="'Source Sans Pro', sans-serif" style={{ fontFamily: "'Source Sans Pro', sans-serif" }}>Source Sans Pro</option>
                  <option value="'Oswald', sans-serif" style={{ fontFamily: "'Oswald', sans-serif" }}>Oswald</option>
                  <option value="'Raleway', sans-serif" style={{ fontFamily: "'Raleway', sans-serif" }}>Raleway</option>
                  <option value="'PT Sans', sans-serif" style={{ fontFamily: "'PT Sans', sans-serif" }}>PT Sans</option>
                  <option value="'Ubuntu', sans-serif" style={{ fontFamily: "'Ubuntu', sans-serif" }}>Ubuntu</option>
                  <option value="'Nunito', sans-serif" style={{ fontFamily: "'Nunito', sans-serif" }}>Nunito</option>
                  <option value="'Playfair Display', serif" style={{ fontFamily: "'Playfair Display', serif" }}>Playfair Display</option>
                  <option value="'Merriweather', serif" style={{ fontFamily: "'Merriweather', serif" }}>Merriweather</option>
                  <option value="'Crimson Text', serif" style={{ fontFamily: "'Crimson Text', serif" }}>Crimson Text</option>
                  <option value="'Libre Baskerville', serif" style={{ fontFamily: "'Libre Baskerville', serif" }}>Libre Baskerville</option>
                  <option value="'Lora', serif" style={{ fontFamily: "'Lora', serif" }}>Lora</option>
                  <option value="'PT Serif', serif" style={{ fontFamily: "'PT Serif', serif" }}>PT Serif</option>
                  <option value="'Source Code Pro', monospace" style={{ fontFamily: "'Source Code Pro', monospace" }}>Source Code Pro</option>
                  <option value="'Fira Code', monospace" style={{ fontFamily: "'Fira Code', monospace" }}>Fira Code</option>
                  <option value="'JetBrains Mono', monospace" style={{ fontFamily: "'JetBrains Mono', monospace" }}>JetBrains Mono</option>
                  <option value="'Inconsolata', monospace" style={{ fontFamily: "'Inconsolata', monospace" }}>Inconsolata</option>
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
            );          }
            // Handle custom buttons
          if ('custom' in button) {
            return (
              <button
                key={button.key}
                type="button"
                className="toolbar-button"
                onClick={() => {
                  if (button.custom === 'insertImage') {
                    handleInsertImage();
                  } else if (button.custom === 'insertLink') {
                    handleInsertLink();
                  } else if (button.custom === 'insertTable') {
                    handleInsertTable();
                  }
                }}
                title={button.title}
              >
                {button.icon}
              </button>
            );
          }
          
          // Handle standard command buttons
          if ('command' in button) {
            const isActive = activeFormats.has(button.command);
          
            return (
              <button
                key={button.key}
                type="button"
                className={`toolbar-button ${isActive ? 'active' : ''}`}                onClick={() => {
                  if (button.command === 'insertUnorderedList') {
                    toggleList('ul');
                  } else if (button.command === 'insertOrderedList') {
                    toggleList('ol');
                  } else {
                    execCommand(button.command);
                  }
                }}
                title={button.title}
              >
                {button.icon}
              </button>
            );
          }
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
        {/* Tag Dropdown - Added for tag autocomplete */}
      {showTagDropdown && tagSuggestions.length > 0 && (
        <div 
          className="tag-dropdown" 
          style={{ 
            position: 'absolute',
            top: tagDropdownPosition.top, 
            left: tagDropdownPosition.left,
            background: '#1e293b',
            border: '1px solid #374151',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            minWidth: '200px'
          }}
        >
          {tagSuggestions.map((tag, index) => (
            <div
              key={tag.id}
              className={`tag-suggestion ${selectedTagIndex === index ? 'selected' : ''}`}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                color: selectedTagIndex === index ? '#facc15' : '#e5e7eb',
                background: selectedTagIndex === index ? '#374151' : 'transparent',
                borderBottom: index < tagSuggestions.length - 1 ? '1px solid #374151' : 'none'
              }}
              onMouseEnter={() => setSelectedTagIndex(index)}
              onClick={() => insertTagLink(tag)}
            >
              {normalizeTagForDisplay(tag.name)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BasicRTE;
