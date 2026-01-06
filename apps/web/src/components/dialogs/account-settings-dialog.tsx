'use client';

import { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useNotesStore } from '@/store/notes-store';
import { notesApi } from '@/lib/api';
import {
    Camera,
    Database,
    Download,
    Eye,
    EyeOff,
    FileUp,
    Key,
    Loader2,
    Settings,
    Upload,
    User,
    X,
} from 'lucide-react';
import { ImportNotesDialog } from './import-notes-dialog';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface AccountSettingsDialogProps {
    children: React.ReactNode;
}

export function AccountSettingsDialog({ children }: AccountSettingsDialogProps) {
    const { token, user, updateUser } = useAuthStore();
    const { notes, notebooks, tags, setNotes, setNotebooks, setTags } = useNotesStore();
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'data'>('profile');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Profile state
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    // Backup state
    const [isCreatingBackup, setIsCreatingBackup] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen && user) {
            setName(user.name || '');
            setEmail(user.email || '');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        setIsUpdatingProfile(true);
        try {
            const response = await fetch(`${API_URL}/users/me`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ name, email }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update profile');
            }

            const updatedUser = await response.json();
            updateUser(updatedUser);
            toast.success('Perfil atualizado!');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Falha ao atualizar perfil');
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        if (newPassword !== confirmPassword) {
            toast.error('As senhas não coincidem');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('A nova senha deve ter pelo menos 6 caracteres');
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const response = await fetch(`${API_URL}/users/me/password`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update password');
            }

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            toast.success('Senha alterada com sucesso!');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Falha ao alterar senha');
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    // Backup - Export all data
    const handleCreateBackup = async () => {
        setIsCreatingBackup(true);
        try {
            const backup = {
                version: '1.0',
                createdAt: new Date().toISOString(),
                user: { name: user?.name, email: user?.email },
                data: {
                    notes: notes.map(n => ({
                        id: n.id,
                        title: n.title,
                        content: n.content,
                        plainText: n.plainText,
                        createdAt: n.createdAt,
                        updatedAt: n.updatedAt,
                        notebookId: n.notebookId,
                        tags: n.tags?.map((t: any) => t.id),
                    })),
                    notebooks: notebooks.map(nb => ({
                        id: nb.id,
                        name: nb.name,
                        color: nb.color,
                        isDefault: nb.isDefault,
                    })),
                    tags: tags.map(t => ({
                        id: t.id,
                        name: t.name,
                        color: t.color,
                    })),
                },
            };

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `evernote-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Backup criado com sucesso!');
        } catch (error) {
            toast.error('Falha ao criar backup');
        } finally {
            setIsCreatingBackup(false);
        }
    };

    // Restore from backup file
    const handleRestore = async (file: File) => {
        if (!token) return;

        setIsRestoring(true);
        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            if (!backup.version || !backup.data) {
                throw new Error('Arquivo de backup inválido');
            }

            // Restore notebooks first
            for (const nb of backup.data.notebooks || []) {
                try {
                    await notesApi.create(token, { title: '', notebookId: nb.id });
                } catch { /* Notebook may already exist */ }
            }

            // Restore notes
            let restoredCount = 0;
            for (const note of backup.data.notes || []) {
                try {
                    await notesApi.create(token, {
                        title: note.title,
                        content: note.content,
                        notebookId: note.notebookId,
                    });
                    restoredCount++;
                } catch (e) {
                    console.error('Failed to restore note:', note.title, e);
                }
            }

            toast.success(`Restaurado ${restoredCount} notas!`);

            // Reload page to refresh data
            window.location.reload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Falha ao restaurar backup');
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={handleOpenChange}>
            <Dialog.Trigger asChild>
                {children}
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b">
                        <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Configurações da Conta
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                                activeTab === 'profile'
                                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <User className="w-4 h-4" />
                            Perfil
                        </button>
                        <button
                            onClick={() => setActiveTab('password')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                                activeTab === 'password'
                                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Key className="w-4 h-4" />
                            Senha
                        </button>
                        <button
                            onClick={() => setActiveTab('data')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                                activeTab === 'data'
                                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Database className="w-4 h-4" />
                            Dados
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                        {activeTab === 'profile' && (
                            <form onSubmit={handleUpdateProfile} className="space-y-4">
                                <div className="flex justify-center">
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary">
                                            {name?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || 'U'}
                                        </div>
                                        <button
                                            type="button"
                                            className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                        >
                                            <Camera className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Nome</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Seu nome"
                                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="seu@email.com"
                                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isUpdatingProfile}
                                    className={cn(
                                        'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
                                        'bg-primary text-primary-foreground font-medium',
                                        'hover:bg-primary/90 transition-colors',
                                        'disabled:opacity-50 disabled:cursor-not-allowed'
                                    )}
                                >
                                    {isUpdatingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Salvar alterações
                                </button>
                            </form>
                        )}

                        {activeTab === 'password' && (
                            <form onSubmit={handleUpdatePassword} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Senha atual</label>
                                    <div className="relative">
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={e => setCurrentPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full px-3 py-2 pr-10 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Nova senha</label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full px-3 py-2 pr-10 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Confirmar nova senha</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className={cn(
                                            'w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary',
                                            confirmPassword && newPassword !== confirmPassword && 'border-destructive focus:ring-destructive'
                                        )}
                                        required
                                    />
                                    {confirmPassword && newPassword !== confirmPassword && (
                                        <p className="text-xs text-destructive">As senhas não coincidem</p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isUpdatingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                                    className={cn(
                                        'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
                                        'bg-primary text-primary-foreground font-medium',
                                        'hover:bg-primary/90 transition-colors',
                                        'disabled:opacity-50 disabled:cursor-not-allowed'
                                    )}
                                >
                                    {isUpdatingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Alterar senha
                                </button>
                            </form>
                        )}

                        {activeTab === 'data' && (
                            <div className="space-y-6">
                                {/* Import Notes */}
                                <div className="p-4 rounded-lg border bg-muted/30">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                                            <FileUp className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium">Importar Notas</h4>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Importe notas do Evernote (.enex), HTML ou Markdown.
                                            </p>
                                            <button
                                                onClick={() => setShowImportDialog(true)}
                                                className={cn(
                                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                                                    'bg-purple-600 text-white hover:bg-purple-700 transition-colors'
                                                )}
                                            >
                                                <Upload className="w-4 h-4" />
                                                Importar Arquivos
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Backup */}
                                <div className="p-4 rounded-lg border bg-muted/30">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                                            <Download className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium">Criar Backup</h4>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Exporta todas as suas notas, cadernos e tags para um arquivo JSON.
                                            </p>
                                            <button
                                                onClick={handleCreateBackup}
                                                disabled={isCreatingBackup}
                                                className={cn(
                                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                                                    'bg-green-600 text-white hover:bg-green-700 transition-colors',
                                                    'disabled:opacity-50 disabled:cursor-not-allowed'
                                                )}
                                            >
                                                {isCreatingBackup ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Download className="w-4 h-4" />
                                                )}
                                                Baixar Backup
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Restore */}
                                <div className="p-4 rounded-lg border bg-muted/30">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                            <Upload className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium">Restaurar Backup</h4>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Importa um arquivo de backup JSON criado anteriormente.
                                            </p>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".json"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleRestore(file);
                                                }}
                                                className="hidden"
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isRestoring}
                                                className={cn(
                                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                                                    'bg-blue-600 text-white hover:bg-blue-700 transition-colors',
                                                    'disabled:opacity-50 disabled:cursor-not-allowed'
                                                )}
                                            >
                                                {isRestoring ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <FileUp className="w-4 h-4" />
                                                )}
                                                Selecionar Arquivo
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="pt-4 border-t">
                                    <p className="text-xs text-muted-foreground mb-2">Estatísticas</p>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="px-3 py-2 rounded-lg bg-muted">
                                            <p className="text-lg font-semibold">{notes.length}</p>
                                            <p className="text-xs text-muted-foreground">Notas</p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg bg-muted">
                                            <p className="text-lg font-semibold">{notebooks.length}</p>
                                            <p className="text-xs text-muted-foreground">Cadernos</p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg bg-muted">
                                            <p className="text-lg font-semibold">{tags.length}</p>
                                            <p className="text-xs text-muted-foreground">Tags</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>

            {/* Import Notes Dialog */}
            <ImportNotesDialog
                open={showImportDialog}
                onOpenChange={setShowImportDialog}
            />
        </Dialog.Root>
    );
}
