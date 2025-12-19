'use client';

import { useState, useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore } from '@/store/notes-store';
import { notesApi } from '@/lib/api';
import { tiptapToHtml } from '@/lib/export-utils';
import { useRouter } from 'next/navigation';
import {
    ChevronRight,
    Copy,
    Download,
    FileText,
    History,
    Link,
    Lock,
    MoreHorizontal,
    Move,
    Printer,
    RotateCcw,
    Search,
    Trash2,
    Type,
    Unlock,
    Upload,
} from 'lucide-react';

interface NoteActionsMenuProps {
    noteId: string;
    noteTitle: string;
    noteContent?: any;
    isSmallText?: boolean;
    onSmallTextChange?: (v: boolean) => void;
    isFullWidth?: boolean;
    onFullWidthChange?: (v: boolean) => void;
    isLocked?: boolean;
    onLockedChange?: (v: boolean) => void;
    fontStyle?: string;
    onFontStyleChange?: (v: string) => void;
    onVersionHistory?: () => void;
    children?: React.ReactNode;
}

const FONT_STYLES = [
    { id: 'default', name: 'Padrão', className: 'font-sans' },
    { id: 'serif', name: 'Serif', className: 'font-serif' },
    { id: 'mono', name: 'Mono', className: 'font-mono' },
];

export function NoteActionsMenu({
    noteId,
    noteTitle,
    noteContent,
    isSmallText = false,
    onSmallTextChange,
    isFullWidth = false,
    onFullWidthChange,
    isLocked = false,
    onLockedChange,
    fontStyle = 'default',
    onFontStyleChange,
    onVersionHistory,
    children
}: NoteActionsMenuProps) {
    const router = useRouter();
    const { token } = useAuthStore();
    const { notes, updateNote, removeNote, notebooks, addNote } = useNotesStore();
    const [open, setOpen] = useState(false);

    const note = notes.find(n => n.id === noteId);

    // Copy link to clipboard
    const handleCopyLink = async () => {
        const url = `${window.location.origin}/notes/${noteId}`;
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado para a área de transferência!');
        setOpen(false);
    };

    // Duplicate note
    const handleDuplicate = async () => {
        if (!token || !note) return;
        try {
            const newNote = await notesApi.create(token, {
                title: `${noteTitle} (cópia)`,
                content: note.content || noteContent,
                notebookId: note.notebookId ?? undefined,
            });
            addNote(newNote);
            toast.success('Nota duplicada com sucesso!');
            router.push(`/notes/${newNote.id}`);
            setOpen(false);
        } catch (error) {
            toast.error('Falha ao duplicar nota');
        }
    };

    // Move to trash
    const handleMoveToTrash = async () => {
        if (!token) return;
        try {
            await notesApi.delete(token, noteId);
            removeNote(noteId);
            toast.success('Nota movida para a lixeira');
            router.push('/');
            setOpen(false);
        } catch (error) {
            toast.error('Falha ao mover para lixeira');
        }
    };

    // Move to notebook
    const handleMoveToNotebook = async (notebookId: string, notebookName: string) => {
        if (!token) return;
        try {
            await notesApi.update(token, noteId, { notebookId });
            updateNote(noteId, { notebookId });
            toast.success(`Nota movida para "${notebookName}"`);
            setOpen(false);
        } catch (error) {
            toast.error('Falha ao mover nota');
        }
    };

    // Print
    const handlePrint = () => {
        const content = note?.content || noteContent;
        const htmlContent = tiptapToHtml(content);
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Pop-up bloqueado. Permita pop-ups para imprimir.');
            return;
        }

        printWindow.document.write(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>${noteTitle}</title>
    <style>
        @media print { body { margin: 0; padding: 20mm; } @page { margin: 15mm; } }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; }
        h1, h2, h3 { margin-top: 1.5em; }
        pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; }
        code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }
        img { max-width: 100%; }
    </style>
</head>
<body>
    <h1>${noteTitle}</h1>
    ${htmlContent}
    <script>setTimeout(() => { window.print(); window.close(); }, 250);<\/script>
</body>
</html>
        `);
        printWindow.document.close();
        setOpen(false);
    };

    // Export as JSON
    const handleExportJson = () => {
        const content = note?.content || noteContent;
        const backup = {
            title: noteTitle,
            content,
            exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${noteTitle.replace(/[/\\?%*:|"<>]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Nota exportada!');
        setOpen(false);
    };

    return (
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
            <DropdownMenu.Trigger asChild>
                {children || (
                    <button
                        className={cn(
                            'p-2 rounded-lg hover:bg-accent transition-colors',
                            'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                )}
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={5}
                    className={cn(
                        'w-64 p-2 rounded-xl shadow-xl border',
                        'bg-popover text-popover-foreground',
                        'animate-in fade-in-0 zoom-in-95',
                        'z-50'
                    )}
                >
                    {/* Search placeholder */}
                    <div className="px-2 pb-2 mb-2 border-b">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted text-sm text-muted-foreground">
                            <Search className="w-4 h-4" />
                            <span>Buscar ações...</span>
                        </div>
                    </div>

                    {/* Font Styles */}
                    <div className="flex items-center gap-2 px-2 pb-2 mb-2 border-b">
                        {FONT_STYLES.map(style => (
                            <button
                                key={style.id}
                                onClick={() => {
                                    onFontStyleChange?.(style.id);
                                    toast.success(`Fonte alterada para ${style.name}`);
                                }}
                                className={cn(
                                    'flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-colors',
                                    fontStyle === style.id
                                        ? 'bg-primary/10 text-primary border border-primary/30'
                                        : 'hover:bg-accent border border-transparent'
                                )}
                            >
                                <span className={cn('text-lg font-semibold', style.className)}>Ag</span>
                                <span className="text-[10px] text-muted-foreground">{style.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <DropdownMenu.Item
                        onClick={handleCopyLink}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent outline-none"
                    >
                        <Link className="w-4 h-4" />
                        <span className="flex-1">Copiar link</span>
                        <span className="text-xs text-muted-foreground">Ctrl+Alt+L</span>
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                        onClick={handleDuplicate}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent outline-none"
                    >
                        <Copy className="w-4 h-4" />
                        <span className="flex-1">Duplicar</span>
                        <span className="text-xs text-muted-foreground">Ctrl+D</span>
                    </DropdownMenu.Item>

                    {/* Move to submenu */}
                    <DropdownMenu.Sub>
                        <DropdownMenu.SubTrigger className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent outline-none">
                            <Move className="w-4 h-4" />
                            <span className="flex-1">Mover para</span>
                            <ChevronRight className="w-4 h-4" />
                        </DropdownMenu.SubTrigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.SubContent
                                sideOffset={5}
                                className={cn(
                                    'w-48 p-2 rounded-xl shadow-xl border',
                                    'bg-popover text-popover-foreground',
                                    'animate-in fade-in-0 slide-in-from-left-2',
                                    'z-50'
                                )}
                            >
                                {notebooks.length === 0 ? (
                                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                        Nenhum caderno disponível
                                    </div>
                                ) : (
                                    notebooks.map(nb => (
                                        <DropdownMenu.Item
                                            key={nb.id}
                                            onClick={() => handleMoveToNotebook(nb.id, nb.name)}
                                            className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent outline-none"
                                        >
                                            <div
                                                className="w-3 h-3 rounded-full shrink-0"
                                                style={{ backgroundColor: nb.color || '#6366f1' }}
                                            />
                                            <span className="truncate">{nb.name}</span>
                                        </DropdownMenu.Item>
                                    ))
                                )}
                            </DropdownMenu.SubContent>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Sub>

                    <DropdownMenu.Item
                        onClick={handleMoveToTrash}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-destructive/10 outline-none text-destructive"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span className="flex-1">Mover para lixeira</span>
                    </DropdownMenu.Item>

                    <DropdownMenu.Separator className="my-2 h-px bg-border" />

                    {/* Toggles */}
                    <div
                        onClick={() => {
                            onSmallTextChange?.(!isSmallText);
                            toast.success(isSmallText ? 'Texto normal' : 'Texto pequeno ativado');
                        }}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent"
                    >
                        <Type className="w-4 h-4" />
                        <span className="flex-1">Texto pequeno</span>
                        <div className={cn(
                            'w-8 h-4 rounded-full transition-colors relative',
                            isSmallText ? 'bg-primary' : 'bg-muted'
                        )}>
                            <div className={cn(
                                'absolute top-0 w-4 h-4 rounded-full bg-white shadow transition-all',
                                isSmallText ? 'left-4' : 'left-0'
                            )} />
                        </div>
                    </div>

                    <div
                        onClick={() => {
                            onFullWidthChange?.(!isFullWidth);
                            toast.success(isFullWidth ? 'Largura normal' : 'Largura total ativada');
                        }}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent"
                    >
                        <FileText className="w-4 h-4" />
                        <span className="flex-1">Largura total</span>
                        <div className={cn(
                            'w-8 h-4 rounded-full transition-colors relative',
                            isFullWidth ? 'bg-primary' : 'bg-muted'
                        )}>
                            <div className={cn(
                                'absolute top-0 w-4 h-4 rounded-full bg-white shadow transition-all',
                                isFullWidth ? 'left-4' : 'left-0'
                            )} />
                        </div>
                    </div>

                    <div
                        onClick={() => {
                            onLockedChange?.(!isLocked);
                            toast.success(isLocked ? 'Página desbloqueada' : 'Página bloqueada');
                        }}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent"
                    >
                        {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        <span className="flex-1">Bloquear página</span>
                        <div className={cn(
                            'w-8 h-4 rounded-full transition-colors relative',
                            isLocked ? 'bg-primary' : 'bg-muted'
                        )}>
                            <div className={cn(
                                'absolute top-0 w-4 h-4 rounded-full bg-white shadow transition-all',
                                isLocked ? 'left-4' : 'left-0'
                            )} />
                        </div>
                    </div>

                    <DropdownMenu.Separator className="my-2 h-px bg-border" />

                    {/* Export/Print */}
                    <DropdownMenu.Item
                        onClick={handleExportJson}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent outline-none"
                    >
                        <Download className="w-4 h-4" />
                        <span className="flex-1">Exportar</span>
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                        onClick={handlePrint}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent outline-none"
                    >
                        <Printer className="w-4 h-4" />
                        <span className="flex-1">Imprimir</span>
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                        onClick={() => { setOpen(false); onVersionHistory?.(); }}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent outline-none"
                    >
                        <History className="w-4 h-4" />
                        <span className="flex-1">Histórico de versões</span>
                    </DropdownMenu.Item>

                    <DropdownMenu.Separator className="my-2 h-px bg-border" />

                    {/* Footer */}
                    <div className="px-2 pt-2 text-xs text-muted-foreground">
                        <p>Última edição: agora</p>
                    </div>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
