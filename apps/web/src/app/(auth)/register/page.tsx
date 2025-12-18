'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Loader2, NotebookPen } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const { login } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await authApi.register(formData.email, formData.name, formData.password);
            login(result.user, result.accessToken);
            toast.success('Account created successfully!');
            router.push('/');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Illustration */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-12 flex-col justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                        <NotebookPen className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-white">Evernote Clone</span>
                </div>

                <div className="space-y-6">
                    <h1 className="text-5xl font-bold text-white leading-tight">
                        Start your<br />journey today.
                    </h1>
                    <p className="text-xl text-white/80 max-w-md">
                        Join thousands of users who organize their life with our powerful note-taking app.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-white/90">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                            ✓
                        </div>
                        <span>Unlimited notes and notebooks</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/90">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                            ✓
                        </div>
                        <span>Collaborate with your team</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/90">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                            ✓
                        </div>
                        <span>Access from any device</span>
                    </div>
                </div>
            </div>

            {/* Right Panel - Register Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-md space-y-8">
                    <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <NotebookPen className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-2xl font-bold">Evernote Clone</span>
                    </div>

                    <div className="text-center">
                        <h2 className="text-3xl font-bold tracking-tight">Create an account</h2>
                        <p className="text-muted-foreground mt-2">
                            Get started with your free account
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">
                                Full name
                            </label>
                            <input
                                id="name"
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={cn(
                                    'w-full px-4 py-3 rounded-lg border bg-background',
                                    'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                                    'transition-all duration-200'
                                )}
                                placeholder="John Doe"
                            />
                        </div>

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
                                    minLength={6}
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
                            <p className="text-xs text-muted-foreground">
                                Must be at least 6 characters
                            </p>
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
                                    Creating account...
                                </>
                            ) : (
                                'Create account'
                            )}
                        </button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <Link href="/login" className="text-primary hover:underline font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
