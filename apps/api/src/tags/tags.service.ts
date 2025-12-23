import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Tag } from '@evernote-clone/database';

@Injectable()
export class TagsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(userId: string): Promise<Tag[]> {
        return this.prisma.tag.findMany({
            where: { userId },
            include: {
                _count: { select: { notes: true } },
            },
            orderBy: { name: 'asc' },
        });
    }

    async findById(id: string, userId: string): Promise<Tag> {
        const tag = await this.prisma.tag.findUnique({
            where: { id },
            include: {
                _count: { select: { notes: true } },
            },
        });

        if (!tag || tag.userId !== userId) {
            throw new NotFoundException('Tag not found');
        }

        return tag;
    }

    async create(
        userId: string,
        data: { name: string; color?: string },
    ): Promise<Tag> {
        const existing = await this.prisma.tag.findUnique({
            where: { userId_name: { userId, name: data.name.toLowerCase() } },
        });

        if (existing) {
            throw new ConflictException('A tag with this name already exists');
        }

        return this.prisma.tag.create({
            data: {
                name: data.name.toLowerCase(),
                color: data.color || '#8b5cf6',
                userId,
            },
        });
    }

    async update(
        id: string,
        userId: string,
        data: { name?: string; color?: string },
    ): Promise<Tag> {
        await this.findById(id, userId);

        if (data.name) {
            const existing = await this.prisma.tag.findFirst({
                where: { userId, name: data.name.toLowerCase(), id: { not: id } },
            });
            if (existing) {
                throw new ConflictException('A tag with this name already exists');
            }
        }

        return this.prisma.tag.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name.toLowerCase() }),
                ...(data.color && { color: data.color }),
            },
        });
    }

    async delete(id: string, userId: string): Promise<void> {
        await this.findById(id, userId);
        await this.prisma.tag.delete({ where: { id } });
    }
}
