'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore } from '@/store/notes-store';
import { notebooksApi, tagsApi } from '@/lib/api';
import { AccountSettingsDialog } from '@/components/dialogs/account-settings-dialog';
import { DeleteNotebookDialog } from '@/components/dialogs/delete-notebook-dialog';
import {
    BookOpen,
    ChevronDown,
    ChevronRight,
    Hash,
    LogOut,
    Moon,
    NotebookPen,
    Plus,
    Settings,
    Sun,
    Trash2,
    User,
} from 'lucide-react';

export function Sidebar() {
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const { user, logout, token } = useAuthStore();
    const {
        notebooks,
        tags,
        selectedNotebookId,
        selectedTagId,
        showTrash,
        selectNotebook,
        selectTag,
        setShowTrash,
        addNotebook,
        addTag,
    } = useNotesStore();

    const [notebooksOpen, setNotebooksOpen] = useState(true);
    const [tagsOpen, setTagsOpen] = useState(true);
    const [isCreating, setIsCreating] = useState<'notebook' | 'tag' | null>(null);
    const [newName, setNewName] = useState('');

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const handleCreateNotebook = async () => {
        if (!newName.trim() || !token) return;

        try {
            const notebook = await notebooksApi.create(token, { name: newName.trim() });
            addNotebook(notebook);
            setNewName('');
            setIsCreating(null);
            toast.success('Notebook created');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create notebook');
        }
    };

    const handleCreateTag = async () => {
        if (!newName.trim() || !token) return;

        try {
            const tag = await tagsApi.create(token, { name: newName.trim() });
            addTag(tag);
            setNewName('');
            setIsCreating(null);
            toast.success('Tag created');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create tag');
        }
    };

    return (
        <aside className="w-64 h-screen flex flex-col bg-card border-r shrink-0">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                        <NotebookPen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{user?.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* All Notes */}
                <button
                    onClick={() => {
                        selectNotebook(null);
                        selectTag(null);
                        setShowTrash(false);
                    }}
                    className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        !selectedNotebookId && !selectedTagId && !showTrash
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-accent'
                    )}
                >
                    <BookOpen className="w-4 h-4" />
                    <span>All Notes</span>
                </button>

                {/* Notebooks */}
                <div className="pt-4 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    <button
                        onClick={() => setNotebooksOpen(!notebooksOpen)}
                        className="flex items-center gap-2 hover:text-foreground flex-1 text-left transition-colors"
                    >
                        {notebooksOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <span>NOTEBOOKS</span>
                    </button>
                    <button
                        onClick={() => setIsCreating('notebook')}
                        className="p-0.5 hover:bg-accent rounded hover:text-foreground transition-colors"
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                </div>

                {notebooksOpen && (
                    <div className="mt-1 space-y-0.5">
                        {isCreating === 'notebook' && (
                            <div className="px-3 py-1">
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateNotebook();
                                        if (e.key === 'Escape') setIsCreating(null);
                                    }}
                                    onBlur={() => {
                                        if (newName.trim()) handleCreateNotebook();
                                        else setIsCreating(null);
                                    }}
                                    placeholder="Notebook name..."
                                    className="w-full px-2 py-1 text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                />
                            </div>
                        )}
                        {notebooks.map((notebook) => (
                            <div
                                key={notebook.id}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group',
                                    selectedNotebookId === notebook.id
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-accent'
                                )}
                            >
                                <button
                                    onClick={() => selectNotebook(notebook.id)}
                                    className="flex items-center gap-3 flex-1 min-w-0"
                                >
                                    <div
                                        className="w-3 h-3 rounded shrink-0"
                                        style={{ backgroundColor: notebook.color }}
                                    />
                                    <span className="flex-1 text-left truncate">{notebook.name}</span>
                                    <span className="text-xs text-muted-foreground">{notebook._count?.notes || 0}</span>
                                </button>
                                <DeleteNotebookDialog notebook={notebook}>
                                    <button
                                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                                        title="Deletar notebook"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </DeleteNotebookDialog>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tags */}
                <div className="pt-4 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    <button
                        onClick={() => setTagsOpen(!tagsOpen)}
                        className="flex items-center gap-2 hover:text-foreground flex-1 text-left transition-colors"
                    >
                        {tagsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <span>TAGS</span>
                    </button>
                    <button
                        onClick={() => setIsCreating('tag')}
                        className="p-0.5 hover:bg-accent rounded hover:text-foreground transition-colors"
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                </div>

                {tagsOpen && (
                    <div className="mt-1 space-y-0.5">
                        {isCreating === 'tag' && (
                            <div className="px-3 py-1">
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateTag();
                                        if (e.key === 'Escape') setIsCreating(null);
                                    }}
                                    onBlur={() => {
                                        if (newName.trim()) handleCreateTag();
                                        else setIsCreating(null);
                                    }}
                                    placeholder="Tag name..."
                                    className="w-full px-2 py-1 text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                />
                            </div>
                        )}
                        {tags.map((tag) => (
                            <button
                                key={tag.id}
                                onClick={() => selectTag(tag.id)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                                    selectedTagId === tag.id
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-accent'
                                )}
                            >
                                <Hash className="w-4 h-4" style={{ color: tag.color }} />
                                <span className="flex-1 text-left truncate">{tag.name}</span>
                                <span className="text-xs text-muted-foreground">{tag._count?.notes || 0}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Trash */}
                <div className="pt-4">
                    <button
                        onClick={() => setShowTrash(true)}
                        className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                            showTrash ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                        )}
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>Trash</span>
                    </button>
                </div>
            </nav >

            {/* Footer */}
            < div className="p-2 border-t space-y-1" >
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
                >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span>{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>
                </button>
                <AccountSettingsDialog>
                    <button
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        <span>Configurações</span>
                    </button>
                </AccountSettingsDialog>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors text-destructive"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sair</span>
                </button>
            </div >
        </aside >
    );
}
