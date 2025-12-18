'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Typography from '@tiptap/extension-typography';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore } from '@/store/notes-store';
import { notesApi } from '@/lib/api';
import { EditorToolbar } from './editor-toolbar';
import { SlashCommandMenu } from './slash-command-menu';
import { ShareDialog } from '@/components/dialogs/share-dialog';
import { VersionHistoryDialog } from '@/components/dialogs/version-history-dialog';
import { TagsDialog } from '@/components/dialogs/tags-dialog';
import { ExportDialog } from '@/components/dialogs/export-dialog';
import { tiptapToHtml } from '@/lib/export-utils';
import {
    Cloud,
    CloudOff,
    Download,
    Hash,
    History,
    Loader2,
    Printer,
    Share2,
    Tag,
    Users,
} from 'lucide-react';

interface NoteEditorProps {
    noteId: string;
}

export function NoteEditor({ noteId }: NoteEditorProps) {
    const { token } = useAuthStore();
    const { updateNote } = useNotesStore();
    const [note, setNote] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [title, setTitle] = useState('');
    const [noteTags, setNoteTags] = useState<any[]>([]);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                history: {
                    depth: 100,
                },
            }),
            Placeholder.configure({
                placeholder: 'Start writing...',
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline underline-offset-2',
                },
            }),
            Image.configure({
                HTMLAttributes: {
                    class: 'rounded-lg max-w-full',
                },
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Highlight.configure({
                multicolor: true,
            }),
            Underline,
            Typography,
        ],
        editorProps: {
            attributes: {
                class: 'tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)]',
            },
        },
        onUpdate: ({ editor }) => {
            debouncedSave(editor);
        },
    });

    // Load note
    useEffect(() => {
        const loadNote = async () => {
            if (!token) return;

            setIsLoading(true);
            try {
                const noteData = await notesApi.getById(token, noteId);
                setNote(noteData);
                setTitle(noteData.title);
                setNoteTags(noteData.tags || []);

                if (editor) {
                    // Set content or clear if empty (new note)
                    if (noteData.content) {
                        editor.commands.setContent(noteData.content);
                    } else {
                        editor.commands.clearContent();
                    }
                }
            } catch (error) {
                toast.error('Failed to load note');
            } finally {
                setIsLoading(false);
            }
        };

        loadNote();
    }, [noteId, token, editor]);

    // Debounced save
    const debouncedSave = useCallback(
        (editorInstance: Editor) => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = setTimeout(async () => {
                if (!token) return;

                setIsSaving(true);
                try {
                    const content = editorInstance.getJSON();
                    const plainText = editorInstance.getText();

                    await notesApi.update(token, noteId, { content, plainText });
                    updateNote(noteId, { content, plainText, updatedAt: new Date().toISOString() });
                    setLastSaved(new Date());
                } catch (error) {
                    console.error('Auto-save failed:', error);
                } finally {
                    setIsSaving(false);
                }
            }, 1000);
        },
        [token, noteId, updateNote]
    );

    // Save title
    const handleTitleChange = (newTitle: string) => {
        setTitle(newTitle);

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            if (!token) return;

            try {
                await notesApi.update(token, noteId, { title: newTitle });
                updateNote(noteId, { title: newTitle, updatedAt: new Date().toISOString() });
                setLastSaved(new Date());
            } catch (error) {
                console.error('Failed to save title:', error);
            }
        }, 500);
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!note) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Note not found
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-screen">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    {/* Save status */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : lastSaved ? (
                            <>
                                <Cloud className="w-4 h-4 text-green-500" />
                                <span>Saved</span>
                            </>
                        ) : (
                            <>
                                <CloudOff className="w-4 h-4" />
                                <span>Not saved</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Collaborators indicator */}
                    {note.shares?.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-sm">
                            <Users className="w-4 h-4" />
                            <span>{note.shares.length + 1}</span>
                        </div>
                    )}

                    {/* Tags */}
                    <TagsDialog
                        noteId={noteId}
                        noteTags={noteTags}
                        onTagsUpdate={(tags) => setNoteTags(tags)}
                    >
                        <button
                            className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                                'border hover:bg-accent transition-colors',
                                noteTags.length > 0 && 'bg-primary/5'
                            )}
                            title="Tags"
                        >
                            <Tag className="w-4 h-4" />
                            {noteTags.length > 0 && (
                                <div className="flex items-center gap-1">
                                    {noteTags.slice(0, 2).map((tag) => (
                                        <span
                                            key={tag.id}
                                            className="px-1.5 py-0.5 rounded text-xs"
                                            style={{ backgroundColor: `${tag.color || '#6366f1'}20`, color: tag.color || '#6366f1' }}
                                        >
                                            {tag.name}
                                        </span>
                                    ))}
                                    {noteTags.length > 2 && (
                                        <span className="text-xs text-muted-foreground">+{noteTags.length - 2}</span>
                                    )}
                                </div>
                            )}
                        </button>
                    </TagsDialog>

                    {/* Version History button */}
                    <VersionHistoryDialog noteId={noteId} noteTitle={title}>
                        <button
                            className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                                'border hover:bg-accent transition-colors'
                            )}
                            title="Histórico de versões"
                        >
                            <History className="w-4 h-4" />
                        </button>
                    </VersionHistoryDialog>

                    {/* Export button */}
                    <ExportDialog note={{
                        id: noteId,
                        title,
                        content: editor?.getJSON(),
                        plainText: editor?.getText(),
                        createdAt: note?.createdAt || new Date().toISOString(),
                        updatedAt: note?.updatedAt || new Date().toISOString(),
                        tags: noteTags,
                    }}>
                        <button
                            className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                                'border hover:bg-accent transition-colors'
                            )}
                            title="Exportar"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </ExportDialog>

                    {/* Print button */}
                    <button
                        onClick={() => {
                            const htmlContent = tiptapToHtml(editor?.getJSON());
                            const printWindow = window.open('', '_blank');
                            if (!printWindow) return;

                            printWindow.document.write(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
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
    <h1>${title}</h1>
    ${htmlContent}
    <script>setTimeout(() => { window.print(); window.close(); }, 250);<\/script>
</body>
</html>
                            `);
                            printWindow.document.close();
                        }}
                        className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                            'border hover:bg-accent transition-colors'
                        )}
                        title="Imprimir"
                    >
                        <Printer className="w-4 h-4" />
                    </button>

                    {/* Share button */}
                    <ShareDialog noteId={noteId} noteTitle={title}>
                        <button
                            className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                                'border hover:bg-accent transition-colors'
                            )}
                        >
                            <Share2 className="w-4 h-4" />
                            <span>Compartilhar</span>
                        </button>
                    </ShareDialog>
                </div>
            </header>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto group">
                <div className="max-w-4xl mx-auto px-6 py-8">
                    {/* Title */}
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="Sem título"
                        className="w-full text-4xl font-bold bg-transparent border-none focus:outline-none placeholder:text-muted-foreground/50 mb-6"
                    />

                    {/* Toolbar */}
                    {editor && <EditorToolbar editor={editor} />}

                    {/* Slash Command Menu */}
                    <SlashCommandMenu editor={editor} />

                    {/* Content */}
                    <EditorContent editor={editor} className="mt-4" />
                </div>
            </div>
        </div>
    );
}
