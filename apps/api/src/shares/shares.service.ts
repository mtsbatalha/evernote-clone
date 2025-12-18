import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NoteShare, SharePermission } from '@prisma/client';

@Injectable()
export class SharesService {
    constructor(private readonly prisma: PrismaService) { }

    async shareNote(
        noteId: string,
        ownerId: string,
        targetEmail: string,
        permission: SharePermission,
    ): Promise<NoteShare> {
        // Verify note ownership
        const note = await this.prisma.note.findUnique({
            where: { id: noteId },
        });

        if (!note) {
            throw new NotFoundException('Note not found');
        }

        if (note.authorId !== ownerId) {
            // Check if user has ADMIN permission
            const share = await this.prisma.noteShare.findUnique({
                where: { noteId_userId: { noteId, userId: ownerId } },
            });

            if (!share || share.permission !== 'ADMIN') {
                throw new ForbiddenException('Only the owner or admin can share this note');
            }
        }

        // Find target user
        const targetUser = await this.prisma.user.findUnique({
            where: { email: targetEmail },
        });

        if (!targetUser) {
            throw new NotFoundException('User not found');
        }

        if (targetUser.id === note.authorId) {
            throw new BadRequestException('Cannot share note with the owner');
        }

        // Check for existing share
        const existingShare = await this.prisma.noteShare.findUnique({
            where: { noteId_userId: { noteId, userId: targetUser.id } },
        });

        if (existingShare) {
            throw new ConflictException('Note is already shared with this user');
        }

        return this.prisma.noteShare.create({
            data: {
                noteId,
                userId: targetUser.id,
                permission,
            },
            include: {
                user: { select: { id: true, email: true, name: true, avatar: true } },
            },
        });
    }

    async updateShare(
        shareId: string,
        ownerId: string,
        permission: SharePermission,
    ): Promise<NoteShare> {
        const share = await this.prisma.noteShare.findUnique({
            where: { id: shareId },
            include: { note: true },
        });

        if (!share) {
            throw new NotFoundException('Share not found');
        }

        if (share.note.authorId !== ownerId) {
            throw new ForbiddenException('Only the owner can update share permissions');
        }

        return this.prisma.noteShare.update({
            where: { id: shareId },
            data: { permission },
            include: {
                user: { select: { id: true, email: true, name: true, avatar: true } },
            },
        });
    }

    async removeShare(shareId: string, ownerId: string): Promise<void> {
        const share = await this.prisma.noteShare.findUnique({
            where: { id: shareId },
            include: { note: true },
        });

        if (!share) {
            throw new NotFoundException('Share not found');
        }

        // Owner or the shared user can remove the share
        if (share.note.authorId !== ownerId && share.userId !== ownerId) {
            throw new ForbiddenException('You cannot remove this share');
        }

        await this.prisma.noteShare.delete({ where: { id: shareId } });
    }

    async getSharesForNote(noteId: string, userId: string): Promise<NoteShare[]> {
        const note = await this.prisma.note.findUnique({
            where: { id: noteId },
        });

        if (!note) {
            throw new NotFoundException('Note not found');
        }

        // Check if user has access to the note
        if (note.authorId !== userId) {
            const share = await this.prisma.noteShare.findUnique({
                where: { noteId_userId: { noteId, userId } },
            });
            if (!share) {
                throw new ForbiddenException('You do not have access to this note');
            }
        }

        return this.prisma.noteShare.findMany({
            where: { noteId },
            include: {
                user: { select: { id: true, email: true, name: true, avatar: true } },
            },
        });
    }

    async getSharedWithMe(userId: string) {
        return this.prisma.noteShare.findMany({
            where: { userId },
            include: {
                note: {
                    include: {
                        author: { select: { id: true, name: true, avatar: true } },
                        notebook: { select: { id: true, name: true, color: true } },
                    },
                },
            },
        });
    }
}
