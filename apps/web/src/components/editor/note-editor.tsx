'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, Editor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Typography from '@tiptap/extension-typography';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { ResizableImage } from './extensions/resizable-image';
import { CodeBlockWithLanguage } from './extensions/code-block-language';
import { LinkPreview } from './extensions/link-preview';
import { VideoEmbed, getVideoEmbedInfo } from './extensions/video-embed';
import { ImageEditorDialog, ImageData } from './image-editor-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore } from '@/store/notes-store';
import { notesApi, storageApi, metadataApi, Attachment } from '@/lib/api';
import { EditorToolbar } from './editor-toolbar';
import { SlashCommandMenu } from './slash-command-menu';
import { PasteMenu, PasteOption } from './paste-menu';
import { NoteActionsMenu } from './note-actions-menu';
import { AttachmentList } from './attachment-list';
import { ShareDialog } from '@/components/dialogs/share-dialog';
import { VersionHistoryDialog } from '@/components/dialogs/version-history-dialog';
import { TagsDialog } from '@/components/dialogs/tags-dialog';
import { ExportDialog } from '@/components/dialogs/export-dialog';
import { SearchInNote } from './search-in-note';
import { tiptapToHtml } from '@/lib/export-utils';
import {
    Cloud,
    CloudOff,
    Download,
    Hash,
    History,
    Loader2,
    MoreHorizontal,
    Printer,
    Share2,
    Star,
    Tag,
    Users,
    ChevronUp,
    ChevronDown,
} from 'lucide-react';



interface NoteEditorProps {
    noteId: string;
}

export function NoteEditor({ noteId }: NoteEditorProps) {
    const { token } = useAuthStore();
    const { updateNote, searchHighlight, clearSearchHighlight } = useNotesStore();
    const [note, setNote] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [title, setTitle] = useState('');
    const [noteTags, setNoteTags] = useState<any[]>([]);
    const [isSmallText, setIsSmallText] = useState(false);
    const [isFullWidth, setIsFullWidth] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [fontStyle, setFontStyle] = useState('default');
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [editingImage, setEditingImage] = useState<{
        src: string;
        alt?: string;
        width?: number;
        height?: number;
        updateAttributes: (attrs: Record<string, any>) => void;
    } | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isInitialLoadRef = useRef(true); // Flag to skip auto-save on initial content load
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const titleTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Paste menu state
    const [pasteMenuOpen, setPasteMenuOpen] = useState(false);
    const [pasteMenuPosition, setPasteMenuPosition] = useState({ x: 0, y: 0 });
    const [pendingPasteUrl, setPendingPasteUrl] = useState('');

    // Local search state (Ctrl+F)
    const [localSearchOpen, setLocalSearchOpen] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState('');

    const editor = useEditor({
        immediatelyRender: false, // Defer render to avoid flushSync conflict with React 19
        shouldRerenderOnTransaction: false, // Prevent rerenders on every transaction
        extensions: [
            StarterKit.configure({
                codeBlock: false, // Using custom CodeBlockWithLanguage instead
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
            ResizableImage,
            CodeBlockWithLanguage,
            LinkPreview,
            VideoEmbed,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Highlight.configure({
                multicolor: true,
            }),
            Underline,
            Typography,
            // Table extensions for imported content
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableCell,
            TableHeader,
        ],
        editorProps: {
            attributes: {
                class: 'tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)]',
            },
            handlePaste: (view, event) => {
                const text = event.clipboardData?.getData('text/plain');
                if (text && isValidUrl(text) && token) {
                    // Pasted a URL - show paste menu instead of auto-inserting
                    const { from } = view.state.selection;
                    const coords = view.coordsAtPos(from);

                    // Defer to avoid React rendering conflicts
                    setTimeout(() => {
                        setPendingPasteUrl(text.trim());
                        setPasteMenuPosition({
                            x: Math.min(coords.left, window.innerWidth - 280),
                            y: coords.bottom + 8,
                        });
                        setPasteMenuOpen(true);
                    }, 0);
                    return true;
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            // Skip auto-save during initial content load
            if (isInitialLoadRef.current) {
                return;
            }
            debouncedSave(editor);
        },
    });

    // Helper to check if text is a valid URL
    const isValidUrl = (text: string): boolean => {
        try {
            const url = new URL(text.trim());
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    };

    // Insert link preview with loading state, then fetch metadata
    const insertLinkPreview = useCallback(async (url: string) => {
        if (!editor || !token) return;

        // Insert placeholder with loading state
        const previewNode = {
            type: 'linkPreview',
            attrs: {
                url,
                title: null,
                description: null,
                image: null,
                favicon: null,
                domain: new URL(url).hostname,
                loading: true,
            },
        };

        editor.chain().focus().insertContent(previewNode).run();

        try {
            // Fetch metadata from backend
            const metadata = await metadataApi.getLinkPreview(token, url);

            // Find and update the loading preview
            const { state } = editor;
            let foundPos: number | null = null;

            state.doc.descendants((node, pos) => {
                if (node.type.name === 'linkPreview' && node.attrs.url === url && node.attrs.loading) {
                    foundPos = pos;
                    return false;
                }
                return true;
            });

            if (foundPos !== null) {
                editor.chain()
                    .focus()
                    .command(({ tr }) => {
                        tr.setNodeMarkup(foundPos!, undefined, {
                            url,
                            title: metadata.title,
                            description: metadata.description,
                            image: metadata.image,
                            favicon: metadata.favicon,
                            siteName: metadata.siteName,
                            domain: metadata.domain,
                            loading: false,
                        });
                        return true;
                    })
                    .run();
            }
        } catch (error) {
            console.error('Failed to fetch link preview:', error);
            // Update to show just the domain on error
            const { state } = editor;
            let foundPos: number | null = null;

            state.doc.descendants((node, pos) => {
                if (node.type.name === 'linkPreview' && node.attrs.url === url && node.attrs.loading) {
                    foundPos = pos;
                    return false;
                }
                return true;
            });

            if (foundPos !== null) {
                editor.chain()
                    .focus()
                    .command(({ tr }) => {
                        tr.setNodeMarkup(foundPos!, undefined, {
                            url,
                            title: new URL(url).hostname,
                            description: null,
                            image: null,
                            favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`,
                            domain: new URL(url).hostname,
                            loading: false,
                        });
                        return true;
                    })
                    .run();
            }
        }
    }, [editor, token]);

    // Handle paste menu option selection
    const handlePasteOption = useCallback((option: PasteOption) => {
        if (!editor || !pendingPasteUrl) return;

        setPasteMenuOpen(false);

        switch (option) {
            case 'text':
                // Insert as plain text
                editor.chain().focus().insertContent(pendingPasteUrl).run();
                break;

            case 'link':
                // Insert as clickable link
                editor.chain()
                    .focus()
                    .insertContent({
                        type: 'text',
                        text: pendingPasteUrl,
                        marks: [{ type: 'link', attrs: { href: pendingPasteUrl } }],
                    })
                    .run();
                break;

            case 'bookmark':
                // Insert as link preview card
                insertLinkPreview(pendingPasteUrl);
                break;

            case 'embed':
                // Try to create embed for supported platforms using VideoEmbed node
                const embedInfo = getVideoEmbedInfo(pendingPasteUrl);
                if (embedInfo) {
                    editor.chain()
                        .focus()
                        .insertContent({
                            type: 'videoEmbed',
                            attrs: {
                                url: embedInfo.url,
                                embedUrl: embedInfo.embedUrl,
                                platform: embedInfo.platform,
                            },
                        })
                        .run();
                } else {
                    // Fallback to bookmark if embed not supported
                    insertLinkPreview(pendingPasteUrl);
                    toast.info('Este link não suporta incorporação. Criado como marcador.');
                }
                break;
        }

        setPendingPasteUrl('');
    }, [editor, pendingPasteUrl, insertLinkPreview]);

    // Load note and attachments
    useEffect(() => {
        const loadNote = async () => {
            if (!token) return;

            setIsLoading(true);
            try {
                const noteData = await notesApi.getById(token, noteId);
                setNote(noteData);
                setTitle(noteData.title);
                // Tags come from API in format { tag: {...} } - unwrap them
                const tagsList = (noteData.tags || []).map((t: any) => t.tag || t);
                setNoteTags(tagsList);

                if (editor) {
                    // Set flag to skip auto-save during content load
                    isInitialLoadRef.current = true;

                    // Set content or clear if empty (new note)
                    if (noteData.content) {
                        editor.commands.setContent(noteData.content);
                    } else {
                        editor.commands.clearContent();
                    }

                    // Allow auto-save after content is loaded (with delay to skip initial onUpdate)
                    setTimeout(() => {
                        isInitialLoadRef.current = false;
                    }, 100);
                }

                // Load attachments
                try {
                    const noteAttachments = await storageApi.getAttachments(token, noteId);
                    setAttachments(noteAttachments);
                } catch (e) {
                    // Attachments endpoint may not exist yet, silently fail
                    console.log('Attachments not available');
                }
            } catch (error) {
                toast.error('Failed to load note');
            } finally {
                setIsLoading(false);
            }
        };

        loadNote();
    }, [noteId, token, editor]);

    // Auto-resize title textarea when title changes or on initial load
    useEffect(() => {
        if (titleTextareaRef.current) {
            titleTextareaRef.current.style.height = 'auto';
            titleTextareaRef.current.style.height = titleTextareaRef.current.scrollHeight + 'px';
        }
    }, [title]);

    // Ctrl+F keyboard shortcut for in-note search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setLocalSearchOpen(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Open local search handler (for toolbar button)
    const handleOpenLocalSearch = useCallback(() => {
        setLocalSearchOpen(true);
    }, []);

    // Close local search handler
    const handleCloseLocalSearch = useCallback(() => {
        setLocalSearchOpen(false);
        setLocalSearchQuery('');
    }, []);

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

    // Handle attachment upload
    const handleAttachmentUpload = useCallback((attachment: Attachment) => {
        setAttachments(prev => [attachment, ...prev]);
    }, []);

    // Handle attachment delete
    const handleAttachmentDelete = useCallback((attachmentId: string) => {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    }, []);

    // Handle file drop on editor area
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDraggingFile(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);

        if (!token || isLocked) return;

        const files = e.dataTransfer.files;
        const firstFile = files?.[0];
        if (!firstFile) return;

        // Check file size
        if (firstFile.size > 10 * 1024 * 1024) {
            toast.error('Arquivo muito grande. Máximo: 10MB');
            return;
        }

        try {
            toast.loading('Enviando arquivo...', { id: 'file-upload' });
            const attachment = await storageApi.uploadFile(token, noteId, firstFile);
            toast.success('Arquivo enviado!', { id: 'file-upload' });

            // If it's an image, insert into editor
            if (firstFile.type.startsWith('image/') && editor) {
                editor.chain().focus().setImage({ src: attachment.url }).run();
            }

            handleAttachmentUpload(attachment);
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Falha ao enviar arquivo', { id: 'file-upload' });
        }
    }, [token, noteId, isLocked, editor, handleAttachmentUpload]);

    // Listen for double-click on images to open editor
    useEffect(() => {
        const handleOpenImageEditor = (e: Event) => {
            const customEvent = e as CustomEvent;
            setEditingImage(customEvent.detail);
        };

        const handleContinueAfterImage = () => {
            if (editor) {
                // Insert a new paragraph after current position and focus it
                const { state } = editor;
                const { selection } = state;
                const pos = selection.$to.after(1);

                editor.chain()
                    .focus()
                    .insertContentAt(pos, { type: 'paragraph' })
                    .setTextSelection(pos + 1)
                    .run();
            }
        };

        window.addEventListener('open-image-editor', handleOpenImageEditor);
        window.addEventListener('continue-after-image', handleContinueAfterImage);
        return () => {
            window.removeEventListener('open-image-editor', handleOpenImageEditor);
            window.removeEventListener('continue-after-image', handleContinueAfterImage);
        };
    }, [editor]);

    // Handle inline image edit
    const handleInlineImageEdit = useCallback((imageData: ImageData) => {
        if (editingImage) {
            editingImage.updateAttributes({
                src: imageData.src,
                alt: imageData.alt,
                width: imageData.width,
                height: imageData.height,
                caption: imageData.caption || '',
            });
        }
        setEditingImage(null);
    }, [editingImage]);

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
                                    {noteTags.slice(0, 2).map((tag, index) => (
                                        <span
                                            key={tag.id || index}
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

                    {/* Favorite button */}
                    <button
                        className={cn(
                            'p-2 rounded-lg hover:bg-accent transition-colors',
                            'text-muted-foreground hover:text-foreground'
                        )}
                        title="Favoritar"
                    >
                        <Star className="w-5 h-5" />
                    </button>

                    {/* Actions Menu */}
                    <NoteActionsMenu
                        noteId={noteId}
                        noteTitle={title}
                        noteContent={editor?.getJSON()}
                        isSmallText={isSmallText}
                        onSmallTextChange={setIsSmallText}
                        isFullWidth={isFullWidth}
                        onFullWidthChange={setIsFullWidth}
                        isLocked={isLocked}
                        onLockedChange={setIsLocked}
                        fontStyle={fontStyle}
                        onFontStyleChange={setFontStyle}
                        onVersionHistory={() => setShowVersionHistory(true)}
                    >
                        <button
                            className={cn(
                                'p-2 rounded-lg hover:bg-accent transition-colors',
                                'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <MoreHorizontal className="w-5 h-5" />
                        </button>
                    </NoteActionsMenu>
                </div>
            </header>

            {/* Editor */}
            <div
                ref={scrollContainerRef}
                className={cn(
                    "flex-1 overflow-y-auto group relative",
                    isDraggingFile && "ring-2 ring-primary ring-inset bg-primary/5"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Floating scroll navigation buttons */}
                <div className="fixed right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
                    <button
                        onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="p-2 rounded-full bg-background/50 border border-border/50 text-muted-foreground/40 hover:text-foreground hover:bg-background hover:border-border transition-all shadow-sm"
                        title="Ir para o início"
                    >
                        <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' })}
                        className="p-2 rounded-full bg-background/50 border border-border/50 text-muted-foreground/40 hover:text-foreground hover:bg-background hover:border-border transition-all shadow-sm"
                        title="Ir para o final"
                    >
                        <ChevronDown className="w-5 h-5" />
                    </button>
                </div>
                {/* Search in note navigation - appears when coming from search OR local Ctrl+F */}
                {((searchHighlight && !isLoading && editor) || (localSearchOpen && editor)) && (
                    <SearchInNote
                        searchQuery={searchHighlight || localSearchQuery}
                        onClose={() => {
                            if (searchHighlight) {
                                clearSearchHighlight();
                            }
                            handleCloseLocalSearch();
                        }}
                        onQueryChange={setLocalSearchQuery}
                        showInput={localSearchOpen}
                    />
                )}
                {/* Drop overlay */}
                {isDraggingFile && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
                        <div className="flex flex-col items-center gap-2 text-primary">
                            <div className="p-4 rounded-full bg-primary/10">
                                <Download className="w-8 h-8" />
                            </div>
                            <span className="text-lg font-medium">Solte o arquivo aqui</span>
                            <span className="text-sm text-muted-foreground">Imagens serão inseridas no editor</span>
                        </div>
                    </div>
                )}

                {/* Sticky Toolbar - directly in scroll container for sticky to work */}
                {editor && !isLocked && (
                    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
                        <div className={cn(
                            'mx-auto px-6 py-3',
                            isFullWidth ? 'max-w-none px-12' : 'max-w-4xl'
                        )}>
                            <EditorToolbar
                                editor={editor}
                                noteId={noteId}
                                token={token || undefined}
                                onAttachmentUpload={handleAttachmentUpload}
                                onSearch={handleOpenLocalSearch}
                            />
                        </div>
                    </div>
                )}

                <div className={cn(
                    'mx-auto px-6 py-8 transition-all',
                    isFullWidth ? 'max-w-none px-12' : 'max-w-4xl'
                )}>
                    {/* Title */}
                    <textarea
                        ref={titleTextareaRef}
                        value={title}
                        onChange={(e) => {
                            handleTitleChange(e.target.value);
                            // Auto-resize
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        placeholder="Sem título"
                        disabled={isLocked}
                        rows={1}
                        className={cn(
                            'w-full font-bold bg-transparent border-none focus:outline-none placeholder:text-muted-foreground/50 mb-6 resize-none overflow-hidden whitespace-pre-wrap break-words',
                            // Dynamic text size based on title length
                            title.length > 60 ? 'text-xl' : title.length > 40 ? 'text-2xl' : isSmallText ? 'text-2xl' : 'text-4xl',
                            isLocked && 'cursor-not-allowed opacity-70'
                        )}
                        style={{ lineHeight: '1.2', minHeight: '48px' }}
                    />

                    {/* Slash Command Menu */}
                    {!isLocked && <SlashCommandMenu editor={editor} />}

                    {/* Content */}
                    {editor ? (
                        <EditorContent
                            editor={editor}
                            className={cn(
                                'mt-4',
                                isSmallText && 'text-sm',
                                isLocked && 'pointer-events-none opacity-70',
                                fontStyle === 'serif' && 'font-serif',
                                fontStyle === 'mono' && 'font-mono'
                            )}
                        />
                    ) : (
                        <div className="mt-4 min-h-[200px] animate-pulse bg-muted/30 rounded-lg" />
                    )}

                    {/* Attachments List */}
                    {token && attachments.length > 0 && (
                        <AttachmentList
                            attachments={attachments}
                            token={token}
                            onDelete={handleAttachmentDelete}
                        />
                    )}
                </div>
            </div>

            {/* Version History Dialog - controlled */}
            {showVersionHistory && (
                <VersionHistoryDialog
                    noteId={noteId}
                    noteTitle={title}
                    open={showVersionHistory}
                    onOpenChange={(open) => setShowVersionHistory(open)}
                />
            )}

            {/* Inline Image Editor Dialog - opened by double-click on images */}
            {editingImage && (
                <ImageEditorDialog
                    isOpen={true}
                    onClose={() => setEditingImage(null)}
                    onInsert={handleInlineImageEdit}
                    initialImage={editingImage.src}
                    initialWidth={editingImage.width}
                    initialHeight={editingImage.height}
                />
            )}

            {/* Paste Menu - shown when pasting a URL */}
            <PasteMenu
                isOpen={pasteMenuOpen}
                position={pasteMenuPosition}
                url={pendingPasteUrl}
                onSelect={handlePasteOption}
                onClose={() => {
                    setPasteMenuOpen(false);
                    setPendingPasteUrl('');
                }}
            />
        </div>
    );
}

