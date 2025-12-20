'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { Type, Link2, Bookmark, Video } from 'lucide-react';

export type PasteOption = 'text' | 'link' | 'bookmark' | 'embed';

interface PasteMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    url: string;
    onSelect: (option: PasteOption) => void;
    onClose: () => void;
}

const PASTE_OPTIONS = [
    {
        id: 'text' as PasteOption,
        label: 'Colar como texto',
        description: 'Colar URL como texto simples',
        icon: Type,
    },
    {
        id: 'link' as PasteOption,
        label: 'Colar como link',
        description: 'Criar um hyperlink clicável',
        icon: Link2,
    },
    {
        id: 'bookmark' as PasteOption,
        label: 'Marcador',
        description: 'Criar card de prévia do link',
        icon: Bookmark,
    },
    {
        id: 'embed' as PasteOption,
        label: 'Incorporar',
        description: 'Incorporar conteúdo (YouTube, etc.)',
        icon: Video,
    },
];

export function PasteMenu({ isOpen, position, url, onSelect, onClose }: PasteMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            // Delay to avoid closing immediately from the paste event
            const timer = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-64 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95"
            style={{
                top: position.y,
                left: position.x,
            }}
        >
            {/* Header */}
            <div className="px-3 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground">Colar como</p>
            </div>

            {/* Options */}
            <div className="py-1">
                {PASTE_OPTIONS.map((option) => (
                    <button
                        key={option.id}
                        onClick={() => onSelect(option.id)}
                        className={cn(
                            'w-full flex items-start gap-3 px-3 py-2.5 text-left',
                            'hover:bg-accent transition-colors'
                        )}
                    >
                        <option.icon className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{option.label}</p>
                            <p className="text-xs text-muted-foreground truncate">
                                {option.description}
                            </p>
                        </div>
                    </button>
                ))}
            </div>

            {/* URL Preview */}
            <div className="px-3 py-2 border-t border-border bg-muted/30">
                <p className="text-xs text-muted-foreground truncate" title={url}>
                    {url}
                </p>
            </div>
        </div>
    );
}

export default PasteMenu;
