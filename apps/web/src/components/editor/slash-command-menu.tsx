'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    AlignLeft,
    BookOpen,
    Bot,
    Braces,
    CalendarDays,
    Code,
    Columns,
    FileCode,
    FileSpreadsheet,
    FileText,
    FileType,
    GitBranch,
    Hash,
    Heading1,
    Heading2,
    Heading3,
    Image,
    LayoutGrid,
    Link2,
    List,
    ListChecks,
    ListOrdered,
    MessageSquareQuote,
    Minus,
    Navigation,
    Plus,
    Quote,
    RefreshCw,
    Sparkles,
    SquareFunction,
    Table2,
    ToggleLeft,
    Type,
    Upload,
} from 'lucide-react';

interface SlashCommandMenuProps {
    editor: Editor | null;
}

interface CommandItem {
    title: string;
    description?: string;
    icon: React.ReactNode;
    shortcut?: string;
    badge?: string;
    action: (editor: Editor) => void;
}

interface CommandGroup {
    title: string;
    items: CommandItem[];
}

// Helper to create file input and trigger it
const createFileInput = (accept: string, onFile: (content: string, fileName: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const text = await file.text();
            onFile(text, file.name);
        }
    };
    input.click();
};

// Helper to parse CSV to table HTML
const csvToTable = (csv: string): string => {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return '';

    const rows = lines.map(line => {
        const cells = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
        return cells;
    });

    let html = '<table class="w-full border-collapse border border-gray-300 my-4">';
    rows.forEach((row, i) => {
        html += '<tr>';
        row.forEach(cell => {
            const tag = i === 0 ? 'th' : 'td';
            const style = i === 0
                ? 'class="border border-gray-300 px-3 py-2 bg-gray-100 font-semibold text-left"'
                : 'class="border border-gray-300 px-3 py-2"';
            html += `<${tag} ${style}>${cell}</${tag}>`;
        });
        html += '</tr>';
    });
    html += '</table>';
    return html;
};

// Helper to generate table of contents from editor content
const generateTableOfContents = (editor: Editor): string => {
    const { doc } = editor.state;
    const headings: { level: number; text: string; id: string }[] = [];

    doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
            const id = `heading-${pos}`;
            headings.push({
                level: node.attrs.level,
                text: node.textContent,
                id,
            });
        }
    });

    if (headings.length === 0) {
        return '<div class="p-4 rounded-lg bg-muted text-muted-foreground text-sm">📑 Nenhum título encontrado. Adicione títulos (H1, H2, H3) para gerar o índice.</div>';
    }

    let html = '<div class="p-4 rounded-lg bg-muted/50 my-4"><h4 class="font-semibold mb-2 text-sm uppercase tracking-wider">📑 Índice</h4><ul class="space-y-1">';
    headings.forEach(h => {
        const indent = (h.level - 1) * 16;
        html += `<li style="margin-left: ${indent}px" class="text-sm hover:text-primary cursor-pointer transition-colors">• ${h.text}</li>`;
    });
    html += '</ul></div>';
    return html;
};

const COMMAND_GROUPS: CommandGroup[] = [
    {
        title: 'Sugerido',
        items: [
            {
                title: 'AI Notetaker',
                description: 'Resuma ou expanda o texto selecionado',
                icon: <Bot className="w-4 h-4" />,
                badge: 'Beta',
                action: (editor) => {
                    const selectedText = editor.state.selection.content().content.textBetween(0, editor.state.selection.content().size, ' ');
                    if (selectedText) {
                        editor.chain().focus().insertContent(`\n\n🤖 **Resumo IA:** "${selectedText.substring(0, 100)}..." - [Analisando conteúdo...]\n\n`).run();
                        toast.success('IA analisando texto selecionado...');
                    } else {
                        const topic = window.prompt('Sobre o que você quer que a IA escreva?');
                        if (topic) {
                            editor.chain().focus().insertContent(`\n\n🤖 **Nota IA sobre "${topic}":**\n- Ponto principal 1\n- Ponto principal 2\n- Ponto principal 3\n\n`).run();
                            toast.success('Estrutura de nota criada!');
                        }
                    }
                },
            },
        ],
    },
    {
        title: 'Blocos básicos',
        items: [
            {
                title: 'Texto',
                description: 'Comece a escrever texto simples',
                icon: <Type className="w-4 h-4" />,
                action: (editor) => editor.chain().focus().setParagraph().run(),
            },
            {
                title: 'Título 1',
                icon: <Heading1 className="w-4 h-4" />,
                shortcut: '#',
                action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            },
            {
                title: 'Título 2',
                icon: <Heading2 className="w-4 h-4" />,
                shortcut: '##',
                action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            },
            {
                title: 'Título 3',
                icon: <Heading3 className="w-4 h-4" />,
                shortcut: '###',
                action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            },
            {
                title: 'Lista com marcadores',
                icon: <List className="w-4 h-4" />,
                action: (editor) => editor.chain().focus().toggleBulletList().run(),
            },
            {
                title: 'Lista numerada',
                icon: <ListOrdered className="w-4 h-4" />,
                shortcut: '1.',
                action: (editor) => editor.chain().focus().toggleOrderedList().run(),
            },
            {
                title: 'Lista de tarefas',
                icon: <ListChecks className="w-4 h-4" />,
                shortcut: '[]',
                action: (editor) => editor.chain().focus().toggleTaskList().run(),
            },
        ],
    },
    {
        title: 'Mídia',
        items: [
            {
                title: 'Imagem por URL',
                description: 'Inserir imagem via URL',
                icon: <Image className="w-4 h-4" />,
                action: (editor) => {
                    const url = window.prompt('URL da imagem:');
                    if (url) {
                        editor.chain().focus().setImage({ src: url }).run();
                        toast.success('Imagem inserida!');
                    }
                },
            },
            {
                title: 'Upload de Imagem',
                description: 'Enviar imagem do dispositivo',
                icon: <Upload className="w-4 h-4" />,
                badge: 'Novo',
                action: (editor) => {
                    // Create file input and trigger it
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;

                        // Create object URL for local preview
                        const objectUrl = URL.createObjectURL(file);
                        editor.chain().focus().setImage({ src: objectUrl }).run();
                        toast.success('Imagem inserida! Para salvar permanentemente, use o botão de upload na toolbar.');
                    };
                    input.click();
                },
            },
            {
                title: 'Código',
                description: 'Bloco de código',
                icon: <Code className="w-4 h-4" />,
                shortcut: '```',
                action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
            },
            {
                title: 'Link',
                description: 'Inserir um link',
                icon: <Link2 className="w-4 h-4" />,
                action: (editor) => {
                    const url = window.prompt('URL do link:');
                    if (url) {
                        const text = window.prompt('Texto do link:', url) || url;
                        editor.chain().focus().insertContent(`<a href="${url}" target="_blank" class="text-primary underline">${text}</a>`).run();
                        toast.success('Link inserido!');
                    }
                },
            },
            {
                title: 'Tabela',
                description: 'Criar tabela',
                icon: <Table2 className="w-4 h-4" />,
                action: (editor) => {
                    const cols = parseInt(window.prompt('Número de colunas:', '3') || '3');
                    const rows = parseInt(window.prompt('Número de linhas:', '3') || '3');

                    let tableHtml = '<table class="w-full border-collapse border border-gray-300 my-4">';
                    for (let r = 0; r < rows; r++) {
                        tableHtml += '<tr>';
                        for (let c = 0; c < cols; c++) {
                            const tag = r === 0 ? 'th' : 'td';
                            const style = r === 0
                                ? 'class="border border-gray-300 px-3 py-2 bg-gray-100 font-semibold"'
                                : 'class="border border-gray-300 px-3 py-2"';
                            const content = r === 0 ? `Coluna ${c + 1}` : '';
                            tableHtml += `<${tag} ${style}>${content}</${tag}>`;
                        }
                        tableHtml += '</tr>';
                    }
                    tableHtml += '</table>';
                    editor.chain().focus().insertContent(tableHtml).run();
                    toast.success('Tabela criada!');
                },
            },
        ],
    },
    {
        title: 'Blocos avançados',
        items: [
            {
                title: 'Índice',
                description: 'Tabela de conteúdos automática',
                icon: <BookOpen className="w-4 h-4" />,
                action: (editor) => {
                    const toc = generateTableOfContents(editor);
                    editor.chain().focus().insertContent(toc).run();
                    toast.success('Índice gerado!');
                },
            },
            {
                title: 'Equação',
                description: 'Fórmula matemática',
                icon: <SquareFunction className="w-4 h-4" />,
                action: (editor) => {
                    const equation = window.prompt('Digite a equação (ex: E = mc²):');
                    if (equation) {
                        editor.chain().focus().insertContent(`<div class="p-3 my-2 rounded-lg bg-muted font-mono text-center text-lg">${equation}</div>`).run();
                        toast.success('Equação inserida!');
                    }
                },
            },
            {
                title: 'Citação',
                description: 'Bloco de citação',
                icon: <MessageSquareQuote className="w-4 h-4" />,
                shortcut: '>',
                action: (editor) => editor.chain().focus().toggleBlockquote().run(),
            },
            {
                title: 'Divisor',
                description: 'Linha divisória',
                icon: <Minus className="w-4 h-4" />,
                shortcut: '---',
                action: (editor) => editor.chain().focus().setHorizontalRule().run(),
            },
            {
                title: 'Callout',
                description: 'Destaque informativo',
                icon: <Quote className="w-4 h-4" />,
                action: (editor) => {
                    const types = ['💡 Dica', '⚠️ Atenção', 'ℹ️ Info', '✅ Sucesso', '❌ Erro'];
                    const type = window.prompt(`Tipo (${types.join(', ')}):`, '💡 Dica') || '💡 Dica';
                    editor.chain().focus().insertContent(`<div class="p-4 my-2 rounded-lg bg-primary/10 border-l-4 border-primary"><strong>${type}</strong><br/>Escreva seu conteúdo aqui...</div>`).run();
                },
            },
            {
                title: 'Toggle/Acordeão',
                description: 'Conteúdo expansível',
                icon: <ToggleLeft className="w-4 h-4" />,
                shortcut: '> >',
                action: (editor) => {
                    const title = window.prompt('Título do toggle:', 'Clique para expandir') || 'Clique para expandir';
                    editor.chain().focus().insertContent(`<details class="p-3 my-2 rounded-lg bg-muted cursor-pointer"><summary class="font-semibold">${title}</summary><div class="mt-2 pl-4">Conteúdo oculto aqui...</div></details>`).run();
                    toast.success('Toggle criado!');
                },
            },
            {
                title: 'Data Atual',
                description: 'Inserir data e hora',
                icon: <CalendarDays className="w-4 h-4" />,
                action: (editor) => {
                    const now = new Date();
                    const formatted = now.toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    editor.chain().focus().insertContent(`📅 ${formatted}`).run();
                },
            },
        ],
    },
    {
        title: 'Layout',
        items: [
            {
                title: '2 colunas',
                description: 'Layout de 2 colunas',
                icon: <Columns className="w-4 h-4" />,
                action: (editor) => {
                    editor.chain().focus().insertContent(`
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0;">
                            <div style="padding: 16px; border: 1px dashed #ccc; border-radius: 8px;">Coluna 1 - Escreva aqui...</div>
                            <div style="padding: 16px; border: 1px dashed #ccc; border-radius: 8px;">Coluna 2 - Escreva aqui...</div>
                        </div>
                    `).run();
                    toast.success('Layout de 2 colunas criado!');
                },
            },
            {
                title: '3 colunas',
                description: 'Layout de 3 colunas',
                icon: <LayoutGrid className="w-4 h-4" />,
                action: (editor) => {
                    editor.chain().focus().insertContent(`
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin: 16px 0;">
                            <div style="padding: 16px; border: 1px dashed #ccc; border-radius: 8px;">Col 1</div>
                            <div style="padding: 16px; border: 1px dashed #ccc; border-radius: 8px;">Col 2</div>
                            <div style="padding: 16px; border: 1px dashed #ccc; border-radius: 8px;">Col 3</div>
                        </div>
                    `).run();
                    toast.success('Layout de 3 colunas criado!');
                },
            },
            {
                title: 'Botão',
                description: 'Botão clicável',
                icon: <Hash className="w-4 h-4" />,
                action: (editor) => {
                    const label = window.prompt('Texto do botão:', 'Clique aqui') || 'Clique aqui';
                    const url = window.prompt('URL do link (opcional):');
                    if (url) {
                        editor.chain().focus().insertContent(`<a href="${url}" target="_blank" style="display: inline-block; padding: 8px 16px; background: #6366f1; color: white; border-radius: 8px; text-decoration: none; font-weight: 500;">${label}</a>`).run();
                    } else {
                        editor.chain().focus().insertContent(`<span style="display: inline-block; padding: 8px 16px; background: #6366f1; color: white; border-radius: 8px; font-weight: 500;">${label}</span>`).run();
                    }
                    toast.success('Botão criado!');
                },
            },
            {
                title: 'Breadcrumb',
                description: 'Caminho de navegação',
                icon: <Navigation className="w-4 h-4" />,
                action: (editor) => {
                    const path = window.prompt('Caminho (separado por >):', 'Início > Seção > Página') || 'Início > Seção > Página';
                    const parts = path.split('>').map(p => p.trim());
                    const breadcrumb = parts.map((p, i) =>
                        i === parts.length - 1
                            ? `<span style="font-weight: 600;">${p}</span>`
                            : `<span style="color: #666;">${p}</span>`
                    ).join(' <span style="color: #999;">›</span> ');
                    editor.chain().focus().insertContent(`<div style="padding: 8px 0; font-size: 14px;">📍 ${breadcrumb}</div>`).run();
                },
            },
            {
                title: 'Bloco de destaque',
                description: 'Box destacado',
                icon: <RefreshCw className="w-4 h-4" />,
                action: (editor) => {
                    editor.chain().focus().insertContent(`
                        <div style="padding: 20px; margin: 16px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
                            <h3 style="margin: 0 0 8px 0; font-size: 18px;">✨ Destaque</h3>
                            <p style="margin: 0; opacity: 0.9;">Adicione conteúdo importante aqui...</p>
                        </div>
                    `).run();
                    toast.success('Bloco de destaque criado!');
                },
            },
        ],
    },
    {
        title: 'IA',
        items: [
            {
                title: 'AI Block',
                description: 'Gerar estrutura com IA',
                icon: <Sparkles className="w-4 h-4" />,
                badge: 'Novo',
                action: (editor) => {
                    const options = [
                        '1. Lista de prós e contras',
                        '2. Resumo executivo',
                        '3. Plano de ação',
                        '4. FAQ',
                        '5. Comparativo'
                    ];
                    const choice = window.prompt(`Escolha um template:\n${options.join('\n')}\n\nDigite o número:`, '1');

                    const templates: Record<string, string> = {
                        '1': `
## ⚖️ Prós e Contras

### ✅ Prós
- Ponto positivo 1
- Ponto positivo 2
- Ponto positivo 3

### ❌ Contras
- Ponto negativo 1
- Ponto negativo 2
- Ponto negativo 3
                        `,
                        '2': `
## 📋 Resumo Executivo

**Objetivo:** [Descreva o objetivo]

**Principais pontos:**
1. Ponto 1
2. Ponto 2
3. Ponto 3

**Conclusão:** [Sua conclusão]
                        `,
                        '3': `
## 🎯 Plano de Ação

| Ação | Responsável | Prazo | Status |
|------|-------------|-------|--------|
| Tarefa 1 | Nome | DD/MM | ⏳ |
| Tarefa 2 | Nome | DD/MM | ⏳ |
| Tarefa 3 | Nome | DD/MM | ⏳ |
                        `,
                        '4': `
## ❓ FAQ - Perguntas Frequentes

<details>
<summary><strong>Pergunta 1?</strong></summary>
Resposta detalhada aqui...
</details>

<details>
<summary><strong>Pergunta 2?</strong></summary>
Resposta detalhada aqui...
</details>

<details>
<summary><strong>Pergunta 3?</strong></summary>
Resposta detalhada aqui...
</details>
                        `,
                        '5': `
## 🔄 Comparativo

| Critério | Opção A | Opção B |
|----------|---------|---------|
| Preço | R$ X | R$ Y |
| Qualidade | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Suporte | Bom | Excelente |

**Recomendação:** [Sua escolha]
                        `,
                    };

                    const template = templates[choice || '1'] || templates['1'];
                    editor.chain().focus().insertContent(template).run();
                    toast.success('Template IA inserido!');
                },
            },
            {
                title: 'Diagrama Mermaid',
                description: 'Fluxograma via código',
                icon: <GitBranch className="w-4 h-4" />,
                action: (editor) => {
                    const diagrams = {
                        'flowchart': 'graph TD\n    A[Início] --> B{Decisão}\n    B -->|Sim| C[Ação 1]\n    B -->|Não| D[Ação 2]\n    C --> E[Fim]\n    D --> E',
                        'sequence': 'sequenceDiagram\n    Alice->>Bob: Olá!\n    Bob-->>Alice: Oi, tudo bem?\n    Alice->>Bob: Tudo ótimo!',
                        'pie': 'pie title Distribuição\n    "A" : 40\n    "B" : 30\n    "C" : 30',
                    };

                    const type = window.prompt('Tipo (flowchart, sequence, pie):', 'flowchart') || 'flowchart';
                    const code = diagrams[type as keyof typeof diagrams] || diagrams.flowchart;

                    editor.chain().focus().insertContent(`
<pre class="p-4 my-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto"><code>\`\`\`mermaid
${code}
\`\`\`</code></pre>
<p class="text-xs text-muted-foreground">💡 Cole este código em um visualizador Mermaid para ver o diagrama</p>
                    `).run();
                    toast.success('Diagrama Mermaid inserido!');
                },
            },
        ],
    },
    {
        title: 'Importar',
        items: [
            {
                title: 'CSV',
                description: 'Importar planilha como tabela',
                icon: <FileSpreadsheet className="w-4 h-4" />,
                action: (editor) => {
                    createFileInput('.csv', (content, fileName) => {
                        const tableHtml = csvToTable(content);
                        editor.chain().focus().insertContent(tableHtml).run();
                        toast.success(`Tabela importada de ${fileName}!`);
                    });
                },
            },
            {
                title: 'HTML',
                description: 'Importar código HTML',
                icon: <FileCode className="w-4 h-4" />,
                action: (editor) => {
                    createFileInput('.html,.htm', (content, fileName) => {
                        // Extract body content if full HTML document
                        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                        const htmlContent = bodyMatch ? bodyMatch[1] : content;
                        editor.chain().focus().insertContent(htmlContent).run();
                        toast.success(`HTML importado de ${fileName}!`);
                    });
                },
            },
            {
                title: 'Texto e Markdown',
                description: 'Importar arquivo .txt ou .md',
                icon: <FileText className="w-4 h-4" />,
                action: (editor) => {
                    createFileInput('.txt,.md,.markdown', (content, fileName) => {
                        // Basic markdown conversion
                        let html = content
                            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/`(.*?)`/g, '<code>$1</code>')
                            .replace(/^\- (.*$)/gm, '<li>$1</li>')
                            .replace(/\n\n/g, '</p><p>')
                            .replace(/\n/g, '<br>');
                        html = '<p>' + html + '</p>';
                        editor.chain().focus().insertContent(html).run();
                        toast.success(`Texto importado de ${fileName}!`);
                    });
                },
            },
            {
                title: 'JSON',
                description: 'Importar dados JSON formatados',
                icon: <Braces className="w-4 h-4" />,
                action: (editor) => {
                    createFileInput('.json', (content, fileName) => {
                        try {
                            const data = JSON.parse(content);
                            const formatted = JSON.stringify(data, null, 2);
                            editor.chain().focus().insertContent(`<pre class="p-4 my-4 bg-gray-100 rounded-lg overflow-x-auto text-sm"><code>${formatted}</code></pre>`).run();
                            toast.success(`JSON importado de ${fileName}!`);
                        } catch (e) {
                            toast.error('JSON inválido!');
                        }
                    });
                },
            },
            {
                title: 'Colar da área de transferência',
                description: 'Colar conteúdo formatado',
                icon: <Upload className="w-4 h-4" />,
                action: async (editor) => {
                    try {
                        const text = await navigator.clipboard.readText();
                        if (text) {
                            editor.chain().focus().insertContent(text).run();
                            toast.success('Conteúdo colado!');
                        } else {
                            toast.error('Área de transferência vazia');
                        }
                    } catch (e) {
                        toast.error('Não foi possível acessar a área de transferência');
                    }
                },
            },
        ],
    },
];

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter commands based on search
    const filteredGroups = COMMAND_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item =>
            item.title.toLowerCase().includes(search.toLowerCase()) ||
            item.description?.toLowerCase().includes(search.toLowerCase())
        ),
    })).filter(group => group.items.length > 0);

    const allItems = filteredGroups.flatMap(g => g.items);

    // Open menu when typing "/"
    useEffect(() => {
        if (!editor) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === '/' && !isOpen) {
                event.preventDefault();
                const { view } = editor;
                const { from } = view.state.selection;
                const coords = view.coordsAtPos(from);

                setPosition({
                    top: coords.bottom + 8,
                    left: coords.left,
                });
                setIsOpen(true);
                setSearch('');
                setSelectedIndex(0);
                setTimeout(() => inputRef.current?.focus(), 50);
            }
        };

        const editorElement = editor.view.dom;
        editorElement.addEventListener('keydown', handleKeyDown);
        return () => editorElement.removeEventListener('keydown', handleKeyDown);
    }, [editor, isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (allItems[selectedIndex] && editor) {
                allItems[selectedIndex].action(editor);
                setIsOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    }, [allItems, selectedIndex, editor]);

    const executeCommand = (item: CommandItem) => {
        if (editor) {
            item.action(editor);
            setIsOpen(false);
        }
    };

    // Floating "+" button
    const handlePlusClick = () => {
        if (!editor) return;

        const { view } = editor;
        const { from } = view.state.selection;
        const coords = view.coordsAtPos(from);

        setPosition({
            top: coords.bottom + 8,
            left: coords.left,
        });
        setIsOpen(true);
        setSearch('');
        setSelectedIndex(0);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    if (!editor) return null;

    return (
        <>
            {/* Floating + Button */}
            <button
                onClick={handlePlusClick}
                className={cn(
                    'fixed z-40 p-1.5 rounded-lg transition-all duration-200',
                    'bg-muted hover:bg-accent border shadow-sm',
                    'opacity-0 group-hover:opacity-100 focus:opacity-100',
                    'hover:scale-110'
                )}
                style={{
                    top: position.top - 40 || 100,
                    left: position.left - 40 || 100,
                }}
                title="Adicionar bloco (ou digite /)"
            >
                <Plus className="w-4 h-4" />
            </button>

            {/* Command Menu */}
            {isOpen && (
                <div
                    ref={menuRef}
                    className="fixed z-50 w-80 bg-popover border rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95"
                    style={{ top: position.top, left: position.left }}
                >
                    {/* Search Input */}
                    <div className="p-2 border-b">
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setSelectedIndex(0);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Digite para filtrar..."
                            className="w-full px-3 py-1.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
                        />
                    </div>

                    {/* Commands List */}
                    <div className="max-h-96 overflow-y-auto p-1">
                        {filteredGroups.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                Nenhum resultado encontrado
                            </div>
                        ) : (
                            filteredGroups.map((group, gi) => {
                                const startIndex = filteredGroups
                                    .slice(0, gi)
                                    .reduce((acc, g) => acc + g.items.length, 0);

                                return (
                                    <div key={group.title}>
                                        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            {group.title}
                                        </div>
                                        {group.items.map((item, ii) => {
                                            const globalIndex = startIndex + ii;
                                            return (
                                                <button
                                                    key={item.title}
                                                    onClick={() => executeCommand(item)}
                                                    className={cn(
                                                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                                                        globalIndex === selectedIndex
                                                            ? 'bg-accent'
                                                            : 'hover:bg-accent/50'
                                                    )}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                        {item.icon}
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">{item.title}</span>
                                                            {item.badge && (
                                                                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/20 text-primary">
                                                                    {item.badge}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.description && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {item.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {item.shortcut && (
                                                        <span className="text-xs text-muted-foreground font-mono">
                                                            {item.shortcut}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer hint */}
                    <div className="px-3 py-2 border-t text-xs text-muted-foreground flex items-center justify-between">
                        <span>↑↓ navegar</span>
                        <span>↵ selecionar</span>
                        <span>esc fechar</span>
                    </div>
                </div>
            )}
        </>
    );
}
