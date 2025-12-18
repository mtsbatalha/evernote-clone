'use client';

import { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import {
    Bold,
    Code,
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
    Quote,
    Redo,
    Strikethrough,
    Underline as UnderlineIcon,
    Undo,
} from 'lucide-react';

interface EditorToolbarProps {
    editor: Editor;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
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

    const addImage = () => {
        const url = window.prompt('Enter image URL:');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
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
        <div className="flex items-center flex-wrap gap-0.5 p-2 rounded-lg bg-muted/50 border">
            {/* History */}
            <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                title="Undo"
            >
                <Undo className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                title="Redo"
            >
                <Redo className="w-4 h-4" />
            </ToolbarButton>

            <Separator />

            {/* Headings */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
            >
                <Heading1 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
            >
                <Heading2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Heading 3"
            >
                <Heading3 className="w-4 h-4" />
            </ToolbarButton>

            <Separator />

            {/* Text formatting */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Bold"
            >
                <Bold className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Italic"
            >
                <Italic className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                title="Underline"
            >
                <UnderlineIcon className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                title="Strikethrough"
            >
                <Strikethrough className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                isActive={editor.isActive('highlight')}
                title="Highlight"
            >
                <Highlighter className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={editor.isActive('code')}
                title="Inline code"
            >
                <Code className="w-4 h-4" />
            </ToolbarButton>

            <Separator />

            {/* Lists */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet list"
            >
                <List className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Numbered list"
            >
                <ListOrdered className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                isActive={editor.isActive('taskList')}
                title="Task list"
            >
                <ListTodo className="w-4 h-4" />
            </ToolbarButton>

            <Separator />

            {/* Block elements */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Quote"
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
            <ToolbarButton onClick={addImage} title="Image">
                <Image className="w-4 h-4" />
            </ToolbarButton>
        </div>
    );
}
