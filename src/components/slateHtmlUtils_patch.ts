// Patch for htmlToSlate to flatten nested paragraphs and prevent <p> inside <p>
import { htmlToSlate as serializerHtmlToSlate, slateToHtml as serializerSlateToHtml } from '@slate-serializers/html';

// FINAL robust flattenParagraphs: unwrap ALL <p> inside <li> (even if only child, or multiple)
function flattenParagraphs(nodes) {
  return nodes.map(node => {
    // Recursively flatten children first
    if (Array.isArray(node.children)) {
      node.children = flattenParagraphs(node.children);
    }
    // Unwrap paragraphs inside paragraphs (no <p> inside <p>)
    while (
      node.type === 'paragraph' &&
      Array.isArray(node.children) &&
      node.children.some(child => child.type === 'paragraph')
    ) {
      node.children = node.children.flatMap(child =>
        child.type === 'paragraph' && Array.isArray(child.children)
          ? flattenParagraphs(child.children)
          : [child]
      );
    }
    // Unwrap ALL <p> inside <li> (even if only child, or multiple)
    if (node.type === 'li' && Array.isArray(node.children)) {
      let changed = false;
      do {
        changed = false;
        node.children = node.children.flatMap(child => {
          if (child.type === 'paragraph' && Array.isArray(child.children)) {
            changed = true;
            return flattenParagraphs(child.children);
          }
          return [child];
        });
      } while (changed && node.children.some(child => child.type === 'paragraph'));
    }
    return node;
  });
}

// Validation: throw if any <p> is inside <li> or <p>
function validateNoNestedParagraphs(nodes, parentType = null) {
  for (const node of nodes) {
    if (node.type === 'paragraph' && (parentType === 'paragraph' || parentType === 'li')) {
      throw new Error('Invalid: <p> inside <' + parentType + '>');
    }
    if (Array.isArray(node.children)) {
      validateNoNestedParagraphs(node.children, node.type);
    }
  }
}

export function htmlToSlate(html: string) {
  try {
    let value = serializerHtmlToSlate(html);
    console.log('[htmlToSlate] Raw value:', JSON.stringify(value, null, 2));
    if (!Array.isArray(value) || value.length === 0) {
      return [{ type: 'paragraph', children: [{ text: '' }] }];
    }
    value = flattenParagraphs(value);
    // Validate after flattening
    try {
      validateNoNestedParagraphs(value);
    } catch (err) {
      console.error('[htmlToSlate] Validation error:', err);
    }
    console.log('[htmlToSlate] Flattened value:', JSON.stringify(value, null, 2));
    return value;
  } catch (e) {
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }
}

export function slateToHtml(slateValue: any) {
  try {
    return serializerSlateToHtml(slateValue);
  } catch (e) {
    return '';
  }
}
