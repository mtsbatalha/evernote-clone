'use client';

import Image from '@tiptap/extension-image';
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Maximize2 } from 'lucide-react';

interface ResizableImageProps extends NodeViewProps { }

function ResizableImageView({ node, updateAttributes, selected }: ResizableImageProps) {
    const { src, alt, width, height, caption } = node.attrs;
    const [isResizing, setIsResizing] = useState(false);
    const [aspectRatio, setAspectRatio] = useState(1);
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate aspect ratio when image loads
    useEffect(() => {
        if (imageRef.current && imageRef.current.complete) {
            const ratio = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
            setAspectRatio(ratio);
        }
    }, [src]);

    const handleImageLoad = useCallback(() => {
        if (imageRef.current) {
            const ratio = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
            setAspectRatio(ratio);

            // Set initial width if not set
            if (!width) {
                const initialWidth = Math.min(imageRef.current.naturalWidth, 600);
                updateAttributes({ width: initialWidth });
            }
        }
    }, [width, updateAttributes]);

    const handleMouseDown = useCallback((e: React.MouseEvent, corner: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!containerRef.current) return;

        setIsResizing(true);

        const startX = e.clientX;
        const startWidth = width || containerRef.current.offsetWidth;

        const handleMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - startX;
            let newWidth = corner.includes('right') ? startWidth + diff : startWidth - diff;
            newWidth = Math.max(100, Math.min(newWidth, 1200)); // Min 100px, max 1200px

            updateAttributes({
                width: Math.round(newWidth),
                height: Math.round(newWidth / aspectRatio),
            });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [width, aspectRatio, updateAttributes]);

    const handleDoubleClick = useCallback(() => {
        // Dispatch custom event to open image editor
        const event = new CustomEvent('open-image-editor', {
            detail: {
                src,
                alt,
                width,
                height,
                caption,
                updateAttributes,
            },
        });
        window.dispatchEvent(event);
    }, [src, alt, width, height, caption, updateAttributes]);

    const hasCaption = caption && caption.trim().length > 0;

    return (
        <NodeViewWrapper className="my-4">
            <figure
                ref={containerRef}
                className={cn(
                    'relative inline-flex flex-col items-center rounded-xl overflow-visible group',
                    hasCaption && 'bg-muted/30 border border-border/50 p-3',
                    selected && 'ring-2 ring-primary ring-offset-2',
                    isResizing && 'select-none'
                )}
                style={{
                    width: width ? `${width + (hasCaption ? 24 : 0)}px` : 'fit-content',
                    maxWidth: '100%',
                }}
            >
                {/* Image */}
                <div className="relative">
                    <img
                        ref={imageRef}
                        src={src}
                        alt={alt || caption || 'Imagem'}
                        onLoad={handleImageLoad}
                        onDoubleClick={handleDoubleClick}
                        className="block rounded-lg max-w-full cursor-pointer"
                        style={{
                            width: width ? `${width}px` : 'auto',
                            height: 'auto',
                        }}
                        draggable={false}
                    />

                    {/* Resize Handles - visible when selected or hovering */}
                    {(selected || isResizing) && (
                        <>
                            {/* Bottom-right handle */}
                            <div
                                className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10 flex items-center justify-center bg-primary rounded-tl-lg rounded-br-lg shadow-md hover:bg-primary/90 transition-colors"
                                onMouseDown={(e) => handleMouseDown(e, 'bottom-right')}
                            >
                                <Maximize2 className="w-3 h-3 text-primary-foreground rotate-90" />
                            </div>

                            {/* Bottom-left handle */}
                            <div
                                className="absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize z-10 flex items-center justify-center bg-primary rounded-tr-lg rounded-bl-lg shadow-md hover:bg-primary/90 transition-colors"
                                onMouseDown={(e) => handleMouseDown(e, 'bottom-left')}
                            >
                                <Maximize2 className="w-3 h-3 text-primary-foreground -rotate-180" />
                            </div>

                            {/* Size indicator */}
                            <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded-md pointer-events-none">
                                {width ? `${width}px` : 'auto'}
                            </div>
                        </>
                    )}

                    {/* Double-click hint */}
                    {selected && !isResizing && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/70 text-white text-xs rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Duplo clique para editar
                        </div>
                    )}
                </div>

                {/* Caption - centered below image */}
                {hasCaption && (
                    <figcaption className="mt-3 text-sm text-muted-foreground text-center italic w-full px-2">
                        {caption}
                    </figcaption>
                )}
            </figure>

            {/* Click to continue editing area - visible when selected */}
            {selected && (
                <div
                    className="w-full flex justify-center py-2 cursor-text group/continue"
                    onClick={(e) => {
                        e.stopPropagation();
                        // Get the editor from the node view props and insert paragraph after
                        const event = new CustomEvent('continue-after-image');
                        window.dispatchEvent(event);
                    }}
                    contentEditable={false}
                >
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
                        <span>↵</span>
                        <span>Clique para continuar escrevendo</span>
                    </div>
                </div>
            )}
        </NodeViewWrapper>
    );
}

// Custom Image Extension with resize, double-click, and caption support
export const ResizableImage = Image.extend({
    name: 'image',

    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: (element) => {
                    const width = element.getAttribute('width');
                    return width ? parseInt(width, 10) : null;
                },
                renderHTML: (attributes) => {
                    if (!attributes.width) return {};
                    return { width: attributes.width };
                },
            },
            height: {
                default: null,
                parseHTML: (element) => {
                    const height = element.getAttribute('height');
                    return height ? parseInt(height, 10) : null;
                },
                renderHTML: (attributes) => {
                    if (!attributes.height) return {};
                    return { height: attributes.height };
                },
            },
            caption: {
                default: '',
                parseHTML: (element) => {
                    // Try to get caption from data attribute or figcaption sibling
                    return element.getAttribute('data-caption') || '';
                },
                renderHTML: (attributes) => {
                    if (!attributes.caption) return {};
                    return { 'data-caption': attributes.caption };
                },
            },
        };
    },

    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageView, { flushSync: false } as any);
    },
});

export default ResizableImage;
