'use client';

import { Node, mergeAttributes } from '@tiptap/react';
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Maximize2, Minimize2, ExternalLink, Play } from 'lucide-react';
import { VideoBlockToolbar } from '../video-block-menu';

interface VideoEmbedData {
    url: string;
    embedUrl: string;
    platform: 'youtube' | 'vimeo' | 'spotify' | 'unknown';
    title?: string;
    thumbnail?: string;
}

interface VideoEmbedViewProps extends NodeViewProps { }

function VideoEmbedView({ node, deleteNode, selected, updateAttributes }: VideoEmbedViewProps) {
    const { url, embedUrl, platform, title, alignment, caption, comments = [] } = node.attrs;
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [captionText, setCaptionText] = useState(caption || '');
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [commentText, setCommentText] = useState('');

    // Get video thumbnail
    useEffect(() => {
        if (platform === 'youtube') {
            // Extract video ID and create thumbnail URL
            const videoId = extractVideoId(url, 'youtube');
            if (videoId) {
                setThumbnail(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
            }
        } else if (platform === 'vimeo') {
            // Vimeo requires an API call for thumbnail, use placeholder
            setThumbnail(null);
        }
    }, [url, platform]);

    const handleOpenExternal = useCallback(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
    }, [url]);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(!isFullscreen);
    }, [isFullscreen]);

    const handleAlignmentChange = useCallback((newAlignment: 'left' | 'center' | 'right') => {
        updateAttributes({ alignment: newAlignment });
    }, [updateAttributes]);

    const handleCaptionChange = useCallback((newCaption: string) => {
        updateAttributes({ caption: newCaption });
    }, [updateAttributes]);

    // Save caption when editing is done
    const handleCaptionSave = useCallback(() => {
        updateAttributes({ caption: captionText });
        setIsEditingCaption(false);
    }, [captionText, updateAttributes]);

    // Handle adding a comment - saves to node attributes
    const handleAddComment = useCallback(() => {
        if (commentText.trim()) {
            const newComment = {
                id: Date.now().toString(),
                text: commentText.trim(),
                createdAt: new Date().toISOString(),
            };
            const updatedComments = [...(comments || []), newComment];
            updateAttributes({ comments: updatedComments });

            const { toast } = require('sonner');
            toast.success('Comentário adicionado!');
            setCommentText('');
            setShowCommentInput(false);
        }
    }, [commentText, comments, updateAttributes]);

    // Delete a comment
    const handleDeleteComment = useCallback((commentId: string) => {
        const updatedComments = (comments || []).filter((c: any) => c.id !== commentId);
        updateAttributes({ comments: updatedComments });
        const { toast } = require('sonner');
        toast.success('Comentário removido!');
    }, [comments, updateAttributes]);

    // Alignment styles
    const alignmentClasses = {
        left: 'mr-auto',
        center: 'mx-auto',
        right: 'ml-auto',
    };

    // Render Spotify with compact horizontal player (like in the user's image)
    if (platform === 'spotify') {
        return (
            <NodeViewWrapper className="my-4">
                <div className={cn('relative', alignmentClasses[alignment as keyof typeof alignmentClasses] || 'mx-auto')} style={{ maxWidth: '400px' }}>
                    <div
                        className={cn(
                            'group relative overflow-visible rounded-xl border border-border bg-[#282828]',
                            selected && 'ring-2 ring-primary ring-offset-2'
                        )}
                    >
                        {/* Toolbar - inside the group for proper layering */}
                        <VideoBlockToolbar
                            url={url}
                            alignment={alignment}
                            caption={caption}
                            onDelete={deleteNode}
                            onAlignmentChange={handleAlignmentChange}
                            onCaptionChange={handleCaptionChange}
                            onCaptionEdit={() => setIsEditingCaption(true)}
                            onComment={() => setShowCommentInput(true)}
                            isSelected={selected}
                        />

                        {/* Spotify Embed - compact player */}
                        <iframe
                            src={embedUrl}
                            className="w-full"
                            height="152"
                            frameBorder="0"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            style={{ borderRadius: '12px' }}
                        />
                    </div>

                    {/* Inline Editable Caption - like images */}
                    {selected && (
                        <div className="mt-2 flex justify-center">
                            {isEditingCaption ? (
                                <input
                                    type="text"
                                    value={captionText}
                                    onChange={(e) => setCaptionText(e.target.value)}
                                    onBlur={handleCaptionSave}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCaptionSave();
                                        if (e.key === 'Escape') {
                                            setCaptionText(caption || '');
                                            setIsEditingCaption(false);
                                        }
                                    }}
                                    placeholder="Adicionar legenda..."
                                    className="w-full text-sm text-center text-muted-foreground bg-transparent border-b border-primary focus:outline-none italic px-2 py-1"
                                    autoFocus
                                />
                            ) : (
                                <button
                                    onClick={() => setIsEditingCaption(true)}
                                    className="text-sm text-muted-foreground hover:text-foreground italic transition-colors px-2 py-1"
                                >
                                    {caption || 'Adicionar legenda...'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Show caption when not selected */}
                    {!selected && caption && (
                        <p className="text-sm text-muted-foreground text-center mt-2 italic">{caption}</p>
                    )}

                    {/* Comment Input */}
                    {showCommentInput && (
                        <div
                            className="mt-3 p-3 rounded-lg"
                            style={{ backgroundColor: '#1f1f23', border: '1px solid #3f3f46' }}
                        >
                            <textarea
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Adicionar comentário..."
                                className="w-full text-sm text-zinc-100 bg-transparent resize-none focus:outline-none"
                                rows={2}
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    onClick={() => setShowCommentInput(false)}
                                    className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAddComment}
                                    className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                                >
                                    Comentar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Display saved comments */}
                    {comments && comments.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {comments.map((comment: any) => (
                                <div
                                    key={comment.id}
                                    className="p-2 rounded-lg text-sm group/comment"
                                    style={{ backgroundColor: '#1f1f23', border: '1px solid #3f3f46' }}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <p className="text-zinc-200">{comment.text}</p>
                                        <button
                                            onClick={() => handleDeleteComment(comment.id)}
                                            className="opacity-0 group-hover/comment:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all"
                                            title="Remover comentário"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        {new Date(comment.createdAt).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </NodeViewWrapper>
        );
    }

    // Render YouTube/Vimeo with video player
    return (
        <NodeViewWrapper className="my-4">
            <div className={cn('relative', alignmentClasses[alignment as keyof typeof alignmentClasses] || 'mx-auto')}>
                <div
                    className={cn(
                        'group relative overflow-visible rounded-xl border border-border bg-black',
                        selected && 'ring-2 ring-primary ring-offset-2',
                        isFullscreen && 'fixed inset-4 z-50 rounded-2xl'
                    )}
                >
                    {/* Toolbar - inside the group for proper layering */}
                    <VideoBlockToolbar
                        url={url}
                        alignment={alignment}
                        caption={caption}
                        onDelete={deleteNode}
                        onAlignmentChange={handleAlignmentChange}
                        onCaptionChange={handleCaptionChange}
                        onCaptionEdit={() => setIsEditingCaption(true)}
                        onComment={() => setShowCommentInput(true)}
                        isSelected={selected}
                    />
                    {/* Video Player */}
                    <div className="relative w-full aspect-video">
                        {/* Show thumbnail with play button before playing */}
                        {!isPlaying && thumbnail ? (
                            <div
                                className="absolute inset-0 cursor-pointer"
                                onClick={() => setIsPlaying(true)}
                            >
                                <img
                                    src={thumbnail}
                                    alt={title || 'Video thumbnail'}
                                    className="w-full h-full object-cover"
                                />
                                {/* Play button overlay */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
                                    <div className="w-16 h-16 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 transition-colors">
                                        <Play className="w-8 h-8 text-white fill-white ml-1" />
                                    </div>
                                </div>
                                {/* Platform badge */}
                                <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2 py-1 rounded bg-black/60 text-white text-sm">
                                    <span>Assistir no</span>
                                    {platform === 'youtube' && (
                                        <svg viewBox="0 0 90 20" className="h-4 w-auto">
                                            <path fill="#fff" d="M27.9704 3.12324C27.6411 1.89323 26.6745 0.926623 25.4445 0.597366C23.2173 2.24288e-07 14.2827 0 14.2827 0C14.2827 0 5.34807 2.24288e-07 3.12088 0.597366C1.89323 0.926623 0.924271 1.89323 0.595014 3.12324C-2.8036e-07 5.35042 0 10 0 10C0 10 -1.87957e-07 14.6496 0.595014 16.8768C0.924271 18.1068 1.89323 19.0734 3.12088 19.4026C5.34807 20 14.2827 20 14.2827 20C14.2827 20 23.2173 20 25.4445 19.4026C26.6745 19.0734 27.6411 18.1068 27.9704 16.8768C28.5654 14.6496 28.5654 10 28.5654 10C28.5654 10 28.5654 5.35042 27.9704 3.12324Z" />
                                            <path fill="#ff0000" d="M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z" />
                                            <path fill="#fff" d="M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z" />
                                            <text x="34" y="14.5" fill="#fff" fontSize="13" fontWeight="500">YouTube</text>
                                        </svg>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <iframe
                                src={embedUrl + (platform === 'youtube' ? '?autoplay=1' : '')}
                                className="absolute inset-0 w-full h-full"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        )}
                    </div>

                    {/* Quick actions - shown on hover (external link, fullscreen) */}
                    <div className={cn(
                        'absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
                        selected && 'opacity-100'
                    )}>
                        <button
                            onClick={handleOpenExternal}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                            title="Abrir no site original"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-4 h-4" />
                            ) : (
                                <Maximize2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Inline Editable Caption - like images */}
                {selected && (
                    <div className="mt-2 flex justify-center">
                        {isEditingCaption ? (
                            <input
                                type="text"
                                value={captionText}
                                onChange={(e) => setCaptionText(e.target.value)}
                                onBlur={handleCaptionSave}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCaptionSave();
                                    if (e.key === 'Escape') {
                                        setCaptionText(caption || '');
                                        setIsEditingCaption(false);
                                    }
                                }}
                                placeholder="Adicionar legenda..."
                                className="w-full text-sm text-center text-muted-foreground bg-transparent border-b border-primary focus:outline-none italic px-2 py-1"
                                autoFocus
                            />
                        ) : (
                            <button
                                onClick={() => setIsEditingCaption(true)}
                                className="text-sm text-muted-foreground hover:text-foreground italic transition-colors px-2 py-1"
                            >
                                {caption || 'Adicionar legenda...'}
                            </button>
                        )}
                    </div>
                )}

                {/* Show caption when not selected */}
                {!selected && caption && (
                    <p className="text-sm text-muted-foreground text-center mt-2 italic">{caption}</p>
                )}

                {/* Comment Input */}
                {showCommentInput && (
                    <div
                        className="mt-3 p-3 rounded-lg"
                        style={{ backgroundColor: '#1f1f23', border: '1px solid #3f3f46' }}
                    >
                        <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Adicionar comentário..."
                            className="w-full text-sm text-zinc-100 bg-transparent resize-none focus:outline-none"
                            rows={2}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                onClick={() => setShowCommentInput(false)}
                                className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-100"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddComment}
                                className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                            >
                                Comentar
                            </button>
                        </div>
                    </div>
                )}

                {/* Display saved comments */}
                {comments && comments.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {comments.map((comment: any) => (
                            <div
                                key={comment.id}
                                className="p-2 rounded-lg text-sm group/comment"
                                style={{ backgroundColor: '#1f1f23', border: '1px solid #3f3f46' }}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <p className="text-zinc-200">{comment.text}</p>
                                    <button
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="opacity-0 group-hover/comment:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all"
                                        title="Remover comentário"
                                    >
                                        ×
                                    </button>
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">
                                    {new Date(comment.createdAt).toLocaleString('pt-BR')}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
}


// Helper to extract video ID
function extractVideoId(url: string, platform: string): string | null {
    try {
        const urlObj = new URL(url);

        if (platform === 'youtube') {
            if (urlObj.hostname.includes('youtu.be')) {
                return urlObj.pathname.slice(1);
            } else {
                return urlObj.searchParams.get('v');
            }
        } else if (platform === 'vimeo') {
            return urlObj.pathname.slice(1);
        }

        return null;
    } catch {
        return null;
    }
}

// Custom VideoEmbed Node
export const VideoEmbed = Node.create({
    name: 'videoEmbed',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            url: { default: '' },
            embedUrl: { default: '' },
            platform: { default: 'unknown' },
            title: { default: null },
            alignment: { default: 'center' },
            caption: { default: null },
            comments: { default: [] },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-video-embed]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-video-embed': '' }, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(VideoEmbedView, { flushSync: false } as any);
    },
});

// Helper to get embed info from URL
export function getVideoEmbedInfo(url: string): VideoEmbedData | null {
    try {
        const urlObj = new URL(url);

        // YouTube
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            let videoId = '';
            if (urlObj.hostname.includes('youtu.be')) {
                videoId = urlObj.pathname.slice(1);
            } else {
                videoId = urlObj.searchParams.get('v') || '';
            }
            if (videoId) {
                return {
                    url,
                    embedUrl: `https://www.youtube.com/embed/${videoId}`,
                    platform: 'youtube',
                };
            }
        }

        // Vimeo
        if (urlObj.hostname.includes('vimeo.com')) {
            const videoId = urlObj.pathname.slice(1);
            if (videoId) {
                return {
                    url,
                    embedUrl: `https://player.vimeo.com/video/${videoId}`,
                    platform: 'vimeo',
                };
            }
        }

        // Spotify - supports track, album, playlist, episode, show
        if (urlObj.hostname.includes('spotify.com')) {
            // Format: open.spotify.com/track/xxx -> open.spotify.com/embed/track/xxx
            // Also handles: open.spotify.com/intl-pt/track/xxx
            const pathParts = urlObj.pathname.split('/').filter(Boolean);

            // Find the content type index (skip locale parts like 'intl-pt')
            const contentTypes = ['track', 'album', 'playlist', 'episode', 'show', 'artist'];
            let contentTypeIndex = pathParts.findIndex(part => contentTypes.includes(part));

            if (contentTypeIndex !== -1 && pathParts.length > contentTypeIndex + 1) {
                const contentType = pathParts[contentTypeIndex]!;
                const contentId = pathParts[contentTypeIndex + 1]!.split('?')[0]; // Remove query params
                const embedUrl = `https://open.spotify.com/embed/${contentType}/${contentId}`;
                return {
                    url,
                    embedUrl,
                    platform: 'spotify',
                };
            }
        }

        return null;
    } catch {
        return null;
    }
}

export default VideoEmbed;
