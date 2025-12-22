'use client';

/**
 * Import utilities for parsing Evernote (.enex), HTML, and Markdown files
 */

export interface ImportedNote {
    title: string;
    content: string; // HTML content
    createdAt?: string;
    updatedAt?: string;
    tags?: string[];
}

/**
 * Parse Evernote Export (.enex) file
 * ENEX is an XML format containing one or more notes
 */
export function parseEnexFile(content: string): ImportedNote[] {
    const notes: ImportedNote[] = [];

    try {
        // Try to use DOMParser first
        const parser = new DOMParser();
        let xmlDoc = parser.parseFromString(content, 'text/xml');

        // Check for parsing errors - if so, try application/xml
        let parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            // Clean up content - remove BOM and fix common issues
            let cleanedContent = content
                .replace(/^\uFEFF/, '') // Remove BOM
                .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;') // Fix unescaped ampersands
                .trim();

            xmlDoc = parser.parseFromString(cleanedContent, 'text/xml');
            parseError = xmlDoc.querySelector('parsererror');
        }

        // If still error, try regex-based parsing as fallback
        if (parseError) {
            console.log('ENEX: Trying regex fallback parser');
            return parseEnexFileWithRegex(content);
        }

        const noteElements = xmlDoc.querySelectorAll('note');

        if (noteElements.length === 0) {
            // Maybe the XML structure is different, try regex
            console.log('ENEX: No notes found with DOM parser, trying regex');
            return parseEnexFileWithRegex(content);
        }

        noteElements.forEach((noteEl) => {
            const title = noteEl.querySelector('title')?.textContent || 'Untitled';
            const contentEl = noteEl.querySelector('content');
            const created = noteEl.querySelector('created')?.textContent;
            const updated = noteEl.querySelector('updated')?.textContent;

            // ENEX content is wrapped in CDATA, extract it
            let htmlContent = '';
            if (contentEl) {
                // Get the raw content (may be CDATA wrapped)
                htmlContent = contentEl.textContent || '';

                // Evernote content is in en-note format, extract body
                const enNoteMatch = htmlContent.match(/<en-note[^>]*>([\s\S]*?)<\/en-note>/i);
                if (enNoteMatch) {
                    htmlContent = enNoteMatch[1];
                }

                // Clean up Evernote-specific tags
                htmlContent = cleanEnexContent(htmlContent);
            }

            // Parse tags
            const tags: string[] = [];
            noteEl.querySelectorAll('tag').forEach((tagEl) => {
                const tagName = tagEl.textContent?.trim();
                if (tagName) tags.push(tagName);
            });

            notes.push({
                title,
                content: htmlContent || '<p></p>',
                createdAt: parseEnexDate(created),
                updatedAt: parseEnexDate(updated),
                tags,
            });
        });
    } catch (error) {
        console.error('Failed to parse ENEX file with DOM, trying regex:', error);
        // Try regex fallback
        return parseEnexFileWithRegex(content);
    }

    return notes;
}

/**
 * Parse dates (Evernote format: yyyyMMddTHHmmssZ)
 */
function parseEnexDate(dateStr: string | undefined): string | undefined {
    if (!dateStr) return undefined;
    try {
        const match = dateStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
        if (match && match[1] && match[2] && match[3] && match[4] && match[5] && match[6]) {
            return new Date(
                parseInt(match[1], 10),
                parseInt(match[2], 10) - 1,
                parseInt(match[3], 10),
                parseInt(match[4], 10),
                parseInt(match[5], 10),
                parseInt(match[6], 10)
            ).toISOString();
        }
    } catch {
        // Ignore parse errors
    }
    return undefined;
}

/**
 * Clean Evernote-specific content
 */
function cleanEnexContent(content: string): string {
    return content
        .replace(/<en-media[^>]*\/>/gi, '') // Remove self-closing media tags
        .replace(/<en-media[^>]*>.*?<\/en-media>/gi, '') // Remove media with content
        .replace(/<en-crypt[^>]*>.*?<\/en-crypt>/gi, '[Encrypted content]') // Mark encrypted
        .replace(/<en-todo[^>]*checked="true"[^>]*\/>/gi, '☑ ')
        .replace(/<en-todo[^>]*\/>/gi, '☐ ')
        .replace(/<en-todo[^>]*checked="true"[^>]*>/gi, '☑ ')
        .replace(/<en-todo[^>]*>/gi, '☐ ')
        .replace(/<\/en-todo>/gi, '')
        .trim();
}

/**
 * Fallback regex-based parser for ENEX files
 */
function parseEnexFileWithRegex(content: string): ImportedNote[] {
    const notes: ImportedNote[] = [];

    // Match <note>...</note> blocks
    const noteRegex = /<note>([\s\S]*?)<\/note>/gi;
    let match;

    while ((match = noteRegex.exec(content)) !== null) {
        const noteContent = match[1];

        // Extract title
        const titleMatch = noteContent.match(/<title>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

        // Extract content (inside CDATA usually)
        let htmlContent = '';
        const contentMatch = noteContent.match(/<content>([\s\S]*?)<\/content>/i);
        if (contentMatch) {
            let rawContent = contentMatch[1];

            // Remove CDATA wrapper if present
            const cdataMatch = rawContent.match(/<!\[CDATA\[([\s\S]*?)]]>/);
            if (cdataMatch) {
                rawContent = cdataMatch[1];
            }

            // Extract en-note content
            const enNoteMatch = rawContent.match(/<en-note[^>]*>([\s\S]*?)<\/en-note>/i);
            if (enNoteMatch) {
                htmlContent = enNoteMatch[1];
            } else {
                htmlContent = rawContent;
            }

            htmlContent = cleanEnexContent(htmlContent);
        }

        // Extract dates
        const createdMatch = noteContent.match(/<created>([^<]*)<\/created>/i);
        const updatedMatch = noteContent.match(/<updated>([^<]*)<\/updated>/i);

        // Extract tags
        const tags: string[] = [];
        const tagRegex = /<tag>([^<]*)<\/tag>/gi;
        let tagMatch;
        while ((tagMatch = tagRegex.exec(noteContent)) !== null) {
            const tagName = tagMatch[1].trim();
            if (tagName) tags.push(tagName);
        }

        notes.push({
            title,
            content: htmlContent || '<p></p>',
            createdAt: parseEnexDate(createdMatch?.[1]),
            updatedAt: parseEnexDate(updatedMatch?.[1]),
            tags,
        });
    }

    if (notes.length === 0) {
        throw new Error('No notes found in ENEX file');
    }

    return notes;
}

/**
 * Parse HTML file
 */
export function parseHtmlFile(content: string, filename: string): ImportedNote {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');

        // Get title from <title> tag or filename
        let title = doc.querySelector('title')?.textContent?.trim();
        if (!title) {
            // Use filename without extension
            title = filename.replace(/\.(html?|htm)$/i, '');
        }

        // Get body content
        const body = doc.querySelector('body');
        let htmlContent = body?.innerHTML || content;

        // Clean up common issues
        htmlContent = htmlContent
            .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts
            .replace(/<style[\s\S]*?<\/style>/gi, '') // Remove styles
            .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
            .trim();

        return {
            title,
            content: htmlContent || '<p></p>',
        };
    } catch (error) {
        console.error('Failed to parse HTML file:', error);
        throw error;
    }
}

/**
 * Parse Markdown file
 */
export function parseMarkdownFile(content: string, filename: string): ImportedNote {
    // Extract title from first heading or filename
    let title = filename.replace(/\.(md|markdown)$/i, '');
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
        title = headingMatch[1].trim();
        // Remove the heading from content
        content = content.replace(/^#\s+.+$/m, '').trim();
    }

    // Convert Markdown to HTML
    const htmlContent = markdownToHtml(content);

    return {
        title,
        content: htmlContent || '<p></p>',
    };
}

/**
 * Simple Markdown to HTML converter
 */
function markdownToHtml(md: string): string {
    let html = md;

    // Escape HTML entities first
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Headers
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

    // Blockquotes
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists
    html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>');
    // Wrap consecutive li items in ul
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Ordered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Task lists
    html = html.replace(/^-\s+\[x\]\s+(.+)$/gim, '<li data-checked="true">$1</li>');
    html = html.replace(/^-\s+\[\s*\]\s+(.+)$/gim, '<li data-checked="false">$1</li>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

    // Horizontal rules
    html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr />');

    // Paragraphs (wrap remaining text in p tags)
    const lines = html.split('\n');
    const result: string[] = [];
    let inParagraph = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
            if (inParagraph) {
                result.push('</p>');
                inParagraph = false;
            }
            continue;
        }

        // Skip block elements
        if (trimmed.startsWith('<h') ||
            trimmed.startsWith('<ul') ||
            trimmed.startsWith('<ol') ||
            trimmed.startsWith('<li') ||
            trimmed.startsWith('<blockquote') ||
            trimmed.startsWith('<pre') ||
            trimmed.startsWith('<hr')) {
            if (inParagraph) {
                result.push('</p>');
                inParagraph = false;
            }
            result.push(trimmed);
            continue;
        }

        if (!inParagraph) {
            result.push('<p>');
            inParagraph = true;
        }
        result.push(trimmed);
    }

    if (inParagraph) {
        result.push('</p>');
    }

    return result.join('\n');
}

/**
 * Determine file type from filename
 */
export function getFileType(filename: string): 'enex' | 'html' | 'markdown' | 'unknown' {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.enex')) return 'enex';
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
    return 'unknown';
}

/**
 * Parse file based on type
 */
export async function parseFile(file: File): Promise<ImportedNote[]> {
    const content = await file.text();
    const fileType = getFileType(file.name);

    switch (fileType) {
        case 'enex':
            return parseEnexFile(content);
        case 'html':
            return [parseHtmlFile(content, file.name)];
        case 'markdown':
            return [parseMarkdownFile(content, file.name)];
        default:
            throw new Error(`Unsupported file type: ${file.name}`);
    }
}

/**
 * Parse multiple files
 */
export async function parseFiles(files: File[]): Promise<{ notes: ImportedNote[]; errors: string[] }> {
    const notes: ImportedNote[] = [];
    const errors: string[] = [];

    for (const file of files) {
        try {
            const parsed = await parseFile(file);
            notes.push(...parsed);
        } catch (error) {
            errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    return { notes, errors };
}

/**
 * Convert HTML to TipTap JSON document structure
 */
export function htmlToTiptap(html: string): any {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const container = doc.body.firstChild as Element;

    const content: any[] = [];

    const processNode = (node: Node): any => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.trim()) {
                return { type: 'text', text };
            }
            return null;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return null;

        const el = node as Element;
        const tagName = el.tagName.toLowerCase();

        // Handle different HTML elements
        switch (tagName) {
            case 'p':
            case 'div': {
                const children = processChildren(el);
                if (children.length === 0) {
                    return { type: 'paragraph' };
                }
                return { type: 'paragraph', content: children };
            }

            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6': {
                const level = parseInt(tagName[1] || '1');
                const children = processChildren(el);
                return { type: 'heading', attrs: { level }, content: children.length > 0 ? children : [{ type: 'text', text: el.textContent || '' }] };
            }

            case 'br':
                return { type: 'hardBreak' };

            case 'strong':
            case 'b': {
                const children = processChildren(el);
                return children.map((c: any) => ({
                    ...c,
                    marks: [...(c.marks || []), { type: 'bold' }]
                }));
            }

            case 'em':
            case 'i': {
                const children = processChildren(el);
                return children.map((c: any) => ({
                    ...c,
                    marks: [...(c.marks || []), { type: 'italic' }]
                }));
            }

            case 's':
            case 'strike':
            case 'del': {
                const children = processChildren(el);
                return children.map((c: any) => ({
                    ...c,
                    marks: [...(c.marks || []), { type: 'strike' }]
                }));
            }

            case 'u': {
                const children = processChildren(el);
                return children.map((c: any) => ({
                    ...c,
                    marks: [...(c.marks || []), { type: 'underline' }]
                }));
            }

            case 'code': {
                const text = el.textContent || '';
                return { type: 'text', text, marks: [{ type: 'code' }] };
            }

            case 'a': {
                const href = el.getAttribute('href') || '';
                const text = el.textContent || '';
                return { type: 'text', text, marks: [{ type: 'link', attrs: { href } }] };
            }

            case 'ul': {
                const items = Array.from(el.children)
                    .filter(child => child.tagName.toLowerCase() === 'li')
                    .map(li => ({
                        type: 'listItem',
                        content: [{ type: 'paragraph', content: processChildren(li) }]
                    }));
                return { type: 'bulletList', content: items };
            }

            case 'ol': {
                const items = Array.from(el.children)
                    .filter(child => child.tagName.toLowerCase() === 'li')
                    .map(li => ({
                        type: 'listItem',
                        content: [{ type: 'paragraph', content: processChildren(li) }]
                    }));
                return { type: 'orderedList', content: items };
            }

            case 'blockquote': {
                const children = processChildren(el);
                return {
                    type: 'blockquote',
                    content: [{ type: 'paragraph', content: children.length > 0 ? children : [{ type: 'text', text: el.textContent || '' }] }]
                };
            }

            case 'pre': {
                const code = el.querySelector('code');
                const text = code?.textContent || el.textContent || '';
                const language = code?.className.replace('language-', '') || '';
                return {
                    type: 'codeBlock',
                    attrs: { language },
                    content: [{ type: 'text', text }]
                };
            }

            case 'hr':
                return { type: 'horizontalRule' };

            case 'img': {
                const src = el.getAttribute('src') || '';
                const alt = el.getAttribute('alt') || '';
                return { type: 'image', attrs: { src, alt } };
            }

            case 'li':
            case 'span':
            default: {
                // For spans and other inline elements, process children
                const children = processChildren(el);
                if (children.length === 1) return children[0];
                return children;
            }
        }
    };

    const processChildren = (parent: Element): any[] => {
        const result: any[] = [];
        parent.childNodes.forEach(node => {
            const processed = processNode(node);
            if (processed) {
                if (Array.isArray(processed)) {
                    result.push(...processed.flat().filter(Boolean));
                } else {
                    result.push(processed);
                }
            }
        });
        return result;
    };

    // Process all top-level children
    if (container) {
        container.childNodes.forEach(node => {
            const processed = processNode(node);
            if (processed) {
                if (Array.isArray(processed)) {
                    // If we got an array (like from inline elements at top level), wrap in paragraph
                    content.push({ type: 'paragraph', content: processed.flat().filter(Boolean) });
                } else if (processed.type === 'text') {
                    // Text nodes at top level should be wrapped in paragraph
                    content.push({ type: 'paragraph', content: [processed] });
                } else {
                    content.push(processed);
                }
            }
        });
    }

    // Ensure we have at least one paragraph
    if (content.length === 0) {
        content.push({ type: 'paragraph' });
    }

    return {
        type: 'doc',
        content
    };
}
