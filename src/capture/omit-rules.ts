const OMIT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'NAV', 'FOOTER', 'ASIDE', 'SVG', 'CANVAS']);
const NOISE = /(^|[-_\s])(advertisement|advert|social-share|share-tools|cookie-banner|newsletter-signup|related-posts|sr-only|visually-hidden)([-_\s]|$)/i;

export function shouldOmit(element: Element): boolean {
    if (OMIT.has(element.tagName.toUpperCase()))
        return true;

    if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true')
        return true;

    if (['navigation', 'complementary', 'dialog', 'menu'].includes(element.getAttribute('role') ?? ''))
        return true;

    if (NOISE.test(element.className?.toString() ?? ''))
        return true;

    const style = element.getAttribute('style') ?? '';

    return /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(style);
}
