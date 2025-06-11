import { extractScriptureReferences } from "../utils/smartParseScriptureInput";
import { bookAliases } from "../hooks/useScriptureAutocomplete";

export function wrapScriptureRefsInEditor(editorEl: HTMLElement) {
  if (!editorEl) return;

  // Just clear any existing scripture spans - no longer wrapping new ones
  const existingSpans = editorEl.querySelectorAll("span.scripture-ref");
  existingSpans.forEach(span => {
    const parent = span.parentNode;
    if (!parent) return;
    
    // Create text node with the content, preserving surrounding elements
    const textNode = document.createTextNode(span.textContent || "");
    parent.replaceChild(textNode, span);
    
    // Normalize to merge adjacent text nodes (helps with subsequent processing)
    parent.normalize();
  });
}

function restoreCursorPosition(editorEl: HTMLElement, cursorInfo: { container: Node; offset: number; textContent: string }, selection: Selection) {
  // Try to find a text node that matches our stored cursor info
  const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();
  let bestMatch: { node: Node; offset: number } | null = null;
  
  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      // Check for exact match first
      if (currentNode.textContent === cursorInfo.textContent) {
        // Check if this text node is inside a scripture reference span
        let parentSpan = currentNode.parentElement;
        let isInScriptureSpan = false;
        
        while (parentSpan && parentSpan !== editorEl) {
          if (parentSpan.classList.contains('scripture-ref')) {
            isInScriptureSpan = true;
            break;
          }
          parentSpan = parentSpan.parentElement;
        }
        
        if (isInScriptureSpan) {
          // If cursor was inside a scripture reference, place it after the span
          // but only if the offset was at the end of the text
          if (cursorInfo.offset >= (cursorInfo.textContent.length - 1)) {
            const scriptureSpan = parentSpan!;
            const nextNode = scriptureSpan.nextSibling;
            if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
              bestMatch = { node: nextNode, offset: 0 };
            } else {
              // Create a space after the scripture span if needed
              const spaceNode = document.createTextNode(' ');
              scriptureSpan.parentNode!.insertBefore(spaceNode, scriptureSpan.nextSibling);
              bestMatch = { node: spaceNode, offset: 1 };
            }
          } else {
            // Cursor was in the middle of the reference, keep it there
            bestMatch = { 
              node: currentNode, 
              offset: Math.min(cursorInfo.offset, currentNode.textContent.length) 
            };
          }
        } else {
          // If not inside a scripture span, restore normal position
          bestMatch = { 
            node: currentNode, 
            offset: Math.min(cursorInfo.offset, currentNode.textContent.length) 
          };
        }
        break;
      }
      
      // If no exact match, look for partial matches (for when text was split)
      if (!bestMatch && cursorInfo.textContent.includes(currentNode.textContent || '')) {
        bestMatch = { 
          node: currentNode, 
          offset: Math.min(cursorInfo.offset, currentNode.textContent?.length || 0) 
        };
      }
    }
    currentNode = walker.nextNode();
  }
  
  // Restore cursor position
  if (bestMatch) {
    const range = document.createRange();
    range.setStart(bestMatch.node, bestMatch.offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    // Fallback: place cursor at the end of the editor
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function findAndWrapText(rootNode: HTMLElement, matchText: string) {
  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const idx = node.textContent?.indexOf(matchText) ?? -1;
    if (idx >= 0 && node.parentElement) {
      // Don't wrap if already inside a scripture-ref span
      let checkParent: Element | null = node.parentElement;
      while (checkParent && checkParent !== rootNode) {
        if (checkParent.classList.contains('scripture-ref')) {
          return; // Skip - already wrapped
        }
        checkParent = checkParent.parentElement;
      }

      const parent = node.parentNode!;
      const nodeText = node.textContent!;
      
      // Create text nodes for before and after the match
      const beforeText = nodeText.slice(0, idx);
      const afterText = nodeText.slice(idx + matchText.length);

      // Create the scripture reference span
      const span = document.createElement("span");
      span.className = "scripture-ref";
      span.dataset.ref = matchText;
      span.textContent = matchText;
      span.onclick = () => {
        const event = new CustomEvent("showScriptureOverlay", {
          detail: parseReference(matchText)
        });
        window.dispatchEvent(event);
      };

      // Store current selection info before DOM manipulation
      const selection = window.getSelection();
      let wasAtEnd = false;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        wasAtEnd = range.startContainer === node && range.startOffset >= idx + matchText.length;
      }

      // Remove the original text node
      parent.removeChild(node);
        // Insert new nodes in order: before text, span, after text
      if (beforeText) {
        const beforeNode = document.createTextNode(beforeText);
        parent.appendChild(beforeNode);
      }
      
      parent.appendChild(span);
      
      if (afterText) {
        const afterNode = document.createTextNode(afterText);
        parent.appendChild(afterNode);
        
        // If cursor was at the end of the reference, place it at start of after text
        if (wasAtEnd && selection) {
          const newRange = document.createRange();
          newRange.setStart(afterNode, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      } else if (wasAtEnd && selection) {
        // If no after text and cursor was at end, create a space after the span
        const spaceNode = document.createTextNode(' ');
        parent.appendChild(spaceNode);
        const newRange = document.createRange();
        newRange.setStart(spaceNode, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
      
      // Normalize to clean up adjacent text nodes
      parent.normalize();
      break;
    }
  }
}

function parseReference(ref: string) {
  // Try to parse as chapter:verse first
  const verseMatch = ref.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (verseMatch) {
    const [, book, chapter, verse, endVerse] = verseMatch;
    return {
      book: book.trim(),
      chapter: parseInt(chapter, 10),
      verse: parseInt(verse, 10),
      endVerse: endVerse ? parseInt(endVerse, 10) : parseInt(verse, 10),
      reference: ref
    };
  }
  
  // Try to parse as chapter-only (e.g., "Genesis 1")
  const chapterMatch = ref.match(/^(.+?)\s+(\d+)$/);
  if (chapterMatch) {
    const [, book, chapter] = chapterMatch;
    return {
      book: book.trim(),
      chapter: parseInt(chapter, 10),
      verse: undefined, // No specific verse - whole chapter
      endVerse: undefined,
      reference: ref
    };
  }
  
  // Fallback parsing
  const parts = ref.split(' ');
  const chapter = parseInt(parts[parts.length - 1], 10);
  const book = parts.slice(0, -1).join(' ');
  
  return {
    book: book,
    chapter: isNaN(chapter) ? 1 : chapter,
    verse: undefined,
    endVerse: undefined,
    reference: ref
  };
}

// Debounced version of the scripture wrapping function
export function debounceWrapScriptureRefs(editorEl: HTMLElement, delay: number = 800) {
  let timeoutId: NodeJS.Timeout;
  
  return function() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (editorEl) {
        wrapScriptureRefsInEditor(editorEl);
      }
    }, delay);
  };
}
