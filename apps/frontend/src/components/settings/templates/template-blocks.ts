import type {
  TemplateBlock,
  TemplateBlockType,
  TemplateButtonBlock,
  TemplateDividerBlock,
  TemplateHeadingBlock,
  TemplateImageBlock,
  TemplateRawHtmlBlock,
  TemplateRowBlock,
  TemplateSpacerBlock,
  TemplateTextBlock,
} from '@/types/templates';

export const createBlockId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `block_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
};

export const createBlock = (type: TemplateBlockType): TemplateBlock => {
  switch (type) {
    case 'heading':
      return {
        id: createBlockId(),
        type: 'heading',
        text: 'Exciting Announcement',
        level: 'h2',
        align: 'left',
        fontFamily: 'Arial',
      } satisfies TemplateHeadingBlock;
    case 'text':
      return {
        id: createBlockId(),
        type: 'text',
        text: 'Start typing your message here. You can reference merge variables like {{firstName}}.',
        align: 'left',
        fontFamily: 'Arial',
      } satisfies TemplateTextBlock;
    case 'button':
      return {
        id: createBlockId(),
        type: 'button',
        label: 'Call to Action',
        url: '#',
        align: 'center',
        backgroundColor: '#2563eb',
        textColor: '#ffffff',
      } satisfies TemplateButtonBlock;
    case 'image':
      return {
        id: createBlockId(),
        type: 'image',
        url: 'https://source.unsplash.com/random/600x240?workspace',
        altText: 'Optional alt text',
        width: 560,
        align: 'center',
        fullWidth: false,
        overlayText: undefined,
        overlayPosition: 'center',
        overlayTextColor: '#ffffff',
        overlayBackgroundColor: '#000000',
        overlayBackgroundOpacity: 50,
      } satisfies TemplateImageBlock;
    case 'divider':
      return {
        id: createBlockId(),
        type: 'divider',
        thickness: 1,
        color: '#e2e8f0',
      } satisfies TemplateDividerBlock;
    case 'spacer':
      return {
        id: createBlockId(),
        type: 'spacer',
        height: 24,
      } satisfies TemplateSpacerBlock;
    case 'row':
      return {
        id: createBlockId(),
        type: 'row',
        leftBlocks: [],
        rightBlocks: [],
        leftWidth: 50,
        rightWidth: 50,
        gap: 24,
      } satisfies TemplateRowBlock;
    case 'raw_html':
    default:
      return {
        id: createBlockId(),
        type: 'raw_html',
        html: '<!-- Custom HTML goes here -->',
      } satisfies TemplateRawHtmlBlock;
  }
};

export const createRawHtmlBlock = (html: string): TemplateRawHtmlBlock => ({
  id: createBlockId(),
  type: 'raw_html',
  html,
});

export const getDefaultTemplateBlocks = (): TemplateBlock[] => [
  {
    id: createBlockId(),
    type: 'heading',
    text: 'Welcome to division5',
    level: 'h1',
    align: 'left',
  },
  {
    id: createBlockId(),
    type: 'text',
    text: 'Hi {{firstName}},\n\nThanks for being part of our community. Here is a summary of what is happening this week.',
    align: 'left',
  },
  {
    id: createBlockId(),
    type: 'button',
    label: 'View Dashboard',
    url: '{{dashboardUrl}}',
    align: 'center',
    backgroundColor: '#2563eb',
    textColor: '#ffffff',
  },
  {
    id: createBlockId(),
    type: 'divider',
    thickness: 1,
    color: '#e2e8f0',
  },
  {
    id: createBlockId(),
    type: 'text',
    text: 'Need help? Reply to this email or reach out via {{supportEmail}}.',
    align: 'left',
  },
];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const normaliseText = (value: string) => escapeHtml(value).replace(/\n/g, '<br />');

const renderHeading = (block: TemplateHeadingBlock) => {
  const fontSize = block.level === 'h1' ? 28 : block.level === 'h2' ? 22 : 18;
  const fontFamily = block.fontFamily || 'Arial';
  const baseStyle = `margin:0; font-size:${fontSize}px; font-weight:600; color:#0f172a; line-height:1.3; text-align:${block.align}; font-family:${fontFamily}, sans-serif;`;
  const customStyle = block.customStyle ? ` ${block.customStyle}` : '';
  return `
  <tr>
    <td style="padding:24px 24px 12px; text-align:${block.align};">
      <${block.level} style="${baseStyle}${customStyle}">
        ${normaliseText(block.text)}
      </${block.level}>
    </td>
  </tr>
`;
};

const renderText = (block: TemplateTextBlock) => {
  const fontFamily = block.fontFamily || 'Arial';
  const baseStyle = `margin:0; font-size:15px; color:#1f2937; line-height:1.7; text-align:${block.align}; font-family:${fontFamily}, sans-serif;`;
  const customStyle = block.customStyle ? ` ${block.customStyle}` : '';
  return `
  <tr>
    <td style="padding:12px 24px; text-align:${block.align};">
      <p style="${baseStyle}${customStyle}">
        ${normaliseText(block.text)}
      </p>
    </td>
  </tr>
`;
};

const renderButton = (block: TemplateButtonBlock) => {
  const baseStyle = `
          display:inline-block;
          background-color:${block.backgroundColor};
          color:${block.textColor};
          padding:14px 28px;
          border-radius:6px;
          font-weight:600;
          text-decoration:none;
          text-align:center;
        `;
  const customStyle = block.customStyle ? ` ${block.customStyle}` : '';
  return `
  <tr>
    <td style="padding:16px 24px; text-align:${block.align};">
      <a
        href="${block.url}"
        style="${baseStyle}${customStyle}"
      >
        ${escapeHtml(block.label)}
      </a>
    </td>
  </tr>
`;
};

/**
 * Converts Google Drive sharing links to direct image URLs
 * Supports formats:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/file/d/FILE_ID
 */
export const convertGoogleDriveUrl = (url: string): string => {
  if (!url || typeof url !== 'string') {
    return url;
  }

  // Check if it's a Google Drive URL
  if (!url.includes('drive.google.com')) {
    return url;
  }

  // Extract file ID from various Google Drive URL formats
  let fileId: string | null = null;

  // Format: https://drive.google.com/file/d/FILE_ID/view or /edit or /preview
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) {
    fileId = fileIdMatch[1];
  } else {
    // Format: https://drive.google.com/open?id=FILE_ID
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      fileId = idMatch[1];
    }
  }

  if (fileId) {
    // Use backend proxy to bypass CORS restrictions from Google Drive
    // This allows images to load properly in iframes and email clients
    // Use absolute URL for iframe compatibility
    // uc?export=view returns the full resolution image
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    return `${apiUrl}/templates/proxy/google-drive-image?fileId=${fileId}`;
  }

  // If we can't extract the ID, return the original URL
  return url;
};

// Helper to convert hex color to rgba
const hexToRgba = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 0, 0, ${opacity})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const renderFullWidthImage = (block: TemplateImageBlock): string => {
  const imageUrl = convertGoogleDriveUrl(block.url);
  
  // Full-width images are rendered outside the main content table
  // They span the full viewport width
  if (block.overlayText) {
    const overlayOpacity = (block.overlayBackgroundOpacity ?? 50) / 100;
    const backgroundColor = hexToRgba(block.overlayBackgroundColor ?? '#000000', overlayOpacity);
    const positionStyles = {
      top: 'align-items:flex-start;',
      center: 'align-items:center;',
      bottom: 'align-items:flex-end;',
    }[block.overlayPosition ?? 'center'];
    
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; background-color:#f8fafc;">
      <tbody>
        <tr>
          <td style="padding:0;">
            <div style="position:relative; width:100%;">
              <img
                src="${imageUrl}"
                alt="${escapeHtml(block.altText)}"
                style="width:100%; max-width:100%; height:auto; display:block;${block.customStyle ? ` ${block.customStyle}` : ''}"
              />
              <div style="position:absolute; top:0; left:0; right:0; bottom:0; display:flex; ${positionStyles} justify-content:center; padding:20px; box-sizing:border-box;">
                <div style="background-color:${backgroundColor}; padding:12px 24px; border-radius:8px; width:100%; max-width:600px; box-sizing:border-box;">
                  <div style="color:${block.overlayTextColor ?? '#ffffff'}; font-size:18px; font-weight:600; text-align:center; line-height:1.5;">
                    ${escapeHtml(block.overlayText)}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  `;
  }
  
  const baseStyle = `width:100%; max-width:100%; height:auto; display:block;`;
  const customStyle = block.customStyle ? ` ${block.customStyle}` : '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; background-color:#f8fafc;">
      <tbody>
        <tr>
          <td style="padding:0;">
            <img
              src="${imageUrl}"
              alt="${escapeHtml(block.altText)}"
              style="${baseStyle}${customStyle}"
            />
          </td>
        </tr>
      </tbody>
    </table>
  `;
};

const renderImage = (block: TemplateImageBlock) => {
  // Full-width images are handled separately in renderBlocksToHtml
  if (block.fullWidth) {
    return ''; // Full-width images are rendered outside the main table
  }
  
  const imageUrl = convertGoogleDriveUrl(block.url);
  
  // If overlay text is provided, render image with overlay
  if (block.overlayText) {
    const overlayOpacity = (block.overlayBackgroundOpacity ?? 50) / 100;
    const backgroundColor = hexToRgba(block.overlayBackgroundColor ?? '#000000', overlayOpacity);
    const positionStyles = {
      top: 'align-items:flex-start;',
      center: 'align-items:center;',
      bottom: 'align-items:flex-end;',
    }[block.overlayPosition ?? 'center'];
    
    return `
  <tr>
    <td align="${block.align}" style="padding:20px 24px; text-align:${block.align};">
      <div style="position:relative; display:inline-block; max-width:100%; width:${block.width}px;${block.align === 'left' ? ' float:left;' : block.align === 'right' ? ' float:right;' : ''}">
        <img
          src="${imageUrl}"
          alt="${escapeHtml(block.altText)}"
          width="${block.width}"
          style="max-width:100%; border-radius:8px; display:block;${block.customStyle ? ` ${block.customStyle}` : ''}"
        />
        <div style="position:absolute; top:0; left:0; right:0; bottom:0; display:flex; ${positionStyles} justify-content:center; padding:20px; box-sizing:border-box;">
          <div style="background-color:${backgroundColor}; padding:12px 24px; border-radius:8px; width:100%; box-sizing:border-box;">
            <div style="color:${block.overlayTextColor ?? '#ffffff'}; font-size:18px; font-weight:600; text-align:center; line-height:1.5;">
              ${escapeHtml(block.overlayText)}
            </div>
          </div>
        </div>
      </div>
    </td>
  </tr>
`;
  }
  
  // Regular image without overlay
  const baseStyle = `max-width:100%; border-radius:8px; display:inline-block;`;
  const customStyle = block.customStyle ? ` ${block.customStyle}` : '';
  const floatStyle = block.align === 'left' ? ' float:left;' : block.align === 'right' ? ' float:right;' : '';
  return `
  <tr>
    <td align="${block.align}" style="padding:20px 24px; text-align:${block.align};">
      <img
        src="${imageUrl}"
        alt="${escapeHtml(block.altText)}"
        width="${block.width}"
        style="${baseStyle}${floatStyle}${customStyle}"
      />
    </td>
  </tr>
`;
};

const renderDivider = (block: TemplateDividerBlock) => {
  const baseStyle = `border:none; border-top:${block.thickness}px solid ${block.color}; margin:0;`;
  const customStyle = block.customStyle ? ` ${block.customStyle}` : '';
  return `
  <tr>
    <td style="padding:16px 24px;">
      <hr style="${baseStyle}${customStyle}" />
    </td>
  </tr>
`;
};

const renderSpacer = (block: TemplateSpacerBlock) => {
  const baseStyle = `height:${block.height}px;`;
  const customStyle = block.customStyle ? ` ${block.customStyle}` : '';
  return `
  <tr>
    <td style="padding:0 24px;">
      <div style="${baseStyle}${customStyle}"></div>
    </td>
  </tr>
`;
};

const renderRaw = (block: TemplateRawHtmlBlock) => `
  <tr>
    <td style="padding:0;">${block.html}</td>
  </tr>
`;

const renderRow = (block: TemplateRowBlock): string => {
  const leftWidth = block.leftWidth ?? 50;
  const rightWidth = block.rightWidth ?? 50;
  const gap = block.gap ?? 24;
  
  const leftContent = renderBlocksToHtmlInner(block.leftBlocks);
  const rightContent = renderBlocksToHtmlInner(block.rightBlocks);
  
  return `
  <tr>
    <td style="padding:20px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td width="${leftWidth}%" valign="top" style="padding-right:${gap / 2}px;">
            ${leftContent}
          </td>
          <td width="${rightWidth}%" valign="top" style="padding-left:${gap / 2}px;">
            ${rightContent}
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;
};

// Helper function to extract content from table row (for nested blocks in rows)
const extractTableContent = (html: string): string => {
  // Extract the content between <td> tags, removing the outer <tr><td> wrapper
  const match = html.match(/<tr>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/s);
  return match ? match[1] : html;
};

// Helper function to render blocks without the outer table structure (for nested blocks in rows)
const renderBlocksToHtmlInner = (blocks: TemplateBlock[]): string => {
  return blocks
    .map((block) => {
      let html = '';
      switch (block.type) {
        case 'heading':
          html = renderHeading(block);
          break;
        case 'text':
          html = renderText(block);
          break;
        case 'button':
          html = renderButton(block);
          break;
        case 'image':
          html = renderImage(block);
          break;
        case 'divider':
          html = renderDivider(block);
          break;
        case 'spacer':
          html = renderSpacer(block);
          break;
        case 'raw_html':
          html = renderRaw(block);
          break;
        case 'row':
          html = renderRow(block);
          break;
        default:
          return '';
      }
      // For nested blocks, extract just the content (remove outer <tr><td> wrapper)
      return extractTableContent(html);
    })
    .join('\n');
};

export const renderBlocksToHtml = (blocks: TemplateBlock[], pageWidth: number = 640): string => {
  // Separate full-width blocks from regular blocks
  const regularBlocks: TemplateBlock[] = [];
  const fullWidthBlocks: TemplateBlock[] = [];
  
  blocks.forEach((block) => {
    if (block.type === 'image' && block.fullWidth) {
      fullWidthBlocks.push(block);
    } else {
      regularBlocks.push(block);
    }
  });

  const inner = renderBlocksToHtmlInner(regularBlocks);
  
  // Render full-width images outside the main content table
  const fullWidthImages = fullWidthBlocks
    .filter((block): block is TemplateImageBlock => block.type === 'image')
    .map((block) => renderFullWidthImage(block))
    .join('\n');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Email Template</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f8fafc;">
        ${fullWidthImages}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; width:100%;">
          <tbody>
            <tr>
              <td align="center" style="padding:32px 12px;">
                <table role="presentation" width="${pageWidth}" cellpadding="0" cellspacing="0" style="width:${pageWidth}px; max-width:${pageWidth}px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 20px 40px -16px rgba(15, 23, 42, 0.15);">
                  <tbody>
                    ${inner}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;
};

const BLOCK_META_PREFIX = '<!--__TEMPLATE_BLOCKS__=';
const BLOCK_META_SUFFIX = '__-->';

const encodeToBase64 = (value: string) => {
  try {
    if (typeof window !== 'undefined' && window.btoa) {
      return window.btoa(unescape(encodeURIComponent(value)));
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Buffer is not available in browser, but this is handled in catch
    return Buffer.from(value, 'utf-8').toString('base64');
  } catch {
    return '';
  }
};

const decodeFromBase64 = (value: string) => {
  try {
    if (typeof window !== 'undefined' && window.atob) {
      return decodeURIComponent(escape(window.atob(value)));
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Buffer is not available in browser, but this is handled in catch
    return Buffer.from(value, 'base64').toString('utf-8');
  } catch {
    return '';
  }
};

export const injectBlockMetadata = (html: string, blocks: TemplateBlock[]): string => {
  try {
    const encoded = encodeToBase64(JSON.stringify(blocks));
    if (!encoded) {
      return html;
    }

    return `${BLOCK_META_PREFIX}${encoded}${BLOCK_META_SUFFIX}\n${html}`;
  } catch {
    return html;
  }
};

export const extractBlocksFromHtml = (
  html: string,
): { blocks: TemplateBlock[] | null; htmlWithoutMeta: string } => {
  const prefixIndex = html.indexOf(BLOCK_META_PREFIX);

  if (prefixIndex === -1) {
    return { blocks: null, htmlWithoutMeta: html };
  }

  const suffixIndex = html.indexOf(BLOCK_META_SUFFIX, prefixIndex);
  if (suffixIndex === -1) {
    return { blocks: null, htmlWithoutMeta: html };
  }

  const encoded = html.substring(
    prefixIndex + BLOCK_META_PREFIX.length,
    suffixIndex,
  );

  const cleanedHtml = `${html.slice(0, prefixIndex)}${html.slice(suffixIndex + BLOCK_META_SUFFIX.length)}`.trimStart();

  try {
    const json = decodeFromBase64(encoded);
    if (!json) {
      return { blocks: null, htmlWithoutMeta: cleanedHtml };
    }

    const parsed = JSON.parse(json) as TemplateBlock[];
    if (!Array.isArray(parsed)) {
      return { blocks: null, htmlWithoutMeta: cleanedHtml };
    }

    return { blocks: parsed, htmlWithoutMeta: cleanedHtml };
  } catch {
    return { blocks: null, htmlWithoutMeta: cleanedHtml };
  }
};

export const extractPageWidthFromHtml = (html: string): number => {
  // Try to extract page width from the table width attribute or style
  const widthMatch = html.match(/width="(\d+)"[^>]*style="[^"]*width:(\d+)px/);
  if (widthMatch) {
    const width = parseInt(widthMatch[1] || widthMatch[2], 10);
    if (!isNaN(width) && width > 0) {
      return width;
    }
  }
  
  // Fallback: try to match style="width:XXXpx"
  const styleMatch = html.match(/style="[^"]*width:(\d+)px/);
  if (styleMatch) {
    const width = parseInt(styleMatch[1], 10);
    if (!isNaN(width) && width > 0) {
      return width;
    }
  }
  
  // Default width
  return 640;
};


