import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Notebook } from '@evernote-clone/database';

@Injectable()
export class NotebooksService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(userId: string): Promise<Notebook[]> {
        return this.prisma.notebook.findMany({
            where: { ownerId: userId },
            include: {
                _count: { select: { notes: { where: { isTrashed: false } } } },
            },
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
    }

    async findById(id: string, userId: string): Promise<Notebook> {
        const notebook = await this.prisma.notebook.findUnique({
            where: { id },
            include: {
                _count: { select: { notes: { where: { isTrashed: false } } } },
            },
        });

        if (!notebook) {
            throw new NotFoundException('Notebook not found');
        }

        if (notebook.ownerId !== userId) {
            throw new ForbiddenException('You do not have access to this notebook');
        }

        return notebook;
    }

    async create(
        userId: string,
        data: { name: string; color?: string },
    ): Promise<Notebook> {
        // Check for duplicate name
        const existing = await this.prisma.notebook.findUnique({
            where: { ownerId_name: { ownerId: userId, name: data.name } },
        });

        if (existing) {
            throw new ConflictException('A notebook with this name already exists');
        }

        return this.prisma.notebook.create({
            data: {
                name: data.name,
                color: data.color || '#6366f1',
                ownerId: userId,
            },
        });
    }

    async update(
        id: string,
        userId: string,
        data: { name?: string; color?: string },
    ): Promise<Notebook> {
        await this.findById(id, userId);

        // Check for duplicate name if updating
        if (data.name) {
            const existing = await this.prisma.notebook.findFirst({
                where: { ownerId: userId, name: data.name, id: { not: id } },
            });
            if (existing) {
                throw new ConflictException('A notebook with this name already exists');
            }
        }

        return this.prisma.notebook.update({
            where: { id },
            data,
        });
    }

    async delete(id: string, userId: string): Promise<void> {
        const notebook = await this.findById(id, userId);

        if (notebook.isDefault) {
            throw new ForbiddenException('Cannot delete the default notebook');
        }

        // Move notes to default notebook or unassign
        const defaultNotebook = await this.prisma.notebook.findFirst({
            where: { ownerId: userId, isDefault: true },
        });

        await this.prisma.note.updateMany({
            where: { notebookId: id },
            data: { notebookId: defaultNotebook?.id || null },
        });

        await this.prisma.notebook.delete({ where: { id } });
    }
}
