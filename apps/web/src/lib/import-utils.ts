'use client';

/**
 * Import utilities for parsing Evernote (.enex), HTML, and Markdown files
 * Enhanced version with support for:
 * - Embedded images and resources from Evernote
 * - Checkboxes/tasks (en-todo → taskList)
 * - Text styles (colors, highlight, font size)
 * - Tables (Evernote and Markdown GFM)
 * - Nested lists
 */

export interface ImportedResource {
    hash: string;          // MD5 hash used in en-media
    data: string;          // Base64 encoded data
    mime: string;          // MIME type (e.g., image/png)
    filename?: string;     // Original filename if available
    width?: number;
    height?: number;
}

export interface ImportedNote {
    title: string;
    content: string; // HTML content
    createdAt?: string;
    updatedAt?: string;
    tags?: string[];
    resources?: ImportedResource[]; // Embedded resources
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

            // Extract resources (images, attachments)
            const resources = extractResources(noteEl);
            const resourceMap = new Map<string, ImportedResource>();
            resources.forEach(r => resourceMap.set(r.hash, r));

            // ENEX content is wrapped in CDATA, extract it
            let htmlContent = '';
            if (contentEl) {
                // Get the raw content (may be CDATA wrapped)
                htmlContent = contentEl.textContent || '';

                // Evernote content is in en-note format, extract body
                const enNoteMatch = htmlContent.match(/<en-note[^>]*>([\s\S]*?)<\/en-note>/i);
                if (enNoteMatch && enNoteMatch[1]) {
                    htmlContent = enNoteMatch[1];
                }

                // Clean up Evernote-specific tags, converting to HTML
                htmlContent = cleanEnexContent(htmlContent, resourceMap);
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
                resources: resources.length > 0 ? resources : undefined,
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
 * Extract resources (images, files) from a note element
 */
function extractResources(noteEl: Element): ImportedResource[] {
    const resources: ImportedResource[] = [];

    noteEl.querySelectorAll('resource').forEach((resourceEl) => {
        const dataEl = resourceEl.querySelector('data');
        const mimeEl = resourceEl.querySelector('mime');

        if (dataEl && mimeEl) {
            const data = dataEl.textContent?.replace(/\s/g, '') || '';
            const mime = mimeEl.textContent || 'application/octet-stream';

            // Calculate MD5 hash from data (simplified - use first 32 chars of base64 as identifier)
            // In real ENEX, the hash is provided in recognition data
            const recognitionEl = resourceEl.querySelector('recognition');
            let hash = '';

            if (recognitionEl) {
                // Try to extract hash from recognition XML
                const hashMatch = recognitionEl.textContent?.match(/objID="([a-f0-9]+)"/i);
                if (hashMatch && hashMatch[1]) {
                    hash = hashMatch[1];
                }
            }

            // Fallback: generate hash from data prefix
            if (!hash) {
                hash = generateSimpleHash(data.substring(0, 100));
            }

            const widthEl = resourceEl.querySelector('width');
            const heightEl = resourceEl.querySelector('height');
            const filenameEl = resourceEl.querySelector('file-name');

            resources.push({
                hash,
                data,
                mime,
                filename: filenameEl?.textContent || undefined,
                width: widthEl ? parseInt(widthEl.textContent || '0', 10) : undefined,
                height: heightEl ? parseInt(heightEl.textContent || '0', 10) : undefined,
            });
        }
    });

    return resources;
}

/**
 * Generate a simple hash for resource identification
 */
function generateSimpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
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
 * Clean Evernote-specific content and convert to standard HTML
 */
function cleanEnexContent(content: string, resourceMap?: Map<string, ImportedResource>): string {
    let result = content;

    // Convert en-media to img tags with data URLs or placeholders
    result = result.replace(/<en-media[^>]*hash="([a-f0-9]+)"[^>]*type="([^"]*)"[^>]*\/?>/gi,
        (match, hash, type) => {
            const resource = resourceMap?.get(hash);
            if (resource && resource.mime.startsWith('image/')) {
                const widthAttr = resource.width ? ` width="${resource.width}"` : '';
                const heightAttr = resource.height ? ` height="${resource.height}"` : '';
                return `<img src="data:${resource.mime};base64,${resource.data}"${widthAttr}${heightAttr} data-resource-hash="${hash}" alt="Imagem importada" />`;
            }
            // For non-image resources, create a download link placeholder
            if (resource) {
                const filename = resource.filename || `attachment.${resource.mime.split('/')[1] || 'bin'}`;
                return `<p><a href="#" data-resource-hash="${hash}" data-resource-type="${resource.mime}">[📎 ${filename}]</a></p>`;
            }
            return `<p>[Mídia não encontrada: ${hash}]</p>`;
        }
    );

    // Handle en-media without hash attribute (fallback)
    result = result.replace(/<en-media[^>]*\/>/gi, '');
    result = result.replace(/<en-media[^>]*>.*?<\/en-media>/gi, '');

    // Convert en-crypt to placeholder
    result = result.replace(/<en-crypt[^>]*>.*?<\/en-crypt>/gi, '<p><em>[Conteúdo criptografado]</em></p>');

    // Convert en-todo to checkbox inputs (will be converted to taskList in htmlToTiptap)
    result = result.replace(/<en-todo[^>]*checked="true"[^>]*\/?>/gi, '<input type="checkbox" checked disabled /> ');
    result = result.replace(/<en-todo[^>]*\/?>/gi, '<input type="checkbox" disabled /> ');
    result = result.replace(/<\/en-todo>/gi, '');

    // Wrap lines with checkboxes in task list structure
    result = result.replace(/(<input type="checkbox"[^>]*>\s*)([^<\n]+)/gi,
        '<li data-type="taskItem" data-checked="$1"><p>$2</p></li>');
    result = result.replace(/data-checked="<input type="checkbox" checked disabled \/>"/gi, 'data-checked="true"');
    result = result.replace(/data-checked="<input type="checkbox" disabled \/>"/gi, 'data-checked="false"');

    // Wrap consecutive taskItems in taskList
    result = result.replace(/(<li data-type="taskItem"[^>]*>[\s\S]*?<\/li>\s*)+/gi, (match) => {
        return `<ul data-type="taskList">${match}</ul>`;
    });

    return result.trim();
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
        if (!noteContent) continue;

        // Extract title
        const titleMatch = noteContent.match(/<title>([^<]*)<\/title>/i);
        const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : 'Untitled';

        // Extract resources
        const resources = extractResourcesFromRegex(noteContent);
        const resourceMap = new Map<string, ImportedResource>();
        resources.forEach(r => resourceMap.set(r.hash, r));

        // Extract content (inside CDATA usually)
        let htmlContent = '';
        const contentMatch = noteContent.match(/<content>([\s\S]*?)<\/content>/i);
        if (contentMatch && contentMatch[1]) {
            let rawContent: string = contentMatch[1];

            // Remove CDATA wrapper if present
            const cdataMatch = rawContent.match(/<!\[CDATA\[([\s\S]*?)]]>/);
            if (cdataMatch && cdataMatch[1]) {
                rawContent = cdataMatch[1];
            }

            // Extract en-note content
            const enNoteMatch = rawContent.match(/<en-note[^>]*>([\s\S]*?)<\/en-note>/i);
            if (enNoteMatch && enNoteMatch[1]) {
                htmlContent = enNoteMatch[1];
            } else {
                htmlContent = rawContent;
            }

            htmlContent = cleanEnexContent(htmlContent, resourceMap);
        }

        // Extract dates
        const createdMatch = noteContent.match(/<created>([^<]*)<\/created>/i);
        const updatedMatch = noteContent.match(/<updated>([^<]*)<\/updated>/i);

        // Extract tags
        const tags: string[] = [];
        const tagRegex = /<tag>([^<]*)<\/tag>/gi;
        let tagMatch;
        while ((tagMatch = tagRegex.exec(noteContent)) !== null) {
            const tagName = tagMatch[1]?.trim();
            if (tagName) tags.push(tagName);
        }

        notes.push({
            title,
            content: htmlContent || '<p></p>',
            createdAt: parseEnexDate(createdMatch?.[1]),
            updatedAt: parseEnexDate(updatedMatch?.[1]),
            tags,
            resources: resources.length > 0 ? resources : undefined,
        });
    }

    if (notes.length === 0) {
        throw new Error('No notes found in ENEX file');
    }

    return notes;
}

/**
 * Extract resources using regex (fallback)
 */
function extractResourcesFromRegex(noteContent: string): ImportedResource[] {
    const resources: ImportedResource[] = [];
    const resourceRegex = /<resource>([\s\S]*?)<\/resource>/gi;
    let match;

    while ((match = resourceRegex.exec(noteContent)) !== null) {
        const resContent = match[1];
        if (!resContent) continue;

        const dataMatch = resContent.match(/<data[^>]*>([\s\S]*?)<\/data>/i);
        const mimeMatch = resContent.match(/<mime>([^<]*)<\/mime>/i);

        if (dataMatch && dataMatch[1] && mimeMatch && mimeMatch[1]) {
            const data = dataMatch[1].replace(/\s/g, '');
            const mime = mimeMatch[1];

            // Try to get hash from recognition
            const recMatch = resContent.match(/objID="([a-f0-9]+)"/i);
            const hash = recMatch && recMatch[1] ? recMatch[1] : generateSimpleHash(data.substring(0, 100));

            const widthMatch = resContent.match(/<width>(\d+)<\/width>/i);
            const heightMatch = resContent.match(/<height>(\d+)<\/height>/i);
            const filenameMatch = resContent.match(/<file-name>([^<]*)<\/file-name>/i);

            resources.push({
                hash,
                data,
                mime,
                filename: filenameMatch?.[1],
                width: widthMatch && widthMatch[1] ? parseInt(widthMatch[1], 10) : undefined,
                height: heightMatch && heightMatch[1] ? parseInt(heightMatch[1], 10) : undefined,
            });
        }
    }

    return resources;
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
    if (headingMatch && headingMatch[1]) {
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
 * Enhanced Markdown to HTML converter with support for:
 * - Tables (GFM)
 * - Task lists
 * - Nested lists
 * - Footnotes
 */
function markdownToHtml(md: string): string {
    let html = md;

    // Process code blocks FIRST (before escaping)
    const codeBlocks: string[] = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const index = codeBlocks.length;
        codeBlocks.push(`<pre><code class="language-${lang || 'plaintext'}">${escapeHtml(code)}</code></pre>`);
        return `___CODEBLOCK_${index}___`;
    });

    // Inline code (before escaping)
    const inlineCodes: string[] = [];
    html = html.replace(/`([^`]+)`/g, (_, code) => {
        const index = inlineCodes.length;
        inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
        return `___INLINECODE_${index}___`;
    });

    // Now escape HTML entities
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Restore code blocks and inline codes
    codeBlocks.forEach((block, i) => {
        html = html.replace(`___CODEBLOCK_${i}___`, block);
    });
    inlineCodes.forEach((code, i) => {
        html = html.replace(`___INLINECODE_${i}___`, code);
    });

    // Tables (GFM)
    html = convertMarkdownTables(html);

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

    // Highlight (==text==)
    html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');

    // Blockquotes (handle nested)
    html = html.replace(/^(&gt;)+\s*(.+)$/gm, (match, quotes, text) => {
        const level = (quotes.match(/&gt;/g) || []).length;
        return '<blockquote>'.repeat(level) + text + '</blockquote>'.repeat(level);
    });

    // Task lists (must be before regular lists)
    html = html.replace(/^[-*]\s+\[x\]\s+(.+)$/gim, '<li data-type="taskItem" data-checked="true"><p>$1</p></li>');
    html = html.replace(/^[-*]\s+\[\s*\]\s+(.+)$/gim, '<li data-type="taskItem" data-checked="false"><p>$1</p></li>');

    // Wrap consecutive task items
    html = html.replace(/(<li data-type="taskItem"[^>]*>[\s\S]*?<\/li>\n?)+/g, (match) => {
        return `<ul data-type="taskList">${match}</ul>`;
    });

    // Unordered lists (handle nesting by indentation)
    html = convertMarkdownLists(html);

    // Ordered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

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
            trimmed.startsWith('<hr') ||
            trimmed.startsWith('<table') ||
            trimmed.startsWith('<tr') ||
            trimmed.startsWith('<td') ||
            trimmed.startsWith('<th') ||
            trimmed.startsWith('<mark')) {
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
 * Convert Markdown tables to HTML
 */
function convertMarkdownTables(md: string): string {
    const lines = md.split('\n');
    const result: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];
    let alignments: ('left' | 'center' | 'right' | null)[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = (lines[i] || '').trim();

        // Check if this is a table row (contains |)
        if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.slice(1, -1).split('|').map(c => c.trim());

            // Check if next line is alignment row
            if (!inTable && i + 1 < lines.length) {
                const nextLine = (lines[i + 1] || '').trim();
                if (nextLine.match(/^\|[\s\-:|]+\|$/)) {
                    // This is header row, next is alignment
                    inTable = true;
                    alignments = nextLine.slice(1, -1).split('|').map(cell => {
                        const c = cell.trim();
                        if (c.startsWith(':') && c.endsWith(':')) return 'center';
                        if (c.endsWith(':')) return 'right';
                        if (c.startsWith(':')) return 'left';
                        return null;
                    });

                    // Create header row
                    const headerCells = cells.map((cell, idx) => {
                        const align = alignments[idx];
                        const style = align ? ` style="text-align: ${align}"` : '';
                        return `<th${style}>${cell}</th>`;
                    }).join('');
                    tableRows.push(`<tr>${headerCells}</tr>`);
                    i++; // Skip alignment row
                    continue;
                }
            }

            if (inTable) {
                // Regular table row
                const rowCells = cells.map((cell, idx) => {
                    const align = alignments[idx];
                    const style = align ? ` style="text-align: ${align}"` : '';
                    return `<td${style}>${cell}</td>`;
                }).join('');
                tableRows.push(`<tr>${rowCells}</tr>`);
            } else {
                result.push(line);
            }
        } else {
            // Not a table row
            if (inTable) {
                // End of table
                result.push(`<table><tbody>${tableRows.join('')}</tbody></table>`);
                tableRows = [];
                inTable = false;
                alignments = [];
            }
            result.push(line);
        }
    }

    // Handle table at end of content
    if (inTable && tableRows.length > 0) {
        result.push(`<table><tbody>${tableRows.join('')}</tbody></table>`);
    }

    return result.join('\n');
}

/**
 * Convert Markdown lists with proper nesting
 */
function convertMarkdownLists(html: string): string {
    const lines = html.split('\n');
    const result: string[] = [];
    const listStack: { type: 'ul' | 'ol'; indent: number }[] = [];

    for (const line of lines) {
        // Match list items with indentation
        const unorderedMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
        const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);

        if (unorderedMatch && !line.includes('data-type="taskItem"')) {
            const indent = unorderedMatch[1] || '';
            const content = unorderedMatch[3] || '';
            const indentLevel = indent.length;

            // Close lists that are more indented
            while (listStack.length > 0 && listStack[listStack.length - 1]!.indent > indentLevel) {
                const popped = listStack.pop()!;
                result.push(`</${popped.type}>`);
            }

            // Open new list if needed
            if (listStack.length === 0 || listStack[listStack.length - 1]!.indent < indentLevel) {
                result.push('<ul>');
                listStack.push({ type: 'ul', indent: indentLevel });
            }

            result.push(`<li>${content}</li>`);
        } else if (orderedMatch) {
            const indent = orderedMatch[1] || '';
            const content = orderedMatch[3] || '';
            const indentLevel = indent.length;

            while (listStack.length > 0 && listStack[listStack.length - 1]!.indent > indentLevel) {
                const popped = listStack.pop()!;
                result.push(`</${popped.type}>`);
            }

            if (listStack.length === 0 || listStack[listStack.length - 1]!.indent < indentLevel) {
                result.push('<ol>');
                listStack.push({ type: 'ol', indent: indentLevel });
            }

            result.push(`<li>${content}</li>`);
        } else {
            // Not a list item, close all open lists
            while (listStack.length > 0) {
                const popped = listStack.pop()!;
                result.push(`</${popped.type}>`);
            }
            result.push(line);
        }
    }

    // Close remaining lists
    while (listStack.length > 0) {
        const popped = listStack.pop()!;
        result.push(`</${popped.type}>`);
    }

    return result.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
 * Enhanced with support for:
 * - Task lists
 * - Tables
 * - Text styles (colors, highlights)
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

            case 'mark': {
                const children = processChildren(el);
                // Get background color from style or use default yellow
                const bgColor = el.getAttribute('style')?.match(/background-color:\s*([^;]+)/)?.[1] || '#ffff00';
                return children.map((c: any) => ({
                    ...c,
                    marks: [...(c.marks || []), { type: 'highlight', attrs: { color: bgColor } }]
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

            // Task List support
            case 'ul': {
                const isTaskList = el.getAttribute('data-type') === 'taskList';
                if (isTaskList) {
                    const items = Array.from(el.children)
                        .filter(child => child.tagName.toLowerCase() === 'li')
                        .map(li => {
                            const checked = li.getAttribute('data-checked') === 'true';
                            const content = processChildren(li);
                            return {
                                type: 'taskItem',
                                attrs: { checked },
                                content: content.length > 0 ?
                                    (content[0].type === 'paragraph' ? content : [{ type: 'paragraph', content }]) :
                                    [{ type: 'paragraph' }]
                            };
                        });
                    return { type: 'taskList', content: items };
                }

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
                const width = el.getAttribute('width');
                const height = el.getAttribute('height');
                return {
                    type: 'image',
                    attrs: {
                        src,
                        alt,
                        width: width ? parseInt(width, 10) : null,
                        height: height ? parseInt(height, 10) : null,
                    }
                };
            }

            // Table support
            case 'table': {
                const rows: any[] = [];
                el.querySelectorAll('tr').forEach(tr => {
                    const cells: any[] = [];
                    tr.querySelectorAll('th, td').forEach(cell => {
                        const isHeader = cell.tagName.toLowerCase() === 'th';
                        const content = processChildren(cell);
                        cells.push({
                            type: isHeader ? 'tableHeader' : 'tableCell',
                            content: content.length > 0 ?
                                (content[0].type === 'paragraph' ? content : [{ type: 'paragraph', content }]) :
                                [{ type: 'paragraph' }]
                        });
                    });
                    if (cells.length > 0) {
                        rows.push({ type: 'tableRow', content: cells });
                    }
                });
                return rows.length > 0 ? { type: 'table', content: rows } : null;
            }

            // Handle font tag with color
            case 'font': {
                const color = el.getAttribute('color');
                const children = processChildren(el);
                if (color) {
                    return children.map((c: any) => ({
                        ...c,
                        marks: [...(c.marks || []), { type: 'textStyle', attrs: { color } }]
                    }));
                }
                return children;
            }

            // Handle span with styles
            case 'span': {
                const style = el.getAttribute('style') || '';
                const children = processChildren(el);

                const marks: any[] = [];

                // Extract color
                const colorMatch = style.match(/color:\s*([^;]+)/);
                if (colorMatch && colorMatch[1]) {
                    marks.push({ type: 'textStyle', attrs: { color: colorMatch[1].trim() } });
                }

                // Extract background color (highlight)
                const bgMatch = style.match(/background-color:\s*([^;]+)/);
                if (bgMatch && bgMatch[1]) {
                    marks.push({ type: 'highlight', attrs: { color: bgMatch[1].trim() } });
                }

                if (marks.length > 0) {
                    return children.map((c: any) => ({
                        ...c,
                        marks: [...(c.marks || []), ...marks]
                    }));
                }

                if (children.length === 1) return children[0];
                return children;
            }

            case 'li':
            default: {
                // For other inline elements, process children
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
