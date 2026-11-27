import sanitizeHtml from 'sanitize-html';
import { text } from '../operations/rules';

export function cleanProductDetails(value: unknown): string {
    const html = sanitizeHtml(text(value, 100000), {
        allowedTags: [
            'p',
            'br',
            'strong',
            'b',
            'em',
            'i',
            'ul',
            'ol',
            'li',
            'h3',
            'img',
        ],
        allowedAttributes: { img: ['src', 'alt'] },
        allowedSchemes: ['http', 'https'],
        allowProtocolRelative: false,
        exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
    }).trim();
    // An empty rich-text document can contain paragraph and line-break tags.
    const visible = sanitizeHtml(html, {
        allowedTags: [],
        allowedAttributes: {},
    });
    const hasContent = Boolean(visible.replace(/&nbsp;|\s/g, '')) || html.includes('<img ');
    return hasContent ? html : '';
}
