'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { notesApi } from '@/lib/api';
import {
    Clock,
    History,
    Loader2,
    RotateCcw,
    X,
} from 'lucide-react';

interface VersionHistoryDialogProps {
    noteId: string;
    noteTitle?: string;
    onRestore?: () => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
}

interface Version {
    id: string;
    title: string;
    createdAt: string;
    content: any;
}

export function VersionHistoryDialog({
    noteId,
    noteTitle = '',
    onRestore,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    children
}: VersionHistoryDialogProps) {
    const { token } = useAuthStore();
    const [internalOpen, setInternalOpen] = useState(false);
    const [versions, setVersions] = useState<Version[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

    // Use controlled or internal state
    const open = controlledOpen ?? internalOpen;
    const setOpen = (value: boolean) => {
        setInternalOpen(value);
        controlledOnOpenChange?.(value);
    };

    // Load versions when dialog opens (handles controlled mode)
    useEffect(() => {
        if (open) {
            loadVersions();
        }
    }, [open]);

    const loadVersions = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const data = await notesApi.getVersions(token, noteId);
            setVersions(data);
        } catch (error) {
            console.error('Failed to load versions:', error);
            toast.error('Failed to load version history');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (versionId: string) => {
        if (!token) return;
        setIsRestoring(versionId);
        try {
            await notesApi.restoreVersion(token, noteId, versionId);
            toast.success('Restored to previous version');
            setOpen(false);
            onRestore?.();
        } catch (error) {
            toast.error('Failed to restore version');
        } finally {
            setIsRestoring(null);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) loadVersions(); }}>
            {children && (
                <Dialog.Trigger asChild>
                    {children}
                </Dialog.Trigger>
            )}
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-card border rounded-xl shadow-xl z-50 p-6 max-h-[80vh] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                            <History className="w-5 h-5" />
                            Version History
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <Dialog.Description className="text-sm text-muted-foreground mb-4">
                        View and restore previous versions of "{noteTitle}"
                    </Dialog.Description>

                    <div className="flex-1 overflow-y-auto space-y-2">
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                <p>No version history yet</p>
                                <p className="text-sm mt-1">Versions are created automatically when you save</p>
                            </div>
                        ) : (
                            versions.map((version, index) => (
                                <div
                                    key={version.id}
                                    className={cn(
                                        'p-4 rounded-lg border transition-colors cursor-pointer',
                                        selectedVersion?.id === version.id
                                            ? 'bg-primary/5 border-primary'
                                            : 'hover:bg-accent'
                                    )}
                                    onClick={() => setSelectedVersion(version)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                    {index === 0 ? 'Latest Version' : `Version ${versions.length - index}`}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(version.createdAt), 'MMM d, yyyy h:mm a')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1 truncate">
                                                {version.title}
                                            </p>
                                        </div>
                                        {index !== 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRestore(version.id);
                                                }}
                                                disabled={isRestoring === version.id}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
                                                    'bg-primary text-primary-foreground',
                                                    'hover:bg-primary/90 transition-colors',
                                                    'disabled:opacity-50'
                                                )}
                                            >
                                                {isRestoring === version.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-3 h-3" />
                                                )}
                                                Restore
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
