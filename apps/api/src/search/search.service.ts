import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch, Index } from 'meilisearch';
import { Note } from '@evernote-clone/database';
import { PrismaService } from '../prisma/prisma.service';

interface NoteDocument {
    id: string;
    title: string;
    plainText: string;
    authorId: string;
    notebookId: string | null;
    createdAt: number;
    updatedAt: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
    private client: MeiliSearch;
    private notesIndex: Index<NoteDocument>;
    private meiliSearchAvailable = false;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.client = new MeiliSearch({
            host: this.configService.get<string>('MEILISEARCH_HOST') || 'http://localhost:7700',
            apiKey: this.configService.get<string>('MEILISEARCH_API_KEY') || 'masterKey',
        });
    }

    async onModuleInit() {
        try {
            // Initialize notes index
            this.notesIndex = this.client.index('notes');

            // Configure searchable and filterable attributes
            await this.notesIndex.updateSettings({
                searchableAttributes: ['title', 'plainText'],
                filterableAttributes: ['authorId', 'notebookId'],
                sortableAttributes: ['createdAt', 'updatedAt'],
            });

            this.meiliSearchAvailable = true;
            console.log('✅ Meilisearch initialized');
        } catch (error) {
            this.meiliSearchAvailable = false;
            console.warn('⚠️ Meilisearch not available, using database search fallback:', error.message);
        }
    }

    async indexNote(note: Note & { tags?: any[] }): Promise<void> {
        if (!this.meiliSearchAvailable) return;

        try {
            const document: NoteDocument = {
                id: note.id,
                title: note.title,
                plainText: note.plainText || '',
                authorId: note.authorId,
                notebookId: note.notebookId,
                createdAt: note.createdAt.getTime(),
                updatedAt: note.updatedAt.getTime(),
            };

            await this.notesIndex.addDocuments([document]);
        } catch (error) {
            console.warn('Failed to index note:', error.message);
        }
    }

    async deleteNote(noteId: string): Promise<void> {
        if (!this.meiliSearchAvailable) return;

        try {
            await this.notesIndex.deleteDocument(noteId);
        } catch (error) {
            console.warn('Failed to delete note from index:', error.message);
        }
    }

    async search(
        userId: string,
        query: string,
        options?: {
            notebookId?: string;
            limit?: number;
            offset?: number;
        },
    ) {
        const startTime = Date.now();

        // Try MeiliSearch first if available
        if (this.meiliSearchAvailable) {
            try {
                const filters: string[] = [`authorId = "${userId}"`];

                if (options?.notebookId) {
                    filters.push(`notebookId = "${options.notebookId}"`);
                }

                const result = await this.notesIndex.search(query, {
                    filter: filters.join(' AND '),
                    limit: options?.limit || 20,
                    offset: options?.offset || 0,
                    attributesToRetrieve: ['id', 'title', 'plainText', 'notebookId', 'updatedAt'],
                    attributesToHighlight: ['title', 'plainText'],
                    highlightPreTag: '<mark>',
                    highlightPostTag: '</mark>',
                });

                return {
                    hits: result.hits,
                    total: result.estimatedTotalHits,
                    processingTimeMs: result.processingTimeMs,
                };
            } catch (error) {
                console.warn('MeiliSearch query failed, falling back to database:', error.message);
            }
        }

        // Database fallback search using Prisma
        return this.searchInDatabase(userId, query, options, startTime);
    }

    private async searchInDatabase(
        userId: string,
        query: string,
        options?: {
            notebookId?: string;
            limit?: number;
            offset?: number;
        },
        startTime?: number,
    ) {
        const searchStartTime = startTime || Date.now();
        const limit = options?.limit || 20;
        const offset = options?.offset || 0;

        // Build where clause
        const where: any = {
            OR: [
                { authorId: userId },
                { shares: { some: { userId } } },
            ],
            isTrashed: false,
            AND: [
                {
                    OR: [
                        { title: { contains: query, mode: 'insensitive' } },
                        { plainText: { contains: query, mode: 'insensitive' } },
                    ],
                },
            ],
        };

        if (options?.notebookId) {
            where.notebookId = options.notebookId;
        }

        // Get matching notes
        const [notes, total] = await Promise.all([
            this.prisma.note.findMany({
                where,
                select: {
                    id: true,
                    title: true,
                    plainText: true,
                    notebookId: true,
                    updatedAt: true,
                    createdAt: true,
                    notebook: { select: { id: true, name: true, color: true } },
                },
                orderBy: { updatedAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.note.count({ where }),
        ]);

        const processingTimeMs = Date.now() - searchStartTime;

        return {
            hits: notes.map(note => ({
                ...note,
                updatedAt: note.updatedAt.getTime(),
            })),
            total,
            processingTimeMs,
        };
    }

    async reindexAll(notes: Note[]): Promise<void> {
        if (!this.meiliSearchAvailable) return;

        try {
            const documents: NoteDocument[] = notes.map((note) => ({
                id: note.id,
                title: note.title,
                plainText: note.plainText || '',
                authorId: note.authorId,
                notebookId: note.notebookId,
                createdAt: note.createdAt.getTime(),
                updatedAt: note.updatedAt.getTime(),
            }));

            await this.notesIndex.addDocuments(documents, { primaryKey: 'id' });
        } catch (error) {
            console.warn('Failed to reindex notes:', error.message);
        }
    }
}
