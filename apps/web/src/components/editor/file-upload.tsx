'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { storageApi, Attachment } from '@/lib/api';
import {
    Upload,
    X,
    Loader2,
    FileImage,
    FileText,
    File,
    CheckCircle,
} from 'lucide-react';

interface FileUploadProps {
    noteId: string;
    token: string;
    onUploadComplete?: (attachment: Attachment) => void;
    onImageInsert?: (url: string) => void;
    accept?: string;
    maxSize?: number; // in MB
    className?: string;
}

// File type icons
const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
        return <FileImage className="w-5 h-5 text-blue-500" />;
    }
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
        return <FileText className="w-5 h-5 text-red-500" />;
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

export function FileUpload({
    noteId,
    token,
    onUploadComplete,
    onImageInsert,
    accept = 'image/*,.pdf,.doc,.docx,.txt,.md',
    maxSize = 10,
    className,
}: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [currentFile, setCurrentFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = useCallback(async (file: File) => {
        // Validate file size
        if (file.size > maxSize * 1024 * 1024) {
            toast.error(`Arquivo muito grande. Máximo: ${maxSize}MB`);
            return;
        }

        setCurrentFile(file);
        setIsUploading(true);
        setUploadProgress(0);

        // Simulate progress (since fetch doesn't support progress)
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + 10, 90));
        }, 100);

        try {
            const attachment = await storageApi.uploadFile(token, noteId, file);

            clearInterval(progressInterval);
            setUploadProgress(100);

            toast.success('Arquivo enviado com sucesso!');

            // If it's an image and we have an insert callback, use it
            if (file.type.startsWith('image/') && onImageInsert) {
                onImageInsert(attachment.url);
            }

            if (onUploadComplete) {
                onUploadComplete(attachment);
            }

            // Reset after success animation
            setTimeout(() => {
                setCurrentFile(null);
                setUploadProgress(0);
                setIsUploading(false);
            }, 1000);
        } catch (error) {
            clearInterval(progressInterval);
            console.error('Upload error:', error);
            toast.error(error instanceof Error ? error.message : 'Falha ao enviar arquivo');
            setCurrentFile(null);
            setUploadProgress(0);
            setIsUploading(false);
        }
    }, [token, noteId, maxSize, onUploadComplete, onImageInsert]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        const firstFile = files?.[0];
        if (firstFile) {
            handleUpload(firstFile);
        }
    }, [handleUpload]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        const firstFile = files?.[0];
        if (firstFile) {
            handleUpload(firstFile);
        }
        // Reset input
        e.target.value = '';
    }, [handleUpload]);

    const openFilePicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    return (
        <div className={cn('relative', className)}>
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Drop Zone */}
            <div
                onClick={openFilePicker}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    'relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200',
                    isDragging
                        ? 'border-primary bg-primary/10 scale-[1.02]'
                        : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50',
                    isUploading && 'pointer-events-none'
                )}
            >
                {isUploading ? (
                    // Upload Progress
                    <div className="flex flex-col items-center gap-3 w-full">
                        <div className="flex items-center gap-3">
                            {currentFile && getFileIcon(currentFile.type)}
                            <span className="text-sm font-medium truncate max-w-[200px]">
                                {currentFile?.name}
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    'h-full transition-all duration-300 rounded-full',
                                    uploadProgress === 100 ? 'bg-green-500' : 'bg-primary'
                                )}
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {uploadProgress === 100 ? (
                                <>
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    <span>Concluído!</span>
                                </>
                            ) : (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Enviando... {uploadProgress}%</span>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    // Default State
                    <>
                        <div className={cn(
                            'p-3 rounded-full transition-colors',
                            isDragging ? 'bg-primary/20' : 'bg-muted'
                        )}>
                            <Upload className={cn(
                                'w-6 h-6 transition-colors',
                                isDragging ? 'text-primary' : 'text-muted-foreground'
                            )} />
                        </div>

                        <div className="mt-3 text-center">
                            <p className="text-sm font-medium">
                                {isDragging ? 'Solte o arquivo aqui' : 'Arraste um arquivo ou clique para selecionar'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Imagens, PDFs, documentos (max. {maxSize}MB)
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Compact upload button for toolbar
interface UploadButtonProps {
    noteId: string;
    token: string;
    onUploadComplete?: (attachment: Attachment) => void;
    onImageInsert?: (url: string) => void;
    accept?: string;
    icon?: React.ReactNode;
    title?: string;
}

export function UploadButton({
    noteId,
    token,
    onUploadComplete,
    onImageInsert,
    accept = 'image/*',
    icon,
    title = 'Upload',
}: UploadButtonProps) {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (file: File) => {
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Arquivo muito grande. Máximo: 10MB');
            return;
        }

        setIsUploading(true);

        try {
            const attachment = await storageApi.uploadFile(token, noteId, file);
            toast.success('Arquivo enviado!');

            if (file.type.startsWith('image/') && onImageInsert) {
                onImageInsert(attachment.url);
            }

            if (onUploadComplete) {
                onUploadComplete(attachment);
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error instanceof Error ? error.message : 'Falha ao enviar');
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        const firstFile = files?.[0];
        if (firstFile) {
            handleUpload(firstFile);
        }
        e.target.value = '';
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                className="hidden"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                    'p-2 rounded-lg transition-colors',
                    'hover:bg-accent text-muted-foreground hover:text-foreground',
                    isUploading && 'opacity-50 cursor-not-allowed'
                )}
                title={title}
            >
                {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    icon || <Upload className="w-4 h-4" />
                )}
            </button>
        </>
    );
}
