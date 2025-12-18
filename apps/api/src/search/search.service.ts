import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch, Index } from 'meilisearch';
import { Note } from '@prisma/client';

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

    constructor(private readonly configService: ConfigService) {
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

            console.log('✅ Meilisearch initialized');
        } catch (error) {
            console.warn('⚠️ Meilisearch not available, search will be disabled:', error.message);
        }
    }

    async indexNote(note: Note & { tags?: any[] }): Promise<void> {
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
            console.warn('Search failed:', error.message);
            return { hits: [], total: 0, processingTimeMs: 0 };
        }
    }

    async reindexAll(notes: Note[]): Promise<void> {
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
