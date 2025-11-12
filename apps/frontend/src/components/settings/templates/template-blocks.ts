import type {
  TemplateBlock,
  TemplateBlockType,
  TemplateButtonBlock,
  TemplateDividerBlock,
  TemplateHeadingBlock,
  TemplateImageBlock,
  TemplateRawHtmlBlock,
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
      } satisfies TemplateHeadingBlock;
    case 'text':
      return {
        id: createBlockId(),
        type: 'text',
        text: 'Start typing your message here. You can reference merge variables like {{firstName}}.',
        align: 'left',
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
  return `
    <tr>
      <td style="padding:24px 24px 12px; text-align:${block.align};">
        <${block.level} style="margin:0; font-size:${fontSize}px; font-weight:600; color:#0f172a; line-height:1.3; text-align:${block.align};">
          ${normaliseText(block.text)}
        </${block.level}>
      </td>
    </tr>
  `;
};

const renderText = (block: TemplateTextBlock) => `
  <tr>
    <td style="padding:12px 24px; text-align:${block.align};">
      <p style="margin:0; font-size:15px; color:#1f2937; line-height:1.7; text-align:${block.align};">
        ${normaliseText(block.text)}
      </p>
    </td>
  </tr>
`;

const renderButton = (block: TemplateButtonBlock) => `
  <tr>
    <td style="padding:16px 24px; text-align:${block.align};">
      <a
        href="${block.url}"
        style="
          display:inline-block;
          background-color:${block.backgroundColor};
          color:${block.textColor};
          padding:14px 28px;
          border-radius:6px;
          font-weight:600;
          text-decoration:none;
          text-align:center;
        "
      >
        ${escapeHtml(block.label)}
      </a>
    </td>
  </tr>
`;

const renderImage = (block: TemplateImageBlock) => `
  <tr>
    <td style="padding:20px 24px; text-align:${block.align};">
      <img
        src="${block.url}"
        alt="${escapeHtml(block.altText)}"
        width="${block.width}"
        style="max-width:100%; border-radius:8px; display:inline-block;"
      />
    </td>
  </tr>
`;

const renderDivider = (block: TemplateDividerBlock) => `
  <tr>
    <td style="padding:16px 24px;">
      <hr style="border:none; border-top:${block.thickness}px solid ${block.color}; margin:0;" />
    </td>
  </tr>
`;

const renderSpacer = (block: TemplateSpacerBlock) => `
  <tr>
    <td style="padding:0 24px;">
      <div style="height:${block.height}px;"></div>
    </td>
  </tr>
`;

const renderRaw = (block: TemplateRawHtmlBlock) => `
  <tr>
    <td style="padding:0;">${block.html}</td>
  </tr>
`;

export const renderBlocksToHtml = (blocks: TemplateBlock[]): string => {
  const inner = blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
          return renderHeading(block);
        case 'text':
          return renderText(block);
        case 'button':
          return renderButton(block);
        case 'image':
          return renderImage(block);
        case 'divider':
          return renderDivider(block);
        case 'spacer':
          return renderSpacer(block);
        case 'raw_html':
        default:
          return renderRaw(block as TemplateRawHtmlBlock);
      }
    })
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; width:100%;">
          <tbody>
            <tr>
              <td align="center" style="padding:32px 12px;">
                <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px; max-width:640px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 20px 40px -16px rgba(15, 23, 42, 0.15);">
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

    // @ts-ignore
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

    // @ts-ignore
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


