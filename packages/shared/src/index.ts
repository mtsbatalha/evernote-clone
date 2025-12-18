import { z } from 'zod';

// ============================================
// Auth Schemas
// ============================================

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// ============================================
// Note Schemas
// ============================================

export const createNoteSchema = z.object({
    title: z.string().min(1).max(255).optional().default('Untitled'),
    content: z.any().optional(),
    notebookId: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
});

export const updateNoteSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    content: z.any().optional(),
    plainText: z.string().optional(),
    notebookId: z.string().nullable().optional(),
    isPinned: z.boolean().optional(),
    isTrashed: z.boolean().optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

// ============================================
// Notebook Schemas
// ============================================

export const createNotebookSchema = z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateNotebookSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type CreateNotebookInput = z.infer<typeof createNotebookSchema>;
export type UpdateNotebookInput = z.infer<typeof updateNotebookSchema>;

// ============================================
// Tag Schemas
// ============================================

export const createTagSchema = z.object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateTagSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

// ============================================
// Share Schemas
// ============================================

export const sharePermissions = ['READ', 'WRITE', 'ADMIN'] as const;
export type SharePermission = (typeof sharePermissions)[number];

export const createShareSchema = z.object({
    noteId: z.string(),
    email: z.string().email('Invalid email address'),
    permission: z.enum(sharePermissions).default('READ'),
});

export const updateShareSchema = z.object({
    permission: z.enum(sharePermissions),
});

export type CreateShareInput = z.infer<typeof createShareSchema>;
export type UpdateShareInput = z.infer<typeof updateShareSchema>;

// ============================================
// Search Schemas
// ============================================

export const searchSchema = z.object({
    query: z.string().min(1).max(1000),
    notebookId: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).optional().default(20),
    offset: z.number().min(0).optional().default(0),
});

export type SearchInput = z.infer<typeof searchSchema>;

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// ============================================
// User Types
// ============================================

export interface UserProfile {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    createdAt: Date;
}

// ============================================
// WebSocket Events
// ============================================

export const wsEvents = {
    // Note collaboration
    NOTE_JOIN: 'note:join',
    NOTE_LEAVE: 'note:leave',
    NOTE_UPDATE: 'note:update',
    NOTE_SYNC: 'note:sync',

    // Awareness (cursors, presence)
    AWARENESS_UPDATE: 'awareness:update',

    // User presence
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',
} as const;

export type WsEvent = (typeof wsEvents)[keyof typeof wsEvents];
