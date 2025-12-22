'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore } from '@/store/notes-store';
import { notesApi, tagsApi } from '@/lib/api';
import {
    Check,
    Hash,
    Loader2,
    Plus,
    Tag,
    X,
} from 'lucide-react';

interface TagsDialogProps {
    noteId: string;
    noteTags: { id: string; name: string; color?: string }[];
    onTagsUpdate?: (tags: any[]) => void;
    children: React.ReactNode;
}

const TAG_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

export function TagsDialog({ noteId, noteTags, onTagsUpdate, children }: TagsDialogProps) {
    const { token } = useAuthStore();
    const { tags, addTag } = useNotesStore();
    const [open, setOpen] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Initialize selected tags when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedTags(noteTags.map(t => t.id));
        }
    }, [open, noteTags]);

    const handleToggleTag = async (tagId: string) => {
        if (!token) return;

        const isSelected = selectedTags.includes(tagId);
        const newSelection = isSelected
            ? selectedTags.filter(id => id !== tagId)
            : [...selectedTags, tagId];

        setSelectedTags(newSelection);

        try {
            await notesApi.updateTags(token, noteId, newSelection);
            const updatedTags = tags.filter(t => newSelection.includes(t.id));
            onTagsUpdate?.(updatedTags);
        } catch (error) {
            // Revert on error
            setSelectedTags(selectedTags);
            toast.error('Falha ao atualizar tags');
        }
    };

    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !newTagName.trim()) return;

        setIsLoading(true);
        try {
            const tag = await tagsApi.create(token, {
                name: newTagName.trim(),
                color: newTagColor
            });
            addTag(tag);
            setNewTagName('');
            setShowCreateForm(false);
            toast.success('Tag criada!');

            // Auto-select the new tag
            handleToggleTag(tag.id);
        } catch (error) {
            toast.error('Falha ao criar tag');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                {children}
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card border rounded-xl shadow-xl z-50 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                            <Tag className="w-5 h-5" />
                            Tags
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Tags List */}
                    <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
                        {tags.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Nenhuma tag criada ainda
                            </p>
                        ) : (
                            tags.map(tag => {
                                const isSelected = selectedTags.includes(tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        onClick={() => handleToggleTag(tag.id)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                                            isSelected ? 'bg-primary/10' : 'hover:bg-accent'
                                        )}
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full shrink-0"
                                            style={{ backgroundColor: tag.color || '#6366f1' }}
                                        />
                                        <span className="flex-1 text-left truncate">{tag.name}</span>
                                        {isSelected && (
                                            <Check className="w-4 h-4 text-primary shrink-0" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Create New Tag */}
                    {showCreateForm ? (
                        <form onSubmit={handleCreateTag} className="space-y-3 border-t pt-4">
                            <input
                                type="text"
                                value={newTagName}
                                onChange={e => setNewTagName(e.target.value)}
                                placeholder="Nome da tag"
                                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                autoFocus
                            />
                            <div className="flex flex-wrap gap-2">
                                {TAG_COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setNewTagColor(color)}
                                        className={cn(
                                            'w-6 h-6 rounded-full transition-transform',
                                            newTagColor === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateForm(false)}
                                    className="flex-1 px-3 py-2 rounded-lg border text-sm hover:bg-accent transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading || !newTagName.trim()}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
                                        'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                                        'disabled:opacity-50 disabled:cursor-not-allowed'
                                    )}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Criar nova tag
                        </button>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
