/**
 * XSS Protection Utilities
 * 
 * These utilities help prevent Cross-Site Scripting (XSS) attacks by
 * sanitizing user input and safely rendering HTML content.
 */

/**
 * Escapes HTML special characters to prevent XSS
 * Converts <, >, &, ", ' to their HTML entity equivalents
 */
export function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return '';
  }

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Sanitizes a string by removing potentially dangerous characters
 * Useful for user input that will be displayed as plain text
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  
  // Remove null bytes and control characters (except newlines and tabs)
  return input
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

// Allowed CSS properties for style attribute (whitelist approach)
const allowedStyleProperties = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'color',
  'background-color',
  'text-align',
  'text-decoration',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-color',
];

/**
 * Sanitizes a style attribute value to only allow safe CSS properties
 */
function sanitizeStyleAttribute(styleValue: string): string {
  if (!styleValue) return '';

  // Parse CSS declarations
  const declarations: string[] = [];
  const parts = styleValue.split(';').map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;

    const property = part.substring(0, colonIndex).trim().toLowerCase();
    const value = part.substring(colonIndex + 1).trim();

    // Only allow whitelisted CSS properties
    if (allowedStyleProperties.includes(property)) {
      // Additional validation for specific properties
      if (property === 'color' || property === 'background-color') {
        // Allow hex colors, rgb/rgba, and named colors
        if (
          /^#[0-9a-f]{3,8}$/i.test(value) ||
          /^rgb\(/i.test(value) ||
          /^rgba\(/i.test(value) ||
          /^[a-z]+$/i.test(value) // Named colors
        ) {
          declarations.push(`${property}: ${value}`);
        }
      } else if (property === 'font-size') {
        // Allow px, em, rem, %, pt units
        if (/^\d+(\.\d+)?(px|em|rem|%|pt)$/i.test(value)) {
          declarations.push(`${property}: ${value}`);
        }
      } else if (property === 'text-align') {
        // Allow only safe text-align values
        if (['left', 'right', 'center', 'justify'].includes(value.toLowerCase())) {
          declarations.push(`${property}: ${value}`);
        }
      } else if (property === 'font-family') {
        // Allow font-family values (sanitize quotes)
        const sanitized = value.replace(/[<>]/g, '');
        declarations.push(`${property}: ${sanitized}`);
      } else {
        // For other allowed properties, do basic sanitization
        const sanitized = value.replace(/[<>]/g, '');
        declarations.push(`${property}: ${sanitized}`);
      }
    }
  }

  return declarations.join('; ');
}

/**
 * Sanitizes HTML content by allowing only safe tags and attributes
 * This is a basic implementation - for production, consider using DOMPurify
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';

  // List of allowed HTML tags (whitelist approach)
  const allowedTags = [
    'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'table', 'thead',
    'tbody', 'tr', 'td', 'th', 'div', 'span', 'hr', 'mark', // mark is used by TipTap for highlighting
  ];

  // List of allowed attributes
  const allowedAttributes: Record<string, string[]> = {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    table: ['border', 'cellpadding', 'cellspacing'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    // Allow style attribute on all elements for rich text formatting
    '*': ['style'],
  };

  // Create a temporary DOM element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Recursively sanitize elements
  function sanitizeElement(element: Element): void {
    const tagName = element.tagName.toLowerCase();

    // Remove disallowed tags
    if (!allowedTags.includes(tagName)) {
      const parent = element.parentNode;
      if (parent) {
        while (element.firstChild) {
          parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
      }
      return;
    }

    // Remove disallowed attributes
    const allowedAttrs = [
      ...(allowedAttributes[tagName] || []),
      ...(allowedAttributes['*'] || []), // Global attributes
    ];
    Array.from(element.attributes).forEach((attr) => {
      const attrName = attr.name.toLowerCase();
      if (!allowedAttrs.includes(attrName)) {
        element.removeAttribute(attr.name);
      } else if (attrName === 'style') {
        // Sanitize style attribute to only allow safe CSS properties
        const sanitizedStyle = sanitizeStyleAttribute(attr.value);
        if (sanitizedStyle) {
          element.setAttribute('style', sanitizedStyle);
        } else {
          element.removeAttribute('style');
        }
      }
    });

    // Sanitize href attributes to prevent javascript: and data: URLs
    if (tagName === 'a' && element.hasAttribute('href')) {
      const href = element.getAttribute('href') || '';
      if (href.startsWith('javascript:') || href.startsWith('data:')) {
        element.removeAttribute('href');
      } else {
        // Ensure external links have rel="noopener noreferrer"
        if (href.startsWith('http://') || href.startsWith('https://')) {
          element.setAttribute('rel', 'noopener noreferrer');
          element.setAttribute('target', '_blank');
        }
      }
    }

    // Sanitize src attributes for images
    if (tagName === 'img' && element.hasAttribute('src')) {
      const src = element.getAttribute('src') || '';
      if (src.startsWith('javascript:') || src.startsWith('data:')) {
        element.removeAttribute('src');
      }
    }

    // Recursively sanitize children
    Array.from(element.children).forEach((child) => {
      sanitizeElement(child as Element);
    });
  }

  // Sanitize all elements
  Array.from(temp.children).forEach((child) => {
    sanitizeElement(child as Element);
  });

  return temp.innerHTML;
}

/**
 * Validates and sanitizes a URL
 * Returns null if URL is invalid or dangerous
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url, window.location.origin);
    
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerousProtocols.some((proto) => parsed.protocol.toLowerCase().startsWith(proto))) {
      return null;
    }

    // Only allow http, https, and relative URLs
    if (!['http:', 'https:', ''].includes(parsed.protocol.toLowerCase())) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitizes user input for use in HTML attributes
 */
export function sanitizeAttribute(value: string | null | undefined): string {
  if (!value) return '';
  
  return escapeHtml(value)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Creates a safe text node (prevents XSS by escaping)
 */
export function createSafeTextNode(text: string | null | undefined): Text {
  return document.createTextNode(sanitizeText(text || ''));
}

