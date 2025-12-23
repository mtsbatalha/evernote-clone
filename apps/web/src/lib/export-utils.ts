// Export utilities for notes

export interface ExportableNote {
    id: string;
    title: string;
    content: any; // TipTap JSON
    plainText?: string;
    createdAt: string;
    updatedAt: string;
    tags?: { name: string; color?: string }[];
}

// Convert TipTap JSON to Markdown
export function tiptapToMarkdown(content: any): string {
    if (!content || !content.content) return '';

    const processNode = (node: any): string => {
        switch (node.type) {
            case 'paragraph':
                return (node.content?.map(processNode).join('') || '') + '\n\n';

            case 'heading':
                const level = node.attrs?.level || 1;
                const prefix = '#'.repeat(level);
                return `${prefix} ${node.content?.map(processNode).join('') || ''}\n\n`;

            case 'bulletList':
                return node.content?.map((item: any) => `- ${processNode(item)}`).join('') + '\n';

            case 'orderedList':
                return node.content?.map((item: any, i: number) => `${i + 1}. ${processNode(item)}`).join('') + '\n';

            case 'listItem':
                return node.content?.map(processNode).join('').trim();

            case 'taskList':
                return node.content?.map(processNode).join('') + '\n';

            case 'taskItem':
                const checked = node.attrs?.checked ? 'x' : ' ';
                return `- [${checked}] ${node.content?.map(processNode).join('').trim()}\n`;

            case 'blockquote':
                return node.content?.map((n: any) => `> ${processNode(n)}`).join('');

            case 'codeBlock':
                const lang = node.attrs?.language || '';
                const code = node.content?.map(processNode).join('') || '';
                return `\`\`\`${lang}\n${code}\`\`\`\n\n`;

            case 'horizontalRule':
                return '---\n\n';

            case 'image':
                const alt = node.attrs?.alt || 'image';
                const src = node.attrs?.src || '';
                return `![${alt}](${src})\n\n`;

            case 'text':
                let text = node.text || '';
                if (node.marks) {
                    node.marks.forEach((mark: any) => {
                        switch (mark.type) {
                            case 'bold':
                                text = `**${text}**`;
                                break;
                            case 'italic':
                                text = `*${text}*`;
                                break;
                            case 'code':
                                text = `\`${text}\``;
                                break;
                            case 'strike':
                                text = `~~${text}~~`;
                                break;
                            case 'link':
                                text = `[${text}](${mark.attrs?.href || ''})`;
                                break;
                        }
                    });
                }
                return text;

            case 'hardBreak':
                return '\n';

            default:
                return node.content?.map(processNode).join('') || '';
        }
    };

    return content.content.map(processNode).join('').trim();
}

// Convert TipTap JSON to HTML
export function tiptapToHtml(content: any): string {
    if (!content || !content.content) return '';

    const processNode = (node: any): string => {
        switch (node.type) {
            case 'paragraph':
                return `<p>${node.content?.map(processNode).join('') || ''}</p>`;

            case 'heading':
                const level = node.attrs?.level || 1;
                return `<h${level}>${node.content?.map(processNode).join('') || ''}</h${level}>`;

            case 'bulletList':
                return `<ul>${node.content?.map(processNode).join('')}</ul>`;

            case 'orderedList':
                return `<ol>${node.content?.map(processNode).join('')}</ol>`;

            case 'listItem':
                return `<li>${node.content?.map(processNode).join('')}</li>`;

            case 'taskList':
                return `<ul class="task-list">${node.content?.map(processNode).join('')}</ul>`;

            case 'taskItem':
                const checked = node.attrs?.checked ? 'checked' : '';
                return `<li><input type="checkbox" ${checked} disabled/> ${node.content?.map(processNode).join('')}</li>`;

            case 'blockquote':
                return `<blockquote>${node.content?.map(processNode).join('')}</blockquote>`;

            case 'codeBlock':
                const lang = node.attrs?.language || '';
                return `<pre><code class="language-${lang}">${node.content?.map(processNode).join('')}</code></pre>`;

            case 'horizontalRule':
                return '<hr/>';

            case 'image':
                const src = node.attrs?.src || '';
                const alt = node.attrs?.alt || '';
                return `<img src="${src}" alt="${alt}"/>`;

            case 'text':
                let text = node.text || '';
                text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                if (node.marks) {
                    node.marks.forEach((mark: any) => {
                        switch (mark.type) {
                            case 'bold':
                                text = `<strong>${text}</strong>`;
                                break;
                            case 'italic':
                                text = `<em>${text}</em>`;
                                break;
                            case 'code':
                                text = `<code>${text}</code>`;
                                break;
                            case 'strike':
                                text = `<s>${text}</s>`;
                                break;
                            case 'underline':
                                text = `<u>${text}</u>`;
                                break;
                            case 'link':
                                text = `<a href="${mark.attrs?.href || ''}">${text}</a>`;
                                break;
                            case 'highlight':
                                text = `<mark>${text}</mark>`;
                                break;
                        }
                    });
                }
                return text;

            case 'hardBreak':
                return '<br/>';

            default:
                return node.content?.map(processNode).join('') || '';
        }
    };

    return content.content.map(processNode).join('');
}

// Export as Markdown file
export function exportAsMarkdown(note: ExportableNote): void {
    const markdown = tiptapToMarkdown(note.content);
    const frontmatter = `---
title: ${note.title}
created: ${note.createdAt}
updated: ${note.updatedAt}
${note.tags?.length ? `tags: [${note.tags.map(t => t.name).join(', ')}]` : ''}
---

`;
    const fullContent = frontmatter + markdown;
    downloadFile(`${note.title || 'untitled'}.md`, fullContent, 'text/markdown');
}

// Export as HTML file
export function exportAsHtml(note: ExportableNote): void {
    const htmlContent = tiptapToHtml(note.content);
    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${note.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
        h1, h2, h3 { margin-top: 1.5em; }
        pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }
        img { max-width: 100%; }
        .task-list { list-style: none; padding-left: 0; }
        .task-list li { display: flex; align-items: center; gap: 0.5rem; }
    </style>
</head>
<body>
    <h1>${note.title}</h1>
    <p><small>Criado: ${new Date(note.createdAt).toLocaleDateString('pt-BR')} | Atualizado: ${new Date(note.updatedAt).toLocaleDateString('pt-BR')}</small></p>
    ${htmlContent}
</body>
</html>`;
    downloadFile(`${note.title || 'untitled'}.html`, fullHtml, 'text/html');
}

// Export as JSON (backup format)
export function exportAsJson(note: ExportableNote): void {
    const json = JSON.stringify(note, null, 2);
    downloadFile(`${note.title || 'untitled'}.json`, json, 'application/json');
}

// Export as plain text
export function exportAsText(note: ExportableNote): void {
    const text = `${note.title}\n${'='.repeat(note.title.length)}\n\n${note.plainText || tiptapToMarkdown(note.content).replace(/[#*`_~\[\]]/g, '')}`;
    downloadFile(`${note.title || 'untitled'}.txt`, text, 'text/plain');
}

// Helper to download file
function downloadFile(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/[/\\?%*:|"<>]/g, '-');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Parse Markdown to TipTap JSON (basic)
export function markdownToTiptap(markdown: string): any {
    const lines = markdown.split('\n');
    const content: any[] = [];
    let i = 0;

    // Skip frontmatter
    if (lines[0] === '---') {
        i = lines.indexOf('---', 1) + 1;
    }

    while (i < lines.length) {
        const line = lines[i];
        if (!line) { i++; continue; }

        // Heading
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch && headingMatch[1] && headingMatch[2]) {
            content.push({
                type: 'heading',
                attrs: { level: headingMatch[1].length },
                content: [{ type: 'text', text: headingMatch[2] }],
            });
            i++;
            continue;
        }

        // Horizontal rule
        if (line.match(/^[-*_]{3,}$/)) {
            content.push({ type: 'horizontalRule' });
            i++;
            continue;
        }

        // Bullet list item
        if (line.match(/^[-*+]\s+/)) {
            const items: any[] = [];
            while (i < lines.length && lines[i].match(/^[-*+]\s+/)) {
                const text = lines[i].replace(/^[-*+]\s+/, '');
                items.push({
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
                });
                i++;
            }
            content.push({ type: 'bulletList', content: items });
            continue;
        }

        // Task list item
        if (line.match(/^[-*+]\s+\[[ x]\]\s+/i)) {
            const items: any[] = [];
            while (i < lines.length && lines[i].match(/^[-*+]\s+\[[ x]\]\s+/i)) {
                const checked = lines[i].includes('[x]') || lines[i].includes('[X]');
                const text = lines[i].replace(/^[-*+]\s+\[[ x]\]\s+/i, '');
                items.push({
                    type: 'taskItem',
                    attrs: { checked },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
                });
                i++;
            }
            content.push({ type: 'taskList', content: items });
            continue;
        }

        // Numbered list item
        if (line.match(/^\d+\.\s+/)) {
            const items: any[] = [];
            while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
                const text = lines[i].replace(/^\d+\.\s+/, '');
                items.push({
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
                });
                i++;
            }
            content.push({ type: 'orderedList', content: items });
            continue;
        }

        // Blockquote
        if (line.startsWith('> ')) {
            const quoteLines: string[] = [];
            while (i < lines.length && lines[i].startsWith('> ')) {
                quoteLines.push(lines[i].substring(2));
                i++;
            }
            content.push({
                type: 'blockquote',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: quoteLines.join('\n') }] }],
            });
            continue;
        }

        // Code block
        if (line.startsWith('```')) {
            const lang = line.substring(3).trim();
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            content.push({
                type: 'codeBlock',
                attrs: { language: lang },
                content: [{ type: 'text', text: codeLines.join('\n') }],
            });
            i++;
            continue;
        }

        // Empty line
        if (line.trim() === '') {
            i++;
            continue;
        }

        // Regular paragraph
        content.push({
            type: 'paragraph',
            content: [{ type: 'text', text: line }],
        });
        i++;
    }

    return { type: 'doc', content };
}
