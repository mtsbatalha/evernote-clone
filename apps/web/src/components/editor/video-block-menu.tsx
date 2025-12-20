'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    MessageSquare,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Type,
    MoreHorizontal,
    ExternalLink,
    Link2,
    Copy,
    Trash2,
    Sparkles,
    X,
} from 'lucide-react';

interface VideoBlockMenuProps {
    url: string;
    caption?: string;
    alignment?: 'left' | 'center' | 'right';
    onDelete: () => void;
    onCaptionChange?: (caption: string) => void;
    onAlignmentChange?: (alignment: 'left' | 'center' | 'right') => void;
    onCaptionEdit?: () => void;
    onComment?: () => void;
    isSelected: boolean;
}

// Simple Floating Toolbar for video blocks
export function VideoBlockToolbar({
    url,
    alignment = 'center',
    onDelete,
    onCaptionChange,
    onAlignmentChange,
    onCaptionEdit,
    onComment,
    isSelected,
}: VideoBlockMenuProps) {
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showCaptionInput, setShowCaptionInput] = useState(false);
    const [captionValue, setCaptionValue] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMoreMenu(false);
                setShowCaptionInput(false);
            }
        };

        if (showMoreMenu || showCaptionInput) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showMoreMenu, showCaptionInput]);

    const handleCopyLink = useCallback(() => {
        navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
        setShowMoreMenu(false);
    }, [url]);

    const handleViewOriginal = useCallback(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
        setShowMoreMenu(false);
    }, [url]);

    const handleCommentClick = useCallback(() => {
        if (onComment) {
            onComment();
        } else {
            toast.info('Clique na legenda para editar');
        }
    }, [onComment]);

    const handleSaveCaption = useCallback(() => {
        if (onCaptionChange && captionValue.trim()) {
            onCaptionChange(captionValue);
            toast.success('Legenda adicionada!');
        }
        setShowCaptionInput(false);
        setCaptionValue('');
    }, [captionValue, onCaptionChange]);

    const handleCaptionClick = useCallback(() => {
        if (onCaptionEdit) {
            onCaptionEdit();
        } else {
            setShowCaptionInput(!showCaptionInput);
        }
    }, [onCaptionEdit, showCaptionInput]);

    if (!isSelected) return null;

    return (
        <div
            ref={menuRef}
            className="absolute top-3 right-3 z-[100] flex items-center gap-0.5 p-1 rounded-lg shadow-2xl"
            style={{
                backgroundColor: '#1f1f23',
                border: '1px solid #3f3f46'
            }}
        >
            {/* Comment */}
            <button
                onClick={handleCommentClick}
                className="p-2 rounded-md hover:bg-zinc-700 transition-colors text-zinc-300 hover:text-white"
                title="Comentar"
            >
                <MessageSquare className="w-4 h-4" />
            </button>

            {/* Caption */}
            <button
                onClick={handleCaptionClick}
                className="p-2 rounded-md hover:bg-zinc-700 transition-colors text-zinc-300 hover:text-white"
                title="Legenda"
            >
                <Type className="w-4 h-4" />
            </button>

            {/* Alignment */}
            <button
                onClick={() => {
                    const next = alignment === 'left' ? 'center' : alignment === 'center' ? 'right' : 'left';
                    onAlignmentChange?.(next);
                    toast.success(`Alinhamento: ${next === 'left' ? 'Esquerda' : next === 'center' ? 'Centro' : 'Direita'}`);
                }}
                className="p-2 rounded-md hover:bg-zinc-700 transition-colors text-zinc-300 hover:text-white"
                title="Alinhamento"
            >
                {alignment === 'left' && <AlignLeft className="w-4 h-4" />}
                {alignment === 'center' && <AlignCenter className="w-4 h-4" />}
                {alignment === 'right' && <AlignRight className="w-4 h-4" />}
            </button>

            {/* More options */}
            <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 rounded-md hover:bg-zinc-700 transition-colors text-zinc-300 hover:text-white"
                title="Mais opções"
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Caption Input Popup */}
            {showCaptionInput && (
                <div
                    className="absolute top-full right-0 mt-2 p-3 rounded-lg shadow-2xl min-w-[250px]"
                    style={{
                        backgroundColor: '#1f1f23',
                        border: '1px solid #3f3f46'
                    }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-zinc-100">Adicionar legenda</span>
                        <button
                            onClick={() => setShowCaptionInput(false)}
                            className="p-1 rounded hover:bg-zinc-700 text-zinc-400"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <input
                        type="text"
                        value={captionValue}
                        onChange={(e) => setCaptionValue(e.target.value)}
                        placeholder="Digite a legenda..."
                        className="w-full px-3 py-2 text-sm rounded-lg mb-2 focus:outline-none focus:ring-1 focus:ring-primary text-zinc-100"
                        style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }}
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveCaption();
                            if (e.key === 'Escape') setShowCaptionInput(false);
                        }}
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setShowCaptionInput(false)}
                            className="px-3 py-1.5 text-sm rounded-lg hover:bg-zinc-700 text-zinc-300"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveCaption}
                            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            )}

            {/* More Options Dropdown */}
            {showMoreMenu && (
                <div
                    className="absolute top-full right-0 mt-2 py-2 rounded-xl shadow-2xl min-w-[220px]"
                    style={{
                        backgroundColor: '#1f1f23',
                        border: '1px solid #3f3f46'
                    }}
                >
                    <button
                        onClick={handleViewOriginal}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 text-sm text-zinc-100"
                    >
                        <ExternalLink className="w-4 h-4 text-zinc-400" />
                        <span>Ver original</span>
                    </button>

                    <button
                        onClick={handleCopyLink}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 text-sm text-zinc-100"
                    >
                        <Link2 className="w-4 h-4 text-zinc-400" />
                        <span>Copiar link</span>
                    </button>

                    <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 text-sm text-zinc-100"
                    >
                        <Copy className="w-4 h-4 text-zinc-400" />
                        <span>Duplicar</span>
                    </button>

                    <div className="h-px bg-zinc-700 my-2" />

                    <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 text-sm text-zinc-100"
                    >
                        <Sparkles className="w-4 h-4 text-zinc-400" />
                        <span>Perguntar à IA</span>
                    </button>

                    <div className="h-px bg-zinc-700 my-2" />

                    <button
                        onClick={() => { onDelete(); setShowMoreMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/20 text-sm text-red-400"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>Excluir</span>
                    </button>

                    <div className="h-px bg-zinc-700 my-2" />

                    <div className="px-4 py-2 text-xs text-zinc-500">
                        Última edição por você<br />
                        Hoje às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default VideoBlockToolbar;
