import type {
  TemplateBlock,
  TemplateBlockType,
  TemplateButtonBlock,
  TemplateDivBlock,
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
        position: 'inline', // Default: respect block order
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
    case 'div':
      return {
        id: createBlockId(),
        type: 'div',
        blocks: [],
        backgroundColor: undefined,
        padding: 24,
        align: 'left',
        borderRadius: 0,
        borderColor: undefined,
        borderWidth: 0,
      } satisfies TemplateDivBlock;
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

const renderFullWidthImage = (block: TemplateImageBlock, stackedBlocks: TemplateBlock[] = []): string => {
  const imageUrl = convertGoogleDriveUrl(block.url);
  
  // Render all stacked blocks with proper z-index layering
  const stackedContent = renderStackedBlocks(stackedBlocks, 2);
  
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
              <div style="position:absolute; top:0; left:0; right:0; bottom:0; display:flex; ${positionStyles} justify-content:center; padding:20px; box-sizing:border-box; z-index:1;">
                <div style="background-color:${backgroundColor}; padding:12px 24px; border-radius:8px; width:100%; max-width:600px; box-sizing:border-box;">
                  <div style="color:${block.overlayTextColor ?? '#ffffff'}; font-size:18px; font-weight:600; text-align:center; line-height:1.5;">
                    ${escapeHtml(block.overlayText)}
                  </div>
                </div>
              </div>
              ${stackedContent}
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
            <div style="position:relative; width:100%;">
              <img
                src="${imageUrl}"
                alt="${escapeHtml(block.altText)}"
                style="${baseStyle}${customStyle}"
              />
              ${stackedContent}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  `;
};

// Helper function to render normal (non-full-width) images outside the main table
// Used when position is 'top' or 'bottom'
const renderNormalImageOutside = (block: TemplateImageBlock, stackedBlocks: TemplateBlock[] = []): string => {
  const imageUrl = convertGoogleDriveUrl(block.url);
  
  // Render all stacked blocks with proper z-index layering
  const stackedContent = renderStackedBlocks(stackedBlocks, 2);
  
  // If overlay text is provided, render image with overlay
  if (block.overlayText) {
    const overlayOpacity = (block.overlayBackgroundOpacity ?? 50) / 100;
    const backgroundColor = hexToRgba(block.overlayBackgroundColor ?? '#000000', overlayOpacity);
    const positionStyles = {
      top: 'align-items:flex-start;',
      center: 'align-items:center;',
      bottom: 'align-items:flex-end;',
    }[block.overlayPosition ?? 'center'];
    
    // For center alignment, use margin:0 auto; for left/right, rely on text-align
    const containerStyle = block.align === 'center' 
      ? `position:relative; display:block; max-width:100%; width:${block.width}px; margin:0 auto;`
      : `position:relative; display:inline-block; max-width:100%; width:${block.width}px;`;
    
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; background-color:#f8fafc;">
      <tbody>
        <tr>
          <td align="${block.align}" style="padding:20px 12px; text-align:${block.align};">
            <div style="${containerStyle}">
              <img
                src="${imageUrl}"
                alt="${escapeHtml(block.altText)}"
                width="${block.width}"
                style="max-width:100%; border-radius:8px; display:block;${block.customStyle ? ` ${block.customStyle}` : ''}"
              />
              <div style="position:absolute; top:0; left:0; right:0; bottom:0; display:flex; ${positionStyles} justify-content:center; padding:20px; box-sizing:border-box; z-index:1;">
                <div style="background-color:${backgroundColor}; padding:12px 24px; border-radius:8px; width:100%; box-sizing:border-box;">
                  <div style="color:${block.overlayTextColor ?? '#ffffff'}; font-size:18px; font-weight:600; text-align:center; line-height:1.5;">
                    ${escapeHtml(block.overlayText)}
                  </div>
                </div>
              </div>
              ${stackedContent}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  `;
  }
  
  // Regular image without overlay
  // For center alignment, use margin:0 auto; for left/right, rely on text-align
  const imageDisplayStyle = block.align === 'center' 
    ? `max-width:100%; border-radius:8px; display:block; margin:0 auto;`
    : `max-width:100%; border-radius:8px; display:block;`;
  const customStyle = block.customStyle ? ` ${block.customStyle}` : '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; background-color:#f8fafc;">
      <tbody>
        <tr>
          <td align="${block.align}" style="padding:20px 12px; text-align:${block.align};">
            <div style="position:relative; display:${block.align === 'center' ? 'block' : 'inline-block'};">
              <img
                src="${imageUrl}"
                alt="${escapeHtml(block.altText)}"
                width="${block.width}"
                style="${imageDisplayStyle}${customStyle}"
              />
              ${stackedContent}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  `;
};

const renderImage = (block: TemplateImageBlock, stackedBlocks: TemplateBlock[] = []) => {
  // Full-width images and normal images with top/bottom position are handled separately in renderBlocksToHtml
  if (block.fullWidth) {
    return ''; // Full-width images are rendered outside the main table
  }
  
  // Normal images with top/bottom position are also rendered outside the main table
  const position = block.position || 'inline';
  if (position === 'top' || position === 'bottom') {
    return ''; // These are rendered outside the main table
  }
  
  const imageUrl = convertGoogleDriveUrl(block.url);
  
  // Render all stacked blocks with proper z-index layering
  const stackedContent = renderStackedBlocks(stackedBlocks, 2);
  
  // If overlay text is provided, render image with overlay
  if (block.overlayText) {
    const overlayOpacity = (block.overlayBackgroundOpacity ?? 50) / 100;
    const backgroundColor = hexToRgba(block.overlayBackgroundColor ?? '#000000', overlayOpacity);
    const positionStyles = {
      top: 'align-items:flex-start;',
      center: 'align-items:center;',
      bottom: 'align-items:flex-end;',
    }[block.overlayPosition ?? 'center'];
    
    // For center alignment, use margin:0 auto; for left/right, rely on text-align
    const containerStyle = block.align === 'center' 
      ? `position:relative; display:block; max-width:100%; width:${block.width}px; margin:0 auto;`
      : `position:relative; display:inline-block; max-width:100%; width:${block.width}px;`;
    
    return `
  <tr>
    <td align="${block.align}" style="padding:20px 24px; text-align:${block.align};">
      <div style="${containerStyle}">
        <img
          src="${imageUrl}"
          alt="${escapeHtml(block.altText)}"
          width="${block.width}"
          style="max-width:100%; border-radius:8px; display:block;${block.customStyle ? ` ${block.customStyle}` : ''}"
        />
        <div style="position:absolute; top:0; left:0; right:0; bottom:0; display:flex; ${positionStyles} justify-content:center; padding:20px; box-sizing:border-box; z-index:1;">
          <div style="background-color:${backgroundColor}; padding:12px 24px; border-radius:8px; width:100%; box-sizing:border-box;">
            <div style="color:${block.overlayTextColor ?? '#ffffff'}; font-size:18px; font-weight:600; text-align:center; line-height:1.5;">
              ${escapeHtml(block.overlayText)}
            </div>
          </div>
        </div>
        ${stackedContent}
      </div>
    </td>
  </tr>
`;
  }
  
  // Regular image without overlay
  // For center alignment, use margin:0 auto; for left/right, rely on text-align
  const imageDisplayStyle = block.align === 'center' 
    ? `max-width:100%; border-radius:8px; display:block; margin:0 auto;`
    : `max-width:100%; border-radius:8px; display:block;`;
  const customStyle = block.customStyle ? ` ${block.customStyle}` : '';
  return `
  <tr>
    <td align="${block.align}" style="padding:20px 24px; text-align:${block.align};">
      <div style="position:relative; display:${block.align === 'center' ? 'block' : 'inline-block'};">
        <img
          src="${imageUrl}"
          alt="${escapeHtml(block.altText)}"
          width="${block.width}"
          style="${imageDisplayStyle}${customStyle}"
        />
        ${stackedContent}
      </div>
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

const renderDiv = (block: TemplateDivBlock, allBlocks: TemplateBlock[] = []): string => {
  const padding = block.padding ?? 24;
  const borderRadius = block.borderRadius ?? 0;
  const borderWidth = block.borderWidth ?? 0;
  const align = block.align ?? 'left';
  
  // Build style string
  let style = `padding:${padding}px;`;
  
  if (block.backgroundColor) {
    style += ` background-color:${block.backgroundColor};`;
  }
  
  if (borderRadius > 0) {
    style += ` border-radius:${borderRadius}px;`;
  }
  
  if (borderWidth > 0 && block.borderColor) {
    style += ` border:${borderWidth}px solid ${block.borderColor};`;
  }
  
  if (block.customStyle) {
    style += ` ${block.customStyle}`;
  }
  
  // Render nested blocks
  const nestedContent = renderBlocksToHtmlInner(block.blocks, allBlocks);
  
  return `
  <tr>
    <td style="padding:0 24px;" align="${align}">
      <div style="${style}">
        ${nestedContent}
      </div>
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

// Helper function to render multiple stacked blocks with proper z-index layering
const renderStackedBlocks = (stackedBlocks: TemplateBlock[], baseZIndex: number = 2): string => {
  if (stackedBlocks.length === 0) {
    return '';
  }
  
  return stackedBlocks
    .map((stackedBlock, index) => {
      const zIndex = baseZIndex + index;
      
      if (stackedBlock.type === 'image') {
        // Special handling for stacked images - extract the img tag directly
        const stackedImageBlock = stackedBlock as TemplateImageBlock;
        const stackedImageUrl = convertGoogleDriveUrl(stackedImageBlock.url);
        return `
        <div style="position:absolute; top:0; left:0; right:0; bottom:0; z-index:${zIndex}; pointer-events:none; display:flex; align-items:center; justify-content:center;">
          <img
            src="${stackedImageUrl}"
            alt="${escapeHtml(stackedImageBlock.altText)}"
            width="${stackedImageBlock.width || 560}"
            style="max-width:100%; max-height:100%; object-fit:contain; display:block;${stackedImageBlock.customStyle ? ` ${stackedImageBlock.customStyle}` : ''}"
          />
        </div>
      `;
      } else {
        const stackedHtml = renderSingleBlock(stackedBlock, [], []);
        // Extract content and wrap for absolute positioning
        // For text blocks, ensure they're visible with proper styling
        let stackedHtmlContent = extractTableContent(stackedHtml);
        if (stackedBlock.type === 'text' || stackedBlock.type === 'heading') {
          // Ensure text is visible with proper contrast - add text shadow and white color
          stackedHtmlContent = stackedHtmlContent.replace(
            /<p style="([^"]*)"/g,
            (match, style) => `<p style="${style} color:#ffffff; text-shadow:1px 1px 2px rgba(0,0,0,0.8);"`
          ).replace(
            /<(h[1-3]) style="([^"]*)"/g,
            (match, tag, style) => `<${tag} style="${style} color:#ffffff; text-shadow:1px 1px 2px rgba(0,0,0,0.8);"`
          );
        }
        return `
        <div style="position:absolute; top:0; left:0; right:0; bottom:0; z-index:${zIndex}; pointer-events:none; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;">
          <div style="width:100%; height:100%;">
            ${stackedHtmlContent}
          </div>
        </div>
      `;
      }
    })
    .join('\n');
};

// Helper function to render a single block (returns the HTML for the block)
const renderSingleBlock = (block: TemplateBlock, stackedBlocks: TemplateBlock[] = [], allBlocks: TemplateBlock[] = []): string => {
  switch (block.type) {
    case 'heading':
      return renderHeading(block);
    case 'text':
      return renderText(block);
    case 'button':
      return renderButton(block);
    case 'image':
      return renderImage(block as TemplateImageBlock, stackedBlocks);
    case 'divider':
      return renderDivider(block);
    case 'spacer':
      return renderSpacer(block);
    case 'raw_html':
      return renderRaw(block);
    case 'row':
      return renderRow(block);
    case 'div':
      return renderDiv(block as TemplateDivBlock, allBlocks);
    default:
      return '';
  }
};

// Helper function to render blocks with stacking support
const renderBlockWithStacking = (block: TemplateBlock, allBlocks: TemplateBlock[]): string => {
  // Check if this block is stacked on another block
  if (block.stackOnBlockId) {
    const baseBlock = allBlocks.find(b => b.id === block.stackOnBlockId);
    if (!baseBlock) {
      // Base block not found, render normally
      return renderSingleBlock(block, [], allBlocks);
    }
    
    // Special handling for images - they already handle stacking internally
    if (baseBlock.type === 'image') {
      const imageBlock = baseBlock as TemplateImageBlock;
      // Check if it's an inline image (not full-width and not top/bottom position)
      const position = imageBlock.position || 'inline';
      if (!imageBlock.fullWidth && position === 'inline') {
        // Find all blocks stacked on this image (including the current one)
        const allStackedBlocks = allBlocks.filter(b => b.stackOnBlockId === imageBlock.id);
        // Inline image - render with all stacked blocks
        return renderImage(imageBlock, allStackedBlocks);
      }
      // For images rendered outside, they're handled in renderBlocksToHtml
      return '';
    }
    
    // For non-image blocks, find all blocks stacked on the base block
    const allStackedBlocks = allBlocks.filter(b => b.stackOnBlockId === baseBlock.id);
    
    // For non-image blocks, render with absolute positioning
    const baseHtml = renderSingleBlock(baseBlock, [], allBlocks);
    
    // Render all stacked blocks with proper layering
    const stackedContent = renderStackedBlocks(allStackedBlocks, 2);
    
    // Extract content from base block
    const baseContent = extractTableContent(baseHtml);
    
    // Wrap in a relative container with all stacked blocks absolutely positioned
    // Use flexbox for centering when stacking on text blocks
    return `
      <tr>
        <td style="padding:0; position:relative;">
          <div style="position:relative; min-height:60px;">
            ${baseContent}
            ${stackedContent}
          </div>
        </td>
      </tr>
    `;
  }
  
  // Check if any other blocks are stacked on this block
  const stackedOnThis = allBlocks.filter(b => b.stackOnBlockId === block.id);
  if (stackedOnThis.length > 0 && block.type !== 'image') {
    // This block has other blocks stacked on it, but they will handle the container
    // Just render this block normally (the stacked blocks will handle the container)
    return renderSingleBlock(block, [], allBlocks);
  }
  
  // Normal rendering
  return renderSingleBlock(block, [], allBlocks);
};

// Helper function to render blocks without the outer table structure (for nested blocks in rows)
const renderBlocksToHtmlInner = (blocks: TemplateBlock[], allBlocks: TemplateBlock[] = blocks): string => {
  return blocks
    .map((block) => {
      // Skip blocks that are stacked on other blocks (they will be rendered as part of the base block)
      if (block.stackOnBlockId) {
        return '';
      }
      
      // Check if this block is already handled as part of a stack
      const isStackedOn = allBlocks.some(b => b.stackOnBlockId === block.id);
      if (isStackedOn) {
        // This block is the base of a stack, skip it here (it will be rendered by the stacked block)
        return '';
      }
      
      const html = renderBlockWithStacking(block, allBlocks);
      // For nested blocks, extract just the content (remove outer <tr><td> wrapper)
      return extractTableContent(html);
    })
    .filter(Boolean) // Remove empty strings
    .join('\n');
};

export const renderBlocksToHtml = (blocks: TemplateBlock[], pageWidth: number = 640): string => {
  // Helper to find all stacked blocks for an image
  const findStackedBlocks = (imageBlock: TemplateImageBlock): TemplateBlock[] => {
    return blocks.filter(b => b.stackOnBlockId === imageBlock.id);
  };
  
  // Separate blocks by type
  const regularBlocks: TemplateBlock[] = [];
  const topFullWidthImages: Array<{ block: TemplateImageBlock; stacked?: TemplateBlock[] }> = [];
  const bottomFullWidthImages: Array<{ block: TemplateImageBlock; stacked?: TemplateBlock[] }> = [];
  const inlineFullWidthImages: Array<{ block: TemplateImageBlock; index: number; stacked?: TemplateBlock[] }> = [];
  const topNormalImages: Array<{ block: TemplateImageBlock; stacked?: TemplateBlock[] }> = [];
  const bottomNormalImages: Array<{ block: TemplateImageBlock; stacked?: TemplateBlock[] }> = [];
  
  // Track which blocks are stacked on images (to skip them in regular rendering)
  const blocksStackedOnImages = new Set<string>();
  
  // Find the first and last regular block indices to determine inline positioning
  let firstRegularBlockIndex = -1;
  let lastRegularBlockIndex = -1;
  
  blocks.forEach((block, index) => {
    if (block.type === 'image') {
      // Skip images that are stacked on other blocks (they will be rendered as part of the base block)
      if (block.stackOnBlockId) {
        blocksStackedOnImages.add(block.id);
        return; // Skip this block, it will be rendered with its base block
      }
      
      const imageBlock = block as TemplateImageBlock;
      const position = imageBlock.position || 'inline';
      const stackedBlocks = findStackedBlocks(imageBlock);
      
      // Track all stacked blocks so they're not rendered separately
      stackedBlocks.forEach(stackedBlock => {
        blocksStackedOnImages.add(stackedBlock.id);
      });
      
      if (imageBlock.fullWidth) {
        // Full-width images
        if (position === 'top') {
          topFullWidthImages.push({ block: imageBlock, stacked: stackedBlocks });
        } else if (position === 'bottom') {
          bottomFullWidthImages.push({ block: imageBlock, stacked: stackedBlocks });
        } else {
          // 'inline' - position based on block order
          inlineFullWidthImages.push({ block: imageBlock, index, stacked: stackedBlocks });
        }
      } else {
        // Normal (non-full-width) images
        if (position === 'top') {
          topNormalImages.push({ block: imageBlock, stacked: stackedBlocks });
        } else if (position === 'bottom') {
          bottomNormalImages.push({ block: imageBlock, stacked: stackedBlocks });
        } else {
          // 'inline' - render inside main table, so add to regularBlocks
          regularBlocks.push(block);
          if (firstRegularBlockIndex === -1) {
            firstRegularBlockIndex = index;
          }
          lastRegularBlockIndex = index;
        }
      }
    } else {
      // Skip blocks that are stacked on images
      if (!blocksStackedOnImages.has(block.id)) {
        regularBlocks.push(block);
        if (firstRegularBlockIndex === -1) {
          firstRegularBlockIndex = index;
        }
        lastRegularBlockIndex = index;
      }
    }
  });

  const inner = renderBlocksToHtmlInner(regularBlocks, blocks);
  
  // Render full-width images with stacking support
  const renderFullWidthImageHtml = ({ block, stacked }: { block: TemplateImageBlock; stacked?: TemplateBlock[] }) => 
    renderFullWidthImage(block, stacked || []);
  
  // Render normal images outside table with stacking support
  const renderNormalImageHtml = ({ block, stacked }: { block: TemplateImageBlock; stacked?: TemplateBlock[] }) => 
    renderNormalImageOutside(block, stacked || []);
  
  const topFullWidth = topFullWidthImages.map(renderFullWidthImageHtml).join('\n');
  const bottomFullWidth = bottomFullWidthImages.map(renderFullWidthImageHtml).join('\n');
  const topNormal = topNormalImages.map(renderNormalImageHtml).join('\n');
  const bottomNormal = bottomNormalImages.map(renderNormalImageHtml).join('\n');
  
  // For inline full-width images, determine if they should go before or after main content
  const inlineFullWidthBefore: string[] = [];
  const inlineFullWidthAfter: string[] = [];
  
  inlineFullWidthImages.forEach(({ block, index, stacked }) => {
    if (firstRegularBlockIndex === -1) {
      // No regular blocks, all images go before
      inlineFullWidthBefore.push(renderFullWidthImageHtml({ block, stacked }));
    } else if (index < firstRegularBlockIndex) {
      // Image appears before any regular blocks
      inlineFullWidthBefore.push(renderFullWidthImageHtml({ block, stacked }));
    } else {
      // Image appears after or between regular blocks
      inlineFullWidthAfter.push(renderFullWidthImageHtml({ block, stacked }));
    }
  });
  
  const allImagesBefore = [
    topFullWidth,
    topNormal,
    ...inlineFullWidthBefore,
  ].filter(Boolean).join('\n');
  
  const allImagesAfter = [
    ...inlineFullWidthAfter,
    bottomNormal,
    bottomFullWidth,
  ].filter(Boolean).join('\n');

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
        ${allImagesBefore}
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
        ${allImagesAfter}
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

/**
 * Parses HTML and attempts to reconstruct blocks from the structure
 * This is a best-effort parser that looks for patterns matching the block system's output
 */
export const parseHtmlToBlocks = (html: string): TemplateBlock[] | null => {
  try {
    // First, try to extract blocks from metadata if present
    const { blocks: metadataBlocks } = extractBlocksFromHtml(html);
    if (metadataBlocks) {
      return metadataBlocks;
    }

    // Pre-process HTML to fix malformed table structure
    // If tbody has direct children without <tr><td>, wrap them
    let processedHtml = html;
    
    // Match tbody sections that might have direct children
    const tbodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/gi;
    let tbodyMatches = 0;
    let tbodyFixed = 0;
    
    processedHtml = processedHtml.replace(tbodyRegex, (match, tbodyContent) => {
      tbodyMatches++;
      
      // Check if this tbody already has proper structure (starts with <tr> after whitespace)
      const trimmedContent = tbodyContent.trim();
      if (!trimmedContent) {
        return match; // Empty tbody, leave as is
      }
      
      // If it starts with <tr>, it's likely properly formatted
      if (trimmedContent.startsWith('<tr')) {
        return match;
      }
      
      tbodyFixed++;
      
      // This tbody has direct children - we need to wrap each element in <tr><td>
      // Extract all top-level elements using a more robust approach
      const elements: string[] = [];
      let depth = 0;
      let currentElement = '';
      
      for (let i = 0; i < tbodyContent.length; i++) {
        const char = tbodyContent[i];
        currentElement += char;
        
        if (char === '<') {
          // Check if it's a closing tag
          if (tbodyContent[i + 1] === '/') {
            // Closing tag - extract tag name
            const closingTagMatch = tbodyContent.substring(i).match(/^<\/(\w+)>/);
            if (closingTagMatch) {
              depth--;
              if (depth === 0) {
                // End of a top-level element
                elements.push(currentElement);
                currentElement = '';
              }
            }
          } else if (tbodyContent[i + 1] !== '!') {
            // Opening tag - extract tag name
            const openingTagMatch = tbodyContent.substring(i).match(/^<(\w+)(?:\s|>|\/)/);
            if (openingTagMatch) {
              // Check if it's self-closing
              const selfClosingMatch = tbodyContent.substring(i).match(/^<\w+[^>]*\/>/);
              if (selfClosingMatch && depth === 0) {
                // Self-closing tag at top level
                currentElement = currentElement.substring(0, currentElement.length - 1) + selfClosingMatch[0];
                elements.push(currentElement);
                currentElement = '';
                i += selfClosingMatch[0].length - 1;
                continue;
              } else {
                depth++;
              }
            }
          }
        }
      }
      
      // Add any remaining content
      if (currentElement.trim()) {
        elements.push(currentElement);
      }
      
      // Wrap each element (that's not just whitespace) in <tr><td>
      const wrappedElements = elements
        .map((el) => {
          const trimmed = el.trim();
          if (!trimmed) {
            return ''; // Skip whitespace
          }
          
          // If it's already a <tr>, keep it as is
          if (trimmed.startsWith('<tr')) {
            return el;
          }
          
          // Wrap in <tr><td>
          return `<tr><td>${el}</td></tr>`;
        })
        .filter(el => el !== '');
      
      return `<tbody>${wrappedElements.join('')}</tbody>`;
    });

    // Create a temporary DOM parser
    const parser = new DOMParser();
    // Wrap in a full HTML document if it's just a fragment
    const htmlToParse = processedHtml.includes('<!DOCTYPE') || processedHtml.includes('<html') 
      ? processedHtml 
      : `<html><body>${processedHtml}</body></html>`;
    const doc = parser.parseFromString(htmlToParse, 'text/html');
    
    // Find the main content table (the one with the blocks)
    // Look for the table with specific width (not 100%) inside the centered td
    const centeredTd = doc.querySelector('td[align="center"]');
    let mainTable: Element | null = null;
    
    if (centeredTd) {
      // Find all tables inside the centered td and pick the one that's NOT width="100%"
      const tables = centeredTd.querySelectorAll('table[role="presentation"][width]');
      for (const table of Array.from(tables)) {
        const width = table.getAttribute('width');
        if (width && width !== '100%') {
          mainTable = table;
          break;
        }
      }
    }
    
    // Fallback: find any table with a specific width (not 100%)
    if (!mainTable) {
      const allTables = doc.querySelectorAll('table[role="presentation"][width], table[width]');
      for (const table of Array.from(allTables)) {
        const width = table.getAttribute('width');
        if (width && width !== '100%') {
          mainTable = table;
          break;
        }
      }
    }
    
    if (!mainTable) {
      // If no main table found, try to parse as a simple HTML fragment
      // Look for direct block elements
      const body = doc.body || doc.documentElement;
      if (body) {
        const blocks: TemplateBlock[] = [];
        
        // Check for headings
        const headings = body.querySelectorAll('h1, h2, h3');
        for (const heading of Array.from(headings)) {
          const level = heading.tagName.toLowerCase() as 'h1' | 'h2' | 'h3';
          let text = heading.innerHTML || '';
          text = text.replace(/<br\s*\/?>/gi, '\n');
          const tempDiv = doc.createElement('div');
          tempDiv.innerHTML = text;
          text = tempDiv.textContent || tempDiv.innerText || '';
          
          blocks.push({
            id: createBlockId(),
            type: 'heading',
            text,
            level,
            align: 'left',
          } satisfies TemplateHeadingBlock);
        }
        
        // Check for paragraphs
        const paragraphs = body.querySelectorAll('p');
        for (const paragraph of Array.from(paragraphs)) {
          let text = paragraph.innerHTML || '';
          text = text.replace(/<br\s*\/?>/gi, '\n');
          const tempDiv = doc.createElement('div');
          tempDiv.innerHTML = text;
          text = tempDiv.textContent || tempDiv.innerText || '';
          
          blocks.push({
            id: createBlockId(),
            type: 'text',
            text,
            align: 'left',
          } satisfies TemplateTextBlock);
        }
        
        if (blocks.length > 0) {
          return blocks;
        }
      }
      
      return null;
    }

    let tbody = mainTable.querySelector('tbody');
    if (!tbody) {
      return null;
    }
    
    // Check if childNodes has content but children doesn't (means text nodes only)
    if (tbody.children.length === 0 && tbody.childNodes.length > 0) {
      // The DOMParser stripped out the malformed content - we need to extract it from the original HTML
      // Find the table with width="320" in the original HTML
      const tableRegex = /<table[^>]*width="320"[^>]*>([\s\S]*?)<\/table>/i;
      const tableMatch = processedHtml.match(tableRegex);
      
      if (tableMatch) {
        const tableContent = tableMatch[1];
        
        // Extract the tbody content from this table
        const tbodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i;
        const tbodyMatch = tableContent.match(tbodyRegex);
        
        if (tbodyMatch) {
          const rawTbodyContent = tbodyMatch[1];
          
          // Extract all top-level elements from the raw content
          const elements: string[] = [];
          let depth = 0;
          let currentElement = '';
          
          for (let i = 0; i < rawTbodyContent.length; i++) {
            const char = rawTbodyContent[i];
            currentElement += char;
            
            if (char === '<') {
              if (rawTbodyContent[i + 1] === '/') {
                // Closing tag
                const closingTagMatch = rawTbodyContent.substring(i).match(/^<\/(\w+)>/);
                if (closingTagMatch) {
                  depth--;
                  if (depth === 0) {
                    elements.push(currentElement.trim());
                    currentElement = '';
                  }
                }
              } else if (rawTbodyContent[i + 1] !== '!') {
                // Opening tag or self-closing
                const tagMatch = rawTbodyContent.substring(i).match(/^<(\w+)(?:\s[^>]*)?(\/)?>/) ;
                if (tagMatch) {
                  if (tagMatch[2] === '/') {
                    // Self-closing tag
                    if (depth === 0) {
                      elements.push(currentElement.trim());
                      currentElement = '';
                    }
                  } else {
                    // Opening tag
                    depth++;
                  }
                }
              }
            }
          }
          
          // Add any remaining content
          if (currentElement.trim()) {
            elements.push(currentElement.trim());
          }
          
          // Create a properly formatted table with wrapped elements
          const wrappedElements = elements
            .filter(el => el.trim() && !el.match(/^\s*$/))
            .map(el => `<tr><td>${el}</td></tr>`);
          
          const fixedTableHtml = `<table role="presentation" width="320" cellpadding="0" cellspacing="0">
            <tbody>${wrappedElements.join('')}</tbody>
          </table>`;
          
          // Re-parse the fixed table
          const tempDoc = parser.parseFromString(`<html><body>${fixedTableHtml}</body></html>`, 'text/html');
          const fixedTable = tempDoc.querySelector('table');
          if (fixedTable) {
            tbody = fixedTable.querySelector('tbody');
          }
        }
      }
    }

    const blocks: TemplateBlock[] = [];

    // First, find and process full-width images that come BEFORE the main table
    // These are in tables with width="100%" that are NOT the main content wrapper
    const allTables = doc.querySelectorAll('table[role="presentation"][width="100%"]');
    const processedImageUrls = new Set<string>();
    
    for (const table of Array.from(allTables)) {
      // Skip if this is the main content wrapper (it contains a td[align="center"] with another table inside)
      const hasCenteredTdWithNestedTable = table.querySelector('td[align="center"] table[role="presentation"][width]');
      if (hasCenteredTdWithNestedTable) {
        continue; // This is the main content wrapper, not a full-width image table
      }
      
      // Check if this table contains an image (full-width image tables always have an img)
      const img = table.querySelector('img');
      if (img) {
        const url = img.getAttribute('src') || '';
        if (!url || processedImageUrls.has(url)) {
          continue; // Skip if already processed
        }
        processedImageUrls.add(url);
        
        const altText = img.getAttribute('alt') || '';
        const imgStyle = img.getAttribute('style') || '';
        
        // Verify it's actually full-width (has width:100% in style)
        if (!imgStyle.includes('width:100%') && !imgStyle.includes('width: 100%')) {
          continue;
        }
        
        // Check for overlay (nested div with absolute positioning)
        const overlayDiv = table.querySelector('div[style*="position:absolute"]');
        const overlayText = overlayDiv?.textContent?.trim();
        
        // Check overlay styles
        let overlayPosition: 'top' | 'center' | 'bottom' = 'center';
        let overlayTextColor = '#ffffff';
        let overlayBackgroundColor = '#000000';
        let overlayBackgroundOpacity = 50;
        
        if (overlayDiv) {
          const overlayStyles = overlayDiv.getAttribute('style') || '';
          if (overlayStyles.includes('align-items:flex-start')) overlayPosition = 'top';
          else if (overlayStyles.includes('align-items:flex-end')) overlayPosition = 'bottom';
          
          const textDiv = overlayDiv.querySelector('div');
          if (textDiv) {
            const textStyle = textDiv.getAttribute('style') || '';
            const textColorMatch = textStyle.match(/color:\s*([^;]+)/);
            const bgColorMatch = textStyle.match(/background-color:\s*([^;]+)/);
            
            if (textColorMatch) overlayTextColor = textColorMatch[1].trim();
            if (bgColorMatch) {
              // Check if it's rgba or hex
              const bgColor = bgColorMatch[1].trim();
              overlayBackgroundColor = bgColor;
              // Try to extract opacity from rgba
              const rgbaMatch = bgColor.match(/rgba?\(([^)]+)\)/);
              if (rgbaMatch) {
                const parts = rgbaMatch[1].split(',');
                if (parts.length === 4) {
                  overlayBackgroundOpacity = Math.round(parseFloat(parts[3].trim()) * 100);
                }
              }
            }
          }
        }
        
        // Add full-width image at the beginning (they come first in HTML)
        blocks.push({
          id: createBlockId(),
          type: 'image',
          url,
          altText,
          width: 640,
          align: 'center',
          fullWidth: true,
          position: 'inline', // Default to inline when parsing (user can change in editor)
          overlayText: overlayText || undefined,
          overlayPosition,
          overlayTextColor,
          overlayBackgroundColor,
          overlayBackgroundOpacity,
        } satisfies TemplateImageBlock);
      }
    }

    // Helper function to process a single element and return a block or null
    const processElement = (element: Element, parentAlign: 'left' | 'center' | 'right' = 'left'): TemplateBlock | null => {
      const tagName = element.tagName.toLowerCase();
      
      // Helper function to extract custom styles (remove parsed properties)
      const extractCustomStyle = (fullStyle: string, removeProperties: string[]): string | undefined => {
        if (!fullStyle.trim()) return undefined;
        
        // Remove properties we're already parsing
        let customStyle = fullStyle;
        removeProperties.forEach(prop => {
          // Remove property with its value: "property: value;"
          customStyle = customStyle.replace(new RegExp(`${prop}\\s*:[^;]+;?`, 'gi'), '');
        });
        
        // Clean up extra semicolons and spaces
        customStyle = customStyle.replace(/;\s*;/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '').trim();
        
        return customStyle || undefined;
      };

      // Check for heading (h1, h2, h3)
      if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
        const level = tagName as 'h1' | 'h2' | 'h3';
        // Preserve HTML entities and convert <br> to newlines
        let text = element.innerHTML || '';
        text = text.replace(/<br\s*\/?>/gi, '\n');
        // Decode HTML entities
        const tempDiv = doc.createElement('div');
        tempDiv.innerHTML = text;
        text = tempDiv.textContent || tempDiv.innerText || '';
        const style = element.getAttribute('style') || '';
        const fontFamilyMatch = style.match(/font-family:\s*([^;]+)/);
        const fontFamily = fontFamilyMatch ? fontFamilyMatch[1].split(',')[0].trim().replace(/['"]/g, '') : undefined;
        const alignMatch = style.match(/text-align:\s*([^;]+)/);
        const align = (alignMatch ? alignMatch[1].trim() : parentAlign) as 'left' | 'center' | 'right';
        // Preserve font-size, font-weight, font-style in customStyle (these override defaults)
        // Only remove properties that are stored in dedicated fields: text-align, font-family
        const customStyle = extractCustomStyle(style, ['text-align', 'font-family']);
        
        return {
          id: createBlockId(),
          type: 'heading',
          text,
          level,
          align: align || 'left',
          fontFamily,
          customStyle,
        } satisfies TemplateHeadingBlock;
      }

      // Check for paragraph (text block)
      if (tagName === 'p') {
        // Preserve HTML entities and convert <br> to newlines
        let text = element.innerHTML || '';
        text = text.replace(/<br\s*\/?>/gi, '\n');
        // Decode HTML entities
        const tempDiv = doc.createElement('div');
        tempDiv.innerHTML = text;
        text = tempDiv.textContent || tempDiv.innerText || '';
        const style = element.getAttribute('style') || '';
        const fontFamilyMatch = style.match(/font-family:\s*([^;]+)/);
        const fontFamily = fontFamilyMatch ? fontFamilyMatch[1].split(',')[0].trim().replace(/['"]/g, '') : undefined;
        const alignMatch = style.match(/text-align:\s*([^;]+)/);
        const align = (alignMatch ? alignMatch[1].trim() : parentAlign) as 'left' | 'center' | 'right';
        // Preserve font-size, font-style, font-weight, color, line-height, margin in customStyle
        // Only remove properties that are stored in dedicated fields: text-align, font-family
        const customStyle = extractCustomStyle(style, ['text-align', 'font-family']);
        
        return {
          id: createBlockId(),
          type: 'text',
          text,
          align: align || 'left',
          fontFamily,
          customStyle,
        } satisfies TemplateTextBlock;
      }

      // Check for button (anchor with specific styling)
      if (tagName === 'a' && element.getAttribute('href')) {
        const style = element.getAttribute('style') || '';
        const bgColorMatch = style.match(/background-color:\s*([^;]+)/);
        const textColorMatch = style.match(/color:\s*([^;]+)/);
        const backgroundColor = bgColorMatch ? bgColorMatch[1].trim() : '#2563eb';
        const textColor = textColorMatch ? textColorMatch[1].trim() : '#ffffff';
        const label = element.textContent || '';
        const url = element.getAttribute('href') || '#';
        const alignMatch = style.match(/text-align:\s*([^;]+)/);
        const align = (alignMatch ? alignMatch[1].trim() : 'center') as 'left' | 'center' | 'right';
        // Preserve padding, border-radius, font-weight, text-decoration, display in customStyle
        // Only remove properties stored in dedicated fields: background-color, color (textColor), text-align
        const customStyle = extractCustomStyle(style, ['background-color', 'color', 'text-align']);
        
        return {
          id: createBlockId(),
          type: 'button',
          label,
          url,
          align: align || 'center',
          backgroundColor,
          textColor,
          customStyle,
        } satisfies TemplateButtonBlock;
      }

      // Check for image
      if (tagName === 'img') {
        const url = element.getAttribute('src') || '';
        // Skip if this image was already processed as a full-width image
        if (processedImageUrls.has(url)) {
          return null;
        }
        
        const altText = element.getAttribute('alt') || '';
        const widthAttr = element.getAttribute('width');
        const width = widthAttr ? parseInt(widthAttr, 10) : 560;
        const style = element.getAttribute('style') || '';
        
        // IMPORTANT: Only mark as full-width if the IMAGE itself has width:100% in its style
        // Don't mark it as full-width just because it's in a full-width table wrapper
        const isFullWidth = (style.includes('width:100%') || style.includes('width: 100%')) && 
                           (style.includes('max-width:100%') || style.includes('max-width: 100%'));
        
        // Track this image URL to avoid duplicates
        if (url) {
          processedImageUrls.add(url);
        }
        
        // Check for overlay (look in parent elements)
        const parent = element.parentElement;
        const overlayDiv = parent?.querySelector('div[style*="position:absolute"]');
        const overlayText = overlayDiv?.textContent?.trim();
        
        // Determine align from float or text-align in style
        let align: 'left' | 'center' | 'right' = 'center';
        if (style.includes('float:left')) align = 'left';
        else if (style.includes('float:right')) align = 'right';
        
        // Preserve all styles in customStyle (width from attribute is stored in width field)
        // We use float/text-align to determine align, but preserve the original styles
        // Only remove nothing - all styles should be preserved as they might contain custom values
        const customStyle = extractCustomStyle(style, []);
        
        return {
          id: createBlockId(),
          type: 'image',
          url,
          altText,
          width,
          align,
          fullWidth: isFullWidth,
          position: isFullWidth ? 'inline' : undefined, // Default to inline for full-width images when parsing
          overlayText: overlayText || undefined,
          customStyle,
        } satisfies TemplateImageBlock;
      }

      // Check for divider (hr)
      if (tagName === 'hr') {
        const style = element.getAttribute('style') || '';
        const thicknessMatch = style.match(/border-top:\s*(\d+)px/);
        const colorMatch = style.match(/border-top:\s*\d+px\s+solid\s+([^;]+)/);
        const thickness = thicknessMatch ? parseInt(thicknessMatch[1], 10) : 1;
        const color = colorMatch ? colorMatch[1].trim() : '#e2e8f0';
        // Preserve margin and other border properties (border-left, border-right, etc.) in customStyle
        // Only remove border-top since we extract thickness and color from it
        const customStyle = extractCustomStyle(style, ['border-top']);
        
        return {
          id: createBlockId(),
          type: 'divider',
          thickness,
          color,
          customStyle,
        } satisfies TemplateDividerBlock;
      }

      // Check for spacer (empty div with height)
      if (tagName === 'div' && element.getAttribute('style')?.includes('height')) {
        // Check if this div only contains whitespace (spacer pattern)
        const textContent = element.textContent?.trim() || '';
        const hasOnlyWhitespace = !textContent || textContent.length === 0;
        
        // Also check if it has no children or only text nodes with whitespace
        const hasNoRealContent = hasOnlyWhitespace && 
          (element.children.length === 0 || 
           Array.from(element.children).every(child => !child.textContent?.trim()));
        
        if (hasNoRealContent) {
          const style = element.getAttribute('style') || '';
          const heightMatch = style.match(/height:\s*(\d+)px/);
          const height = heightMatch ? parseInt(heightMatch[1], 10) : 24;
          // Preserve all other styles (width, margin, padding, etc.) in customStyle
          // Only remove height since we extract it into the height field
          const customStyle = extractCustomStyle(style, ['height']);
          
          return {
            id: createBlockId(),
            type: 'spacer',
            height,
            customStyle,
          } satisfies TemplateSpacerBlock;
        }
      }

      // Check for row (nested table with two columns)
      if (tagName === 'table' && element.getAttribute('role') === 'presentation') {
        const nestedRows = element.querySelectorAll('tr');
        if (nestedRows.length > 0) {
          const firstRow = nestedRows[0];
          const cols = firstRow.querySelectorAll('td[width]');
          if (cols.length === 2) {
            const leftWidth = parseInt(cols[0].getAttribute('width') || '50', 10);
            const rightWidth = parseInt(cols[1].getAttribute('width') || '50', 10);
            const gapMatch = cols[0].getAttribute('style')?.match(/padding-right:\s*(\d+)px/) ||
                           cols[1].getAttribute('style')?.match(/padding-left:\s*(\d+)px/);
            const gap = gapMatch ? parseInt(gapMatch[1], 10) * 2 : 24;
            
            // Recursively parse left and right columns
            const leftContent = cols[0].innerHTML;
            const rightContent = cols[1].innerHTML;
            const leftBlocks = parseHtmlToBlocks(`<table><tbody>${leftContent}</tbody></table>`) || [];
            const rightBlocks = parseHtmlToBlocks(`<table><tbody>${rightContent}</tbody></table>`) || [];
            
            return {
              id: createBlockId(),
              type: 'row',
              leftBlocks,
              rightBlocks,
              leftWidth,
              rightWidth,
              gap,
            } satisfies TemplateRowBlock;
          }
        }
      }

      return null;
    };

    // Process all direct children of tbody in order
    // Handle both standard structure (<tr><td>) and malformed HTML (direct children)
    if (!tbody) return [];
    const tbodyChildren = Array.from(tbody.children);
    
    for (const child of tbodyChildren) {
      if (child.tagName.toLowerCase() === 'tr') {
        // Process <tr><td> structure
        const td = child.querySelector('td');
        if (td) {
          const textAlign = (td.getAttribute('align') || 
                            td.style.textAlign || 
                            'left') as 'left' | 'center' | 'right';
          
          // Process each direct child of td
          const tdChildren = Array.from(td.children);
          for (const tdChild of tdChildren) {
            const block = processElement(tdChild, textAlign);
            if (block) {
              blocks.push(block);
            } else {
              // If element doesn't match a pattern, create a raw HTML block
              const html = tdChild.outerHTML || tdChild.innerHTML || '';
              if (html.trim()) {
                blocks.push(createRawHtmlBlock(html.trim()));
              }
            }
          }
          
          // If td has content but no child elements, process it as raw HTML
          if (tdChildren.length === 0 && td.innerHTML.trim()) {
            blocks.push(createRawHtmlBlock(td.innerHTML.trim()));
          }
        }
      } else {
        // Process direct child of tbody (not in <tr>)
        const block = processElement(child, 'left');
        if (block) {
          blocks.push(block);
        } else {
          // If it doesn't match a block pattern, create a raw HTML block
          // Use outerHTML for self-closing tags (like <img>) and innerHTML for others
          const html = child.outerHTML || child.innerHTML || '';
          if (html.trim()) {
            blocks.push(createRawHtmlBlock(html.trim()));
          }
        }
      }
    }

    // Legacy fallback for standard structure if no blocks were found
    if (blocks.length === 0 && tbody) {
      // Standard structure: all elements are inside <tr><td>
      const rows = Array.from(tbody.querySelectorAll('tr'));
      for (const row of rows) {
        const td = row.querySelector('td');
        if (!td) continue;

        const textAlign = (td.getAttribute('align') || 
                          td.style.textAlign || 
                          'left') as 'left' | 'center' | 'right';

        // Process each direct child of td
        const tdChildren = Array.from(td.children);
        for (const child of tdChildren) {
          const block = processElement(child, textAlign);
          if (block) {
            blocks.push(block);
          }
        }

        // If td has content but no child elements, process it as raw HTML
        if (tdChildren.length === 0 && td.innerHTML.trim()) {
          blocks.push(createRawHtmlBlock(td.innerHTML.trim()));
        }
      }
    }

    return blocks.length > 0 ? blocks : null;
  } catch (error) {
    console.error('Error parsing HTML to blocks:', error);
    return null;
  }
};

