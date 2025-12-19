'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { storageApi, Attachment } from '@/lib/api';
import {
    Download,
    Trash2,
    FileImage,
    FileText,
    File,
    Loader2,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Paperclip,
    X,
} from 'lucide-react';

interface AttachmentListProps {
    attachments: Attachment[];
    token: string;
    onDelete?: (attachmentId: string) => void;
    className?: string;
}

// Get icon based on mime type
const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
        return <FileImage className="w-5 h-5 text-blue-500" />;
    }
    if (mimeType.includes('pdf')) {
        return <FileText className="w-5 h-5 text-red-500" />;
    }
    if (mimeType.includes('document') || mimeType.includes('word')) {
        return <FileText className="w-5 h-5 text-blue-600" />;
    }
    if (mimeType.includes('text') || mimeType.includes('markdown')) {
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
};

// Format file size
const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Format date
const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export function AttachmentList({
    attachments,
    token,
    onDelete,
    className,
}: AttachmentListProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const handleDelete = useCallback(async (attachment: Attachment) => {
        if (!confirm(`Deseja excluir "${attachment.filename}"?`)) {
            return;
        }

        setDeletingId(attachment.id);

        try {
            await storageApi.deleteAttachment(token, attachment.id);
            toast.success('Arquivo excluído!');
            if (onDelete) {
                onDelete(attachment.id);
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast.error(error instanceof Error ? error.message : 'Erro ao excluir');
        } finally {
            setDeletingId(null);
        }
    }, [token, onDelete]);

    const handleDownload = useCallback((attachment: Attachment) => {
        window.open(attachment.url, '_blank');
    }, []);

    if (attachments.length === 0) {
        return null;
    }

    return (
        <>
            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        onClick={() => setPreviewImage(null)}
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-full max-h-full rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Attachment List */}
            <div className={cn('mt-6 border rounded-xl overflow-hidden', className)}>
                {/* Header */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted/80 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                            Anexos ({attachments.length})
                        </span>
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                </button>

                {/* Content */}
                {isExpanded && (
                    <div className="divide-y">
                        {attachments.map((attachment) => {
                            const isImage = attachment.mimeType.startsWith('image/');
                            const isDeleting = deletingId === attachment.id;

                            return (
                                <div
                                    key={attachment.id}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors',
                                        isDeleting && 'opacity-50'
                                    )}
                                >
                                    {/* Icon or Thumbnail */}
                                    {isImage ? (
                                        <button
                                            onClick={() => setPreviewImage(attachment.url)}
                                            className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 hover:ring-2 ring-primary transition-all"
                                        >
                                            <img
                                                src={attachment.url}
                                                alt={attachment.filename}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                            {getFileIcon(attachment.mimeType)}
                                        </div>
                                    )}

                                    {/* File Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {attachment.filename}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatFileSize(attachment.size)} • {formatDate(attachment.createdAt)}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleDownload(attachment)}
                                            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => window.open(attachment.url, '_blank')}
                                            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                            title="Abrir em nova aba"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => handleDelete(attachment)}
                                            disabled={isDeleting}
                                            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:cursor-not-allowed"
                                            title="Excluir"
                                        >
                                            {isDeleting ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
