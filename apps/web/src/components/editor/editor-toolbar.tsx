'use client';

import { useState } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { UploadButton } from './file-upload';
import { ImageEditorDialog, ImageData } from './image-editor-dialog';
import { Attachment } from '@/lib/api';
import {
    Bold,
    Code,
    FileCode,
    Heading1,
    Heading2,
    Heading3,
    Highlighter,
    Image,
    Italic,
    Link,
    List,
    ListOrdered,
    ListTodo,
    Paperclip,
    Quote,
    Redo,
    Strikethrough,
    Underline as UnderlineIcon,
    Undo,
} from 'lucide-react';

interface EditorToolbarProps {
    editor: Editor;
    noteId?: string;
    token?: string;
    onAttachmentUpload?: (attachment: Attachment) => void;
}

export function EditorToolbar({ editor, noteId, token, onAttachmentUpload }: EditorToolbarProps) {
    const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

    const ToolbarButton = ({
        onClick,
        isActive,
        children,
        title,
    }: {
        onClick: () => void;
        isActive?: boolean;
        children: React.ReactNode;
        title: string;
    }) => (
        <button
            onClick={onClick}
            title={title}
            className={cn(
                'p-2 rounded-lg transition-colors',
                isActive
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
        >
            {children}
        </button>
    );

    const Separator = () => <div className="w-px h-6 bg-border mx-1" />;

    const handleImageInsert = (imageData: ImageData) => {
        // Insert image with all attributes including caption
        editor.chain().focus().insertContent({
            type: 'image',
            attrs: {
                src: imageData.src,
                alt: imageData.alt || imageData.caption || 'Imagem',
                width: imageData.width || null,
                height: imageData.height || null,
                caption: imageData.caption || '',
            },
        }).run();
    };

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('Enter URL:', previousUrl);

        if (url === null) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <>
            <div className="flex items-center flex-wrap gap-0.5 p-2 rounded-lg bg-muted/50 border">
                {/* History */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    title="Desfazer"
                >
                    <Undo className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    title="Refazer"
                >
                    <Redo className="w-4 h-4" />
                </ToolbarButton>

                <Separator />

                {/* Headings */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    isActive={editor.isActive('heading', { level: 1 })}
                    title="Título 1"
                >
                    <Heading1 className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive('heading', { level: 2 })}
                    title="Título 2"
                >
                    <Heading2 className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    isActive={editor.isActive('heading', { level: 3 })}
                    title="Título 3"
                >
                    <Heading3 className="w-4 h-4" />
                </ToolbarButton>

                <Separator />

                {/* Text formatting */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    title="Negrito"
                >
                    <Bold className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    title="Itálico"
                >
                    <Italic className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive('underline')}
                    title="Sublinhado"
                >
                    <UnderlineIcon className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive('strike')}
                    title="Tachado"
                >
                    <Strikethrough className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHighlight().run()}
                    isActive={editor.isActive('highlight')}
                    title="Realçar"
                >
                    <Highlighter className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    isActive={editor.isActive('code')}
                    title="Código inline"
                >
                    <Code className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    isActive={editor.isActive('codeBlock')}
                    title="Bloco de código"
                >
                    <FileCode className="w-4 h-4" />
                </ToolbarButton>

                <Separator />

                {/* Lists */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    title="Lista com marcadores"
                >
                    <List className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    title="Lista numerada"
                >
                    <ListOrdered className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    isActive={editor.isActive('taskList')}
                    title="Lista de tarefas"
                >
                    <ListTodo className="w-4 h-4" />
                </ToolbarButton>

                <Separator />

                {/* Block elements */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    isActive={editor.isActive('blockquote')}
                    title="Citação"
                >
                    <Quote className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={setLink}
                    isActive={editor.isActive('link')}
                    title="Link"
                >
                    <Link className="w-4 h-4" />
                </ToolbarButton>

                {/* Image - Opens editor dialog with upload, URL, resize, crop, caption */}
                <ToolbarButton
                    onClick={() => setIsImageDialogOpen(true)}
                    title="Inserir Imagem (Upload, URL, Redimensionar, Cortar, Legenda)"
                >
                    <Image className="w-4 h-4" />
                </ToolbarButton>

                {/* Attach File - only show if we have noteId and token */}
                {noteId && token && (
                    <>
                        <Separator />
                        <UploadButton
                            noteId={noteId}
                            token={token}
                            accept="*/*"
                            onUploadComplete={onAttachmentUpload}
                            icon={<Paperclip className="w-4 h-4" />}
                            title="Anexar arquivo"
                        />
                    </>
                )}
            </div>

            {/* Image Editor Dialog */}
            <ImageEditorDialog
                isOpen={isImageDialogOpen}
                onClose={() => setIsImageDialogOpen(false)}
                onInsert={handleImageInsert}
            />
        </>
    );
}
