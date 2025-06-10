import { Descendant, Element as SlateElement, Text } from 'slate';

function isTextNode(node: any): node is Text {
  return typeof node === 'object' && node !== null && 'text' in node;
}

function deserialize(el: ChildNode): Descendant[] {
  if (el.nodeType === 3) {
    // Text node
    return [{ text: el.textContent || '' }];
  }
  if (el.nodeType !== 1) {
    // Not an element or text
    return [];
  }
  const element = el as HTMLElement;
  const nodeName = element.nodeName.toLowerCase();
  let children: Descendant[] = Array.from(element.childNodes).flatMap(deserialize);
  if (children.length === 0) {
    children = [{ text: '' }];
  }
  switch (nodeName) {
    case 'br':
      return [{ text: '\n' }];
    case 'strong':
      return children.map(child => isTextNode(child) ? { ...child, bold: true } : child);
    case 'em':
    case 'i':
      return children.map(child => isTextNode(child) ? { ...child, italic: true } : child);
    case 'u':
      return children.map(child => isTextNode(child) ? { ...child, underline: true } : child);
    case 'code':
      return children.map(child => isTextNode(child) ? { ...child, code: true } : child);
    case 'p':
      return [{ type: 'paragraph', children } as SlateElement];
    case 'h1':
      return [{ type: 'heading-one', children } as SlateElement];
    case 'h2':
      return [{ type: 'heading-two', children } as SlateElement];
    case 'h3':
      return [{ type: 'heading-three', children } as SlateElement];
    case 'h4':
      return [{ type: 'heading-four', children } as SlateElement];
    case 'h5':
      return [{ type: 'heading-five', children } as SlateElement];
    case 'h6':
      return [{ type: 'heading-six', children } as SlateElement];
    case 'ul':
      return [{ type: 'bulleted-list', children } as SlateElement];
    case 'ol':
      return [{ type: 'numbered-list', children } as SlateElement];
    case 'li':
      return [{ type: 'list-item', children } as SlateElement];
    case 'blockquote':
      return [{ type: 'blockquote', children } as SlateElement];
    case 'a':
      return children.map(child => isTextNode(child)
        ? { ...child, url: element.getAttribute('href'), type: 'link' } as any
        : child
      );
    default:
      return children;
  }
}

export function htmlToSlate(html: string): Descendant[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  const fragment = Array.from(body.childNodes).flatMap(deserialize);
  return fragment.length > 0 ? fragment : [{ type: 'paragraph', children: [{ text: '' }] } as SlateElement];
}

export function slateToHtml(nodes: Descendant[]): string {
  return nodes.map(serializeNode).join('');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function serializeNode(node: Descendant): string {
  if (Text.isText(node)) {
    let text = escapeHtml(node.text);
    if ((node as any).bold) text = `<strong>${text}</strong>`;
    if ((node as any).italic) text = `<em>${text}</em>`;
    if ((node as any).underline) text = `<u>${text}</u>`;
    if ((node as any).code) text = `<code>${text}</code>`;
    return text;
  }
  // Element node
  const children = (node as any).children.map(serializeNode).join('');
  switch ((node as any).type) {
    case 'paragraph': return `<p>${children}</p>`;
    case 'heading-one': return `<h1>${children}</h1>`;
    case 'heading-two': return `<h2>${children}</h2>`;
    case 'heading-three': return `<h3>${children}</h3>`;
    case 'heading-four': return `<h4>${children}</h4>`;
    case 'heading-five': return `<h5>${children}</h5>`;
    case 'heading-six': return `<h6>${children}</h6>`;
    case 'bulleted-list': return `<ul>${children}</ul>`;
    case 'numbered-list': return `<ol>${children}</ol>`;
    case 'list-item': return `<li>${children}</li>`;
    case 'blockquote': return `<blockquote>${children}</blockquote>`;
    case 'link': return `<a href="${(node as any).url}">${children}</a>`;
    case 'horizontal-rule': return `<hr />`;
    default: return `<div>${children}</div>`;
  }
}
