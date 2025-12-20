'use client';

import { Node, mergeAttributes } from '@tiptap/react';
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, X, Loader2, Globe } from 'lucide-react';

interface LinkPreviewData {
    url: string;
    title: string | null;
    description: string | null;
    image: string | null;
    favicon: string | null;
    siteName: string | null;
    domain: string;
}

interface LinkPreviewViewProps extends NodeViewProps { }

function LinkPreviewView({ node, deleteNode, selected }: LinkPreviewViewProps) {
    const { url, title, description, image, favicon, domain, loading } = node.attrs;
    const [isLoading, setIsLoading] = useState(loading || false);

    // Sync isLoading with node's loading attribute
    useEffect(() => {
        setIsLoading(loading || false);
    }, [loading]);

    const handleOpenLink = useCallback(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
    }, [url]);

    if (isLoading) {
        return (
            <NodeViewWrapper className="my-3">
                <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30 animate-pulse">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Carregando prévia do link...</span>
                </div>
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper className="my-3">
            <div
                className={cn(
                    'group relative flex overflow-hidden rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer',
                    selected && 'ring-2 ring-primary ring-offset-2'
                )}
                onClick={handleOpenLink}
            >
                {/* Image */}
                {image && (
                    <div className="hidden sm:block w-48 h-32 flex-shrink-0 bg-muted overflow-hidden">
                        <img
                            src={image}
                            alt={title || 'Link preview'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 p-4 min-w-0">
                    {/* Site info */}
                    <div className="flex items-center gap-2 mb-2">
                        {favicon ? (
                            <img
                                src={favicon}
                                alt=""
                                className="w-4 h-4 rounded-sm"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <Globe className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-xs text-muted-foreground truncate">{domain}</span>
                    </div>

                    {/* Title */}
                    <h4 className="font-semibold text-sm text-foreground line-clamp-1 mb-1">
                        {title || url}
                    </h4>

                    {/* Description */}
                    {description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                            {description}
                        </p>
                    )}
                </div>

                {/* External link icon */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>

                {/* Delete button */}
                {selected && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteNode();
                        }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>
        </NodeViewWrapper>
    );
}

// Custom LinkPreview Node
export const LinkPreview = Node.create({
    name: 'linkPreview',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            url: { default: '' },
            title: { default: null },
            description: { default: null },
            image: { default: null },
            favicon: { default: null },
            siteName: { default: null },
            domain: { default: '' },
            loading: { default: false },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-link-preview]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-link-preview': '' }, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(LinkPreviewView, { flushSync: false } as any);
    },
});

export default LinkPreview;
export type { LinkPreviewData };
