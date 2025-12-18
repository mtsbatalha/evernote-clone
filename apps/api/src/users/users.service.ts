import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async findById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async create(data: {
        email: string;
        name: string;
        password: string;
    }): Promise<User> {
        // Create user with default notebook
        return this.prisma.user.create({
            data: {
                ...data,
                notebooks: {
                    create: {
                        name: 'Personal Notes',
                        isDefault: true,
                        color: '#6366f1',
                    },
                },
            },
        });
    }

    async update(
        id: string,
        data: { name?: string; avatar?: string },
    ): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string,
    ): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            throw new BadRequestException('Senha atual incorreta');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
    }
}
