'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Loader2, NotebookPen } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await authApi.login(formData.email, formData.password);
            login(result.user, result.accessToken);
            toast.success('Welcome back!');
            router.push('/');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Illustration */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-purple-600 to-indigo-700 p-12 flex-col justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                        <NotebookPen className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-white">Evernote Clone</span>
                </div>

                <div className="space-y-6">
                    <h1 className="text-5xl font-bold text-white leading-tight">
                        Your ideas,<br />organized.
                    </h1>
                    <p className="text-xl text-white/80 max-w-md">
                        Capture thoughts, collaborate in real-time, and access your notes from anywhere.
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="px-4 py-2 bg-white/10 backdrop-blur rounded-full text-white text-sm">
                        ✨ Real-time collaboration
                    </div>
                    <div className="px-4 py-2 bg-white/10 backdrop-blur rounded-full text-white text-sm">
                        📱 Offline support
                    </div>
                    <div className="px-4 py-2 bg-white/10 backdrop-blur rounded-full text-white text-sm">
                        🔒 Secure
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-md space-y-8">
                    <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <NotebookPen className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-2xl font-bold">Evernote Clone</span>
                    </div>

                    <div className="text-center">
                        <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
                        <p className="text-muted-foreground mt-2">
                            Sign in to your account to continue
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium">
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className={cn(
                                    'w-full px-4 py-3 rounded-lg border bg-background',
                                    'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                                    'transition-all duration-200'
                                )}
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={cn(
                                        'w-full px-4 py-3 pr-12 rounded-lg border bg-background',
                                        'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                                        'transition-all duration-200'
                                    )}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={cn(
                                'w-full py-3 px-4 rounded-lg font-medium',
                                'bg-primary text-primary-foreground',
                                'hover:bg-primary/90 transition-colors',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                'flex items-center justify-center gap-2'
                            )}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-primary hover:underline font-medium">
                            Sign up
                        </Link>
                    </p>

                    <div className="text-center text-xs text-muted-foreground">
                        Demo credentials: <code className="bg-muted px-1 py-0.5 rounded">demo@example.com</code> / <code className="bg-muted px-1 py-0.5 rounded">demo123</code>
                    </div>
                </div>
            </div>
        </div>
    );
}
