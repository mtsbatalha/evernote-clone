'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { sharesApi } from '@/lib/api';
import {
    Check,
    Copy,
    Globe,
    Link2,
    Loader2,
    Mail,
    Share2,
    Trash2,
    UserPlus,
    Users,
    X,
} from 'lucide-react';

interface ShareDialogProps {
    noteId: string;
    noteTitle: string;
    children: React.ReactNode;
}

interface Share {
    id: string;
    permission: 'READ' | 'WRITE' | 'ADMIN';
    user: {
        id: string;
        name: string | null;
        email: string;
        avatar: string | null;
    };
}

export function ShareDialog({ noteId, noteTitle, children }: ShareDialogProps) {
    const { token } = useAuthStore();
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [permission, setPermission] = useState<'READ' | 'WRITE' | 'ADMIN'>('READ');
    const [shares, setShares] = useState<Share[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [isPublic, setIsPublic] = useState(false);

    // Generate shareable link
    const shareLink = typeof window !== 'undefined'
        ? `${window.location.origin}/shared/${noteId}`
        : '';

    const loadShares = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const data = await sharesApi.getSharesForNote(token, noteId);
            setShares(data);
        } catch (error) {
            console.error('Failed to load shares:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareLink);
            setLinkCopied(true);
            toast.success('Link copiado!');
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (error) {
            toast.error('Falha ao copiar link');
        }
    };

    const handleShare = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !email.trim()) return;

        setIsSharing(true);
        try {
            await sharesApi.shareNote(token, noteId, email.trim(), permission);
            toast.success(`Compartilhado com ${email}`);
            setEmail('');
            loadShares();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Falha ao compartilhar');
        } finally {
            setIsSharing(false);
        }
    };

    const handleRemoveShare = async (shareId: string) => {
        if (!token) return;

        try {
            await sharesApi.removeShare(token, shareId);
            setShares(shares.filter((s) => s.id !== shareId));
            toast.success('Acesso removido');
        } catch (error) {
            toast.error('Falha ao remover acesso');
        }
    };

    const permissionLabels = {
        READ: 'Ver',
        WRITE: 'Editar',
        ADMIN: 'Acesso total',
    };

    return (
        <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) loadShares(); }}>
            <Dialog.Trigger asChild>
                {children}
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border rounded-xl shadow-xl z-50 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                            <Share2 className="w-5 h-5" />
                            Compartilhar "{noteTitle}"
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Share via Link Section */}
                    <div className="mb-6 p-4 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-2 mb-3">
                            <Link2 className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">Compartilhar via link</span>
                        </div>

                        <div className="flex gap-2">
                            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-background border text-sm">
                                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="truncate text-muted-foreground">
                                    {shareLink}
                                </span>
                            </div>
                            <button
                                onClick={handleCopyLink}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                    linkCopied
                                        ? 'bg-green-500/10 text-green-600 border border-green-500/30'
                                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                )}
                            >
                                {linkCopied ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Copiado!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        Copiar
                                    </>
                                )}
                            </button>
                        </div>

                        <p className="text-xs text-muted-foreground mt-2">
                            Qualquer pessoa com este link pode ver a nota
                        </p>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground uppercase">ou convide por email</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Share form */}
                    <form onSubmit={handleShare} className="space-y-4 mb-6">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Digite o email"
                                    className={cn(
                                        'w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-sm',
                                        'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
                                    )}
                                    required
                                />
                            </div>
                            <select
                                value={permission}
                                onChange={(e) => setPermission(e.target.value as 'READ' | 'WRITE' | 'ADMIN')}
                                className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="READ">Ver</option>
                                <option value="WRITE">Editar</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={isSharing || !email.trim()}
                            className={cn(
                                'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
                                'bg-primary text-primary-foreground font-medium',
                                'hover:bg-primary/90 transition-colors',
                                'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                        >
                            {isSharing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <UserPlus className="w-4 h-4" />
                            )}
                            <span>Convidar</span>
                        </button>
                    </form>

                    {/* Current shares */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                            <Users className="w-4 h-4" />
                            Pessoas com acesso
                        </h4>

                        {isLoading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : shares.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                Apenas você tem acesso a esta nota
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {shares.map((share) => (
                                    <div
                                        key={share.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                                                {share.user.name?.[0]?.toUpperCase() || share.user.email[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{share.user.name || share.user.email}</p>
                                                <p className="text-xs text-muted-foreground">{permissionLabels[share.permission]}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveShare(share.id)}
                                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            title="Remover acesso"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
