'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import {
    AlignLeft,
    ChevronRight,
    Code,
    Divide,
    File,
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
    Plus,
    Table,
    Text,
    ToggleLeft,
    Type,
    Video,
} from 'lucide-react';

interface SlashCommandMenuProps {
    editor: Editor | null;
}

interface CommandItem {
    title: string;
    description?: string;
    icon: React.ReactNode;
    shortcut?: string;
    action: (editor: Editor) => void;
}

interface CommandGroup {
    title: string;
    items: CommandItem[];
}

const COMMAND_GROUPS: CommandGroup[] = [
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
                title: 'Imagem',
                description: 'Inserir imagem via URL',
                icon: <Image className="w-4 h-4" />,
                action: (editor) => {
                    const url = window.prompt('URL da imagem:');
                    if (url) {
                        editor.chain().focus().setImage({ src: url }).run();
                    }
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
                        editor.chain().focus().setLink({ href: url }).run();
                    }
                },
            },
        ],
    },
    {
        title: 'Avançado',
        items: [
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
                title: 'Código inline',
                description: 'Texto com formatação de código',
                icon: <Code className="w-4 h-4" />,
                shortcut: '`',
                action: (editor) => editor.chain().focus().toggleCode().run(),
            },
            {
                title: 'Destaque',
                description: 'Texto destacado',
                icon: <AlignLeft className="w-4 h-4" />,
                action: (editor) => editor.chain().focus().toggleHighlight().run(),
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
                    className="fixed z-50 w-72 bg-popover border rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95"
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
                    <div className="max-h-80 overflow-y-auto p-1">
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
                                                        <p className="font-medium">{item.title}</p>
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
                        <span>↑↓ para navegar</span>
                        <span>↵ para selecionar</span>
                        <span>esc para fechar</span>
                    </div>
                </div>
            )}
        </>
    );
}
