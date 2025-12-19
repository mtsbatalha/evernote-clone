const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface FetchOptions extends RequestInit {
    token?: string;
}

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'An error occurred' }));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
}

// Auth API
export const authApi = {
    login: (email: string, password: string) =>
        fetchApi<{ accessToken: string; user: any }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    register: (email: string, name: string, password: string) =>
        fetchApi<{ accessToken: string; user: any }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, name, password }),
        }),
};

// Notes API
export const notesApi = {
    getAll: (token: string, params?: { notebookId?: string; tagId?: string; trashed?: boolean }) => {
        const searchParams = new URLSearchParams();
        if (params?.notebookId) searchParams.set('notebookId', params.notebookId);
        if (params?.tagId) searchParams.set('tagId', params.tagId);
        if (params?.trashed) searchParams.set('trashed', 'true');
        const query = searchParams.toString();
        return fetchApi<any[]>(`/notes${query ? `?${query}` : ''}`, { token });
    },

    getById: (token: string, id: string) =>
        fetchApi<any>(`/notes/${id}`, { token }),

    create: (token: string, data: { title?: string; content?: any; notebookId?: string }) =>
        fetchApi<any>('/notes', { method: 'POST', body: JSON.stringify(data), token }),

    update: (token: string, id: string, data: any) =>
        fetchApi<any>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),

    delete: (token: string, id: string) =>
        fetchApi<void>(`/notes/${id}`, { method: 'DELETE', token }),

    getVersions: (token: string, id: string) =>
        fetchApi<any[]>(`/notes/${id}/versions`, { token }),

    createVersion: (token: string, id: string) =>
        fetchApi<any>(`/notes/${id}/versions`, { method: 'POST', token }),

    restoreVersion: (token: string, noteId: string, versionId: string) =>
        fetchApi<any>(`/notes/${noteId}/versions/${versionId}/restore`, { method: 'POST', token }),
};

// Notebooks API
export const notebooksApi = {
    getAll: (token: string) =>
        fetchApi<any[]>('/notebooks', { token }),

    create: (token: string, data: { name: string; color?: string }) =>
        fetchApi<any>('/notebooks', { method: 'POST', body: JSON.stringify(data), token }),

    update: (token: string, id: string, data: { name?: string; color?: string }) =>
        fetchApi<any>(`/notebooks/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),

    delete: (token: string, id: string) =>
        fetchApi<void>(`/notebooks/${id}`, { method: 'DELETE', token }),
};

// Tags API
export const tagsApi = {
    getAll: (token: string) =>
        fetchApi<any[]>('/tags', { token }),

    create: (token: string, data: { name: string; color?: string }) =>
        fetchApi<any>('/tags', { method: 'POST', body: JSON.stringify(data), token }),

    update: (token: string, id: string, data: { name?: string; color?: string }) =>
        fetchApi<any>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),

    delete: (token: string, id: string) =>
        fetchApi<void>(`/tags/${id}`, { method: 'DELETE', token }),
};

// Search API
export const searchApi = {
    search: (token: string, query: string, options?: { notebookId?: string; limit?: number }) => {
        const searchParams = new URLSearchParams({ q: query });
        if (options?.notebookId) searchParams.set('notebookId', options.notebookId);
        if (options?.limit) searchParams.set('limit', options.limit.toString());
        return fetchApi<{ hits: any[]; total: number }>(`/search?${searchParams}`, { token });
    },
};

// Shares API
export const sharesApi = {
    shareNote: (token: string, noteId: string, email: string, permission: string) =>
        fetchApi<any>('/shares', {
            method: 'POST',
            body: JSON.stringify({ noteId, email, permission }),
            token,
        }),

    getSharesForNote: (token: string, noteId: string) =>
        fetchApi<any[]>(`/shares/note/${noteId}`, { token }),

    getSharedWithMe: (token: string) =>
        fetchApi<any[]>('/shares/shared-with-me', { token }),

    removeShare: (token: string, shareId: string) =>
        fetchApi<void>(`/shares/${shareId}`, { method: 'DELETE', token }),
};

// Storage API
export interface Attachment {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    url: string;
    key: string;
    createdAt: string;
    noteId: string;
}

export const storageApi = {
    uploadFile: async (token: string, noteId: string, file: File): Promise<Attachment> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_URL}/storage/upload/${noteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Upload failed' }));
            throw new Error(error.message || `HTTP error! status: ${response.status}`);
        }

        return response.json();
    },

    deleteAttachment: (token: string, attachmentId: string) =>
        fetchApi<{ success: boolean }>(`/storage/${attachmentId}`, { method: 'DELETE', token }),

    getAttachments: (token: string, noteId: string) =>
        fetchApi<Attachment[]>(`/storage/note/${noteId}`, { token }),
};
