import Image from '@tiptap/extension-image';
import { mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Maximize2, Minimize2, Pencil, Trash2 } from 'lucide-react';

// Custom Image Node View with caption and resize handles
function ImageNodeView({ node, updateAttributes, deleteNode, selected }: any) {
    const { src, alt, caption, width, height } = node.attrs;
    const [isResizing, setIsResizing] = useState(false);
    const [startWidth, setStartWidth] = useState(0);
    const [startX, setStartX] = useState(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        setStartWidth(width || 400);
        setStartX(e.clientX);

        const handleMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - startX;
            const newWidth = Math.max(100, startWidth + diff);
            updateAttributes({ width: newWidth });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [startX, startWidth, updateAttributes]);

    return (
        <NodeViewWrapper className="relative my-4">
            <figure className={cn(
                "relative inline-block max-w-full rounded-lg overflow-hidden",
                selected && "ring-2 ring-primary ring-offset-2"
            )}>
                <img
                    src={src}
                    alt={alt || caption || 'Imagem'}
                    style={{
                        width: width ? `${width}px` : 'auto',
                        height: height ? `${height}px` : 'auto',
                        maxWidth: '100%',
                    }}
                    className="rounded-lg"
                    draggable={false}
                />

                {/* Resize Handle */}
                {selected && (
                    <div
                        className="absolute bottom-2 right-2 w-4 h-4 bg-primary rounded cursor-se-resize flex items-center justify-center"
                        onMouseDown={handleMouseDown}
                    >
                        <Maximize2 className="w-3 h-3 text-primary-foreground" />
                    </div>
                )}

                {/* Caption */}
                {caption && (
                    <figcaption className="text-sm text-muted-foreground text-center mt-2 italic">
                        {caption}
                    </figcaption>
                )}
            </figure>
        </NodeViewWrapper>
    );
}

// Extended Image Extension
export const ImageWithCaption = Image.extend({
    name: 'imageWithCaption',

    addAttributes() {
        return {
            ...this.parent?.(),
            caption: {
                default: '',
            },
            width: {
                default: null,
            },
            height: {
                default: null,
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'figure',
                getAttrs: (dom) => {
                    const img = (dom as HTMLElement).querySelector('img');
                    const caption = (dom as HTMLElement).querySelector('figcaption');

                    return {
                        src: img?.getAttribute('src'),
                        alt: img?.getAttribute('alt'),
                        caption: caption?.textContent || '',
                        width: img?.getAttribute('width') ? parseInt(img.getAttribute('width')!) : null,
                        height: img?.getAttribute('height') ? parseInt(img.getAttribute('height')!) : null,
                    };
                },
            },
            {
                tag: 'img[src]',
                getAttrs: (dom) => ({
                    src: (dom as HTMLElement).getAttribute('src'),
                    alt: (dom as HTMLElement).getAttribute('alt'),
                    width: (dom as HTMLElement).getAttribute('width') ? parseInt((dom as HTMLElement).getAttribute('width')!) : null,
                    height: (dom as HTMLElement).getAttribute('height') ? parseInt((dom as HTMLElement).getAttribute('height')!) : null,
                }),
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { caption, ...imgAttrs } = HTMLAttributes;

        if (caption) {
            return [
                'figure',
                { class: 'image-with-caption' },
                ['img', mergeAttributes(this.options.HTMLAttributes, imgAttrs)],
                ['figcaption', {}, caption],
            ];
        }

        return ['img', mergeAttributes(this.options.HTMLAttributes, imgAttrs)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ImageNodeView);
    },
});

export default ImageWithCaption;
