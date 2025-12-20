'use client';

import { NodeViewWrapper, NodeViewContent, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Copy, Check } from 'lucide-react';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

// Language options with display names and theme colors
const LANGUAGES = [
    { value: '', label: 'Texto plano', color: 'bg-zinc-900' },
    { value: 'javascript', label: 'JavaScript', color: 'bg-yellow-950' },
    { value: 'typescript', label: 'TypeScript', color: 'bg-blue-950' },
    { value: 'python', label: 'Python', color: 'bg-green-950' },
    { value: 'java', label: 'Java', color: 'bg-orange-950' },
    { value: 'c', label: 'C', color: 'bg-slate-900' },
    { value: 'cpp', label: 'C++', color: 'bg-indigo-950' },
    { value: 'csharp', label: 'C#', color: 'bg-purple-950' },
    { value: 'go', label: 'Go', color: 'bg-cyan-950' },
    { value: 'rust', label: 'Rust', color: 'bg-amber-950' },
    { value: 'php', label: 'PHP', color: 'bg-violet-950' },
    { value: 'ruby', label: 'Ruby', color: 'bg-red-950' },
    { value: 'swift', label: 'Swift', color: 'bg-orange-950' },
    { value: 'kotlin', label: 'Kotlin', color: 'bg-fuchsia-950' },
    { value: 'sql', label: 'SQL', color: 'bg-sky-950' },
    { value: 'html', label: 'HTML', color: 'bg-rose-950' },
    { value: 'css', label: 'CSS', color: 'bg-blue-950' },
    { value: 'json', label: 'JSON', color: 'bg-emerald-950' },
    { value: 'xml', label: 'XML', color: 'bg-teal-950' },
    { value: 'yaml', label: 'YAML', color: 'bg-lime-950' },
    { value: 'markdown', label: 'Markdown', color: 'bg-stone-900' },
    { value: 'bash', label: 'Bash/Shell', color: 'bg-neutral-900' },
    { value: 'powershell', label: 'PowerShell', color: 'bg-blue-950' },
];

interface CodeBlockViewProps extends NodeViewProps { }

function CodeBlockView({ node, updateAttributes, extension }: CodeBlockViewProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const language = node.attrs.language || '';

    const defaultLang = LANGUAGES[0];
    const currentLang = LANGUAGES.find(l => l.value === language) ?? defaultLang;

    const handleLanguageChange = useCallback((lang: string) => {
        updateAttributes({ language: lang });
        setIsOpen(false);
    }, [updateAttributes]);

    const handleCopy = useCallback(async () => {
        const text = node.textContent;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [node.textContent]);

    return (
        <NodeViewWrapper className="relative my-4">
            <div className={cn(
                'rounded-xl border border-border/50',
                currentLang.color
            )}>
                {/* Header with language selector */}
                <div className="flex items-center justify-between px-4 py-2 bg-black/30 border-b border-white/10">
                    {/* Language Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-white/80 transition-colors"
                        >
                            <span>{currentLang.label}</span>
                            <ChevronDown className={cn(
                                'w-4 h-4 transition-transform',
                                isOpen && 'rotate-180'
                            )} />
                        </button>

                        {/* Dropdown */}
                        {isOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 max-h-80 overflow-y-auto rounded-xl bg-zinc-900 border border-white/20 shadow-2xl z-[9999]">
                                <div className="p-2">
                                    {LANGUAGES.map((lang) => (
                                        <button
                                            key={lang.value || 'plain'}
                                            onClick={() => handleLanguageChange(lang.value)}
                                            className={cn(
                                                'w-full text-left px-4 py-2.5 text-sm rounded-lg hover:bg-white/10 transition-colors',
                                                'flex items-center gap-3',
                                                language === lang.value ? 'text-primary bg-white/10' : 'text-white/90'
                                            )}
                                        >
                                            <div className={cn('w-4 h-4 rounded', lang.color, 'border border-white/20')} />
                                            <span className="font-medium">{lang.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Copy button */}
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
                    >
                        {copied ? (
                            <>
                                <Check className="w-3.5 h-3.5 text-green-400" />
                                <span className="text-green-400">Copiado!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Code content */}
                <pre className="p-4 overflow-x-auto text-sm">
                    <NodeViewContent as="code" className={cn(
                        'hljs',
                        language && `language-${language}`
                    )} />
                </pre>
            </div>
        </NodeViewWrapper>
    );
}

// Custom CodeBlock Extension with language selector
export const CodeBlockWithLanguage = CodeBlockLowlight.extend({
    addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView, { flushSync: false } as any);
    },
}).configure({
    lowlight,
    defaultLanguage: '',
});

export default CodeBlockWithLanguage;
