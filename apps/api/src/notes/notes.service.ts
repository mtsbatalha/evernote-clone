import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { Note, SharePermission } from '@prisma/client';
import { CreateNoteDto, UpdateNoteDto } from './dto/notes.dto';

@Injectable()
export class NotesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly searchService: SearchService,
    ) { }

    async findAll(userId: string, options?: { notebookId?: string; tagId?: string; trashed?: boolean }) {
        const where: any = {
            OR: [
                { authorId: userId },
                { shares: { some: { userId } } },
            ],
            isTrashed: options?.trashed ?? false,
        };

        if (options?.notebookId) {
            where.notebookId = options.notebookId;
        }

        if (options?.tagId) {
            where.tags = { some: { tagId: options.tagId } };
        }

        return this.prisma.note.findMany({
            where,
            include: {
                notebook: { select: { id: true, name: true, color: true } },
                tags: { include: { tag: true } },
                author: { select: { id: true, name: true, avatar: true } },
                _count: { select: { attachments: true } },
            },
            orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        });
    }

    async findById(id: string, userId: string): Promise<Note> {
        const note = await this.prisma.note.findUnique({
            where: { id },
            include: {
                notebook: true,
                tags: { include: { tag: true } },
                author: { select: { id: true, name: true, avatar: true } },
                attachments: true,
                shares: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
            },
        });

        if (!note) {
            throw new NotFoundException('Note not found');
        }

        // Check access
        await this.checkAccess(note, userId, 'READ');

        return note;
    }

    async create(userId: string, dto: CreateNoteDto): Promise<Note> {
        const note = await this.prisma.note.create({
            data: {
                title: dto.title || 'Untitled',
                content: dto.content,
                authorId: userId,
                notebookId: dto.notebookId,
                tags: dto.tagIds?.length
                    ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
                    : undefined,
            },
            include: {
                notebook: true,
                tags: { include: { tag: true } },
            },
        });

        // Index for search
        await this.searchService.indexNote(note);

        return note;
    }

    async bulkCreate(userId: string, notes: CreateNoteDto[]): Promise<Note[]> {
        // Create all notes in a transaction for better performance
        const createdNotes = await this.prisma.$transaction(
            notes.map((dto) =>
                this.prisma.note.create({
                    data: {
                        title: dto.title || 'Untitled',
                        content: dto.content,
                        authorId: userId,
                        notebookId: dto.notebookId,
                        tags: dto.tagIds?.length
                            ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
                            : undefined,
                    },
                    include: {
                        notebook: true,
                        tags: { include: { tag: true } },
                    },
                })
            )
        );

        // Index all notes for search (in parallel for speed)
        await Promise.all(createdNotes.map((note) => this.searchService.indexNote(note)));

        return createdNotes;
    }

    async update(id: string, userId: string, dto: UpdateNoteDto): Promise<Note> {
        const note = await this.findById(id, userId);
        await this.checkAccess(note, userId, 'WRITE');

        // Create version snapshot before update
        if (note.content) {
            await this.prisma.noteVersion.create({
                data: {
                    noteId: id,
                    title: note.title,
                    content: note.content,
                },
            });
        }

        const updated = await this.prisma.note.update({
            where: { id },
            data: {
                title: dto.title,
                content: dto.content,
                plainText: dto.plainText,
                notebookId: dto.notebookId,
                isPinned: dto.isPinned,
                isTrashed: dto.isTrashed,
                trashedAt: dto.isTrashed ? new Date() : null,
            },
            include: {
                notebook: true,
                tags: { include: { tag: true } },
                author: { select: { id: true, name: true, avatar: true } },
            },
        });

        // Update search index
        await this.searchService.indexNote(updated);

        return updated;
    }

    async delete(id: string, userId: string): Promise<void> {
        const note = await this.findById(id, userId);

        // Only author can delete permanently
        if (note.authorId !== userId) {
            throw new ForbiddenException('Only the author can delete this note');
        }

        await this.prisma.note.delete({ where: { id } });
        await this.searchService.deleteNote(id);
    }

    async bulkTrash(userId: string, noteIds: string[]): Promise<void> {
        // Update all notes owned by user to trashed
        await this.prisma.note.updateMany({
            where: {
                id: { in: noteIds },
                authorId: userId,
            },
            data: {
                isTrashed: true,
                trashedAt: new Date(),
            },
        });
    }

    async bulkDelete(userId: string, noteIds: string[]): Promise<void> {
        // Delete all notes owned by user
        const deleted = await this.prisma.note.deleteMany({
            where: {
                id: { in: noteIds },
                authorId: userId,
            },
        });

        // Remove from search index
        await Promise.all(noteIds.map((id) => this.searchService.deleteNote(id)));
    }

    async getVersions(id: string, userId: string) {
        await this.findById(id, userId); // Check access

        return this.prisma.noteVersion.findMany({
            where: { noteId: id },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }

    async restoreVersion(noteId: string, versionId: string, userId: string) {
        const note = await this.findById(noteId, userId);
        await this.checkAccess(note, userId, 'WRITE');

        const version = await this.prisma.noteVersion.findUnique({
            where: { id: versionId },
        });

        if (!version || version.noteId !== noteId) {
            throw new NotFoundException('Version not found');
        }

        return this.update(noteId, userId, {
            title: version.title,
            content: version.content,
        });
    }

    async updateTags(id: string, userId: string, tagIds: string[]) {
        const note = await this.findById(id, userId);
        await this.checkAccess(note, userId, 'WRITE');

        // Remove all existing tags and add new ones
        await this.prisma.noteTag.deleteMany({ where: { noteId: id } });

        if (tagIds.length > 0) {
            await this.prisma.noteTag.createMany({
                data: tagIds.map((tagId) => ({ noteId: id, tagId })),
            });
        }

        return this.findById(id, userId);
    }

    private async checkAccess(
        note: Note & { authorId: string; shares?: { userId: string; permission: SharePermission }[] },
        userId: string,
        requiredPermission: 'READ' | 'WRITE' | 'ADMIN',
    ): Promise<void> {
        // Author has full access
        if (note.authorId === userId) return;

        // Check share permission
        const share = note.shares?.find((s) => s.userId === userId);
        if (!share) {
            throw new ForbiddenException('You do not have access to this note');
        }

        const permissionLevel = { READ: 1, WRITE: 2, ADMIN: 3 };
        if (permissionLevel[share.permission] < permissionLevel[requiredPermission]) {
            throw new ForbiddenException('Insufficient permissions');
        }
    }
}
