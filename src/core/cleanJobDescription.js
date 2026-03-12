/**
 * cleanJobDescription.js
 *
 * Processes raw ATS HTML job descriptions:
 *  1. Cleans up HTML noise (inline styles, empty tags, scripts, etc.)
 *  2. Detects sections via headings and classifies them
 *  3. Restructures: role content first, boilerplate/company info collapsed
 *
 * Output: cleaned HTML string. May contain:
 *   <div class="jd-secondary-sections" data-collapsed="true">...</div>
 * which the frontend renders as a collapsible block.
 */

import { JSDOM } from 'jsdom';

// ── Section classification patterns ────────────────────────────────────────

const ROLE_CONTENT_PATTERNS = [
    /about\s+the\s+(role|position|job)/i,
    /^the\s+role$/i,
    /role\s+overview/i,
    /position\s+overview/i,
    /what\s+you['\u2019]?ll?\s+do/i,
    /what\s+will\s+you\s+do/i,
    /day[\s-]to[\s-]day/i,
    /\bresponsibilities\b/i,
    /key\s+responsibilities/i,
    /your\s+responsibilities/i,
    /what\s+we['\u2019]?re?\s+looking\s+for/i,
    /\brequirements\b/i,
    /\bqualifications\b/i,
    /what\s+you['\u2019]?ll?\s+need/i,
    /what\s+you\s+need/i,
    /who\s+you\s+are/i,
    /about\s+you/i,
    /must[\s-]have/i,
    /nice[\s-]to[\s-]have/i,
    /\bbonus\b/i,
    /preferred(\s+qualifications)?/i,
    /good\s+to\s+have/i,
    /tech\s+stack/i,
    /\btechnologies\b/i,
    /tools\s+(&|and)\s+tech/i,
    /skills\s+(&|and)\s+experience/i,
    /skills\s+(&|and)\s+requirements/i,
    /technical\s+skills/i,
];

const COMPANY_INFO_PATTERNS = [
    /who\s+we\s+are/i,
    /^about\s+us$/i,
    /^about\s+\w/i,          // "about Stripe", "about the team"
    /our\s+mission/i,
    /our\s+story/i,
    /our\s+values/i,
    /company\s+overview/i,
    /^the\s+company$/i,
    /our\s+team/i,
    /what\s+we\s+do/i,
    /our\s+product/i,
    /^overview$/i,
];

const BOILERPLATE_PATTERNS = [
    /\bbenefits\b/i,
    /\bperks\b/i,
    /what\s+we\s+offer/i,
    /\bcompensation(\s+&\s+benefits)?/i,
    /why\s+join/i,
    /why\s+us/i,
    /equal\s+opportunity/i,
    /\beeo\b/i,
    /\bdiversity\b/i,
    /\binclusion\b/i,
    /\baccessibility\b/i,
    /how\s+to\s+apply/i,
    /application\s+process/i,
    /next\s+steps/i,
    /about\s+the\s+(offer|package)/i,
    /salary\s+&\s+benefits/i,
    /total\s+rewards/i,
    /what\s+you['\u2019]?ll?\s+get/i,
    /life\s+at\s+\w/i,          // "Life at Stripe"
    /working\s+at\s+\w/i,       // "Working at Acme"
];

/**
 * Classify a heading text string into one of:
 * 'ROLE_CONTENT' | 'COMPANY_INFO' | 'BOILERPLATE' | 'UNKNOWN'
 */
function classify(text) {
    if (!text) return 'UNKNOWN';
    if (ROLE_CONTENT_PATTERNS.some(p => p.test(text))) return 'ROLE_CONTENT';
    if (COMPANY_INFO_PATTERNS.some(p => p.test(text))) return 'COMPANY_INFO';
    if (BOILERPLATE_PATTERNS.some(p => p.test(text))) return 'BOILERPLATE';
    return 'UNKNOWN';
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/**
 * Return true if this DOM node looks like a section heading.
 * Covers: actual <h1>-<h6> elements, and <p>/<div> containing only
 * a single <strong> or <b> child (common in Lever/Greenhouse output).
 */
function isHeadingNode(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = node.tagName.toLowerCase();
    if (HEADING_TAGS.has(tag)) return true;

    if (tag === 'p' || tag === 'div') {
        const text = (node.textContent || '').trim();
        if (text.length < 2 || text.length > 100) return false;
        // Must consist of exactly one non-whitespace child
        const meaningful = [...node.childNodes].filter(
            n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim())
        );
        if (meaningful.length !== 1) return false;
        const kid = meaningful[0];
        return (
            kid.nodeType === 1 &&
            (kid.tagName.toLowerCase() === 'strong' || kid.tagName.toLowerCase() === 'b')
        );
    }
    return false;
}

/** Serialize a single DOM node back to an HTML string. */
function nodeToHtml(node) {
    if (node.nodeType === 1) return node.outerHTML || '';
    if (node.nodeType === 3) {
        const t = node.textContent || '';
        return t.trim() ? t : '';
    }
    return '';
}

/** Final-pass normalization of an HTML string. */
function normalizeOutput(html) {
    return html
        .replace(/\u00a0/g, ' ')          // non-breaking space → space
        .replace(/(<br\s*\/?>\s*){2,}/gi, '<br>') // multiple <br> → one
        .replace(/[ \t]{2,}/g, ' ')        // collapse horizontal whitespace
        .trim();
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Clean and restructure a raw ATS HTML job description.
 *
 * @param {string} rawHtml
 * @returns {string} Cleaned HTML string
 */
export function cleanJobDescription(rawHtml) {
    if (!rawHtml || typeof rawHtml !== 'string') return '';

    try {
        const dom = new JSDOM(
            `<!DOCTYPE html><html><body><div id="jd-root">${rawHtml}</div></body></html>`
        );
        const doc = dom.window.document;
        const root = doc.getElementById('jd-root');

        // ── Step 1: HTML cleanup ────────────────────────────────────────

        // Remove unsafe / useless tags entirely
        root.querySelectorAll('script, style, iframe, img, noscript, video, audio').forEach(el => el.remove());

        // Strip inline styles from all remaining elements
        root.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));

        // Remove empty elements (iterate until stable)
        let changed = true;
        while (changed) {
            changed = false;
            root.querySelectorAll('p, div, span, li, h1, h2, h3, h4, h5, h6').forEach(el => {
                const text = (el.textContent || '').replace(/\u00a0/g, '').trim();
                if (!text && el.children.length === 0) {
                    el.remove();
                    changed = true;
                }
            });
        }

        // ── Step 2: Find the most useful root node to walk ─────────────
        // If there is a single wrapper div with no meaningful class/id, look inside it
        let walkRoot = root;
        const directEls = [...root.children];
        if (
            directEls.length === 1 &&
            directEls[0].tagName.toLowerCase() === 'div' &&
            !directEls[0].id &&
            !directEls[0].className
        ) {
            walkRoot = directEls[0];
        }

        // ── Step 3: Detect if there are any heading elements ───────────
        const hasRealHeadings = walkRoot.querySelector('h1, h2, h3, h4, h5, h6') !== null;
        const hasBoldHeadings = [...walkRoot.querySelectorAll('p, div')].some(isHeadingNode);

        if (!hasRealHeadings && !hasBoldHeadings) {
            // No structure to extract — return cleaned HTML as-is
            return normalizeOutput(root.innerHTML);
        }

        // ── Step 4: Walk children and split into sections ──────────────
        const sections = [];
        let curHeadingNode = null;
        let curHeadingText = '';
        let curNodes = [];

        for (const node of [...walkRoot.childNodes]) {
            // Skip pure whitespace text nodes
            if (node.nodeType === 3 && !(node.textContent || '').trim()) continue;

            if (isHeadingNode(node)) {
                // Flush current section
                if (curHeadingNode !== null || curNodes.length > 0) {
                    sections.push({
                        heading: curHeadingNode,
                        headingText: curHeadingText,
                        nodes: curNodes,
                        category: classify(curHeadingText),
                    });
                }
                curHeadingNode = node;
                curHeadingText = (node.textContent || '').replace(/\u00a0/g, ' ').trim();
                curNodes = [];
            } else {
                curNodes.push(node);
            }
        }
        // Flush last section
        if (curHeadingNode !== null || curNodes.length > 0) {
            sections.push({
                heading: curHeadingNode,
                headingText: curHeadingText,
                nodes: curNodes,
                category: classify(curHeadingText),
            });
        }

        // ── Step 5: Decide whether restructuring is worthwhile ─────────
        const secondary = sections.filter(
            s => s.category === 'COMPANY_INFO' || s.category === 'BOILERPLATE'
        );
        if (secondary.length === 0) {
            // Nothing to collapse — return cleaned HTML as-is (order unchanged)
            return normalizeOutput(walkRoot.innerHTML);
        }

        // ── Step 6: Reassemble with secondary content collapsed ────────
        const primary = sections.filter(
            s => s.category === 'ROLE_CONTENT' || s.category === 'UNKNOWN'
        );

        const sectionToHtml = (s) => {
            let h = s.heading ? nodeToHtml(s.heading) : '';
            for (const n of s.nodes) h += nodeToHtml(n);
            return h;
        };

        let out = primary.map(sectionToHtml).join('');
        const secHtml = secondary.map(sectionToHtml).join('');
        if (secHtml.trim()) {
            out += `<div class="jd-secondary-sections" data-collapsed="true">${secHtml}</div>`;
        }

        return normalizeOutput(out);

    } catch (err) {
        console.error('[cleanJobDescription] Error processing description:', err.message);
        return rawHtml; // Fall back to raw on error
    }
}
