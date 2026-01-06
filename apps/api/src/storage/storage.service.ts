import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as AWS from 'aws-sdk';
import { v4 as uuid } from 'uuid';

@Injectable()
export class StorageService {
    private s3: AWS.S3;
    private bucket: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.s3 = new AWS.S3({
            endpoint: this.configService.get<string>('S3_ENDPOINT') || 'http://localhost:9000',
            accessKeyId: this.configService.get<string>('S3_ACCESS_KEY') || 'minioadmin',
            secretAccessKey: this.configService.get<string>('S3_SECRET_KEY') || 'minioadmin',
            s3ForcePathStyle: this.configService.get<string>('S3_FORCE_PATH_STYLE') !== 'false',
            signatureVersion: 'v4',
            region: this.configService.get<string>('S3_REGION') || 'us-east-1',
        });


        this.bucket = this.configService.get<string>('S3_BUCKET') || 'evernote-attachments';
    }

    async uploadFile(
        noteId: string,
        file: Express.Multer.File,
        userId: string,
    ) {
        // Verify note access
        const note = await this.prisma.note.findUnique({
            where: { id: noteId },
            include: { shares: true },
        });

        if (!note) {
            throw new Error('Note not found');
        }

        const hasAccess =
            note.authorId === userId ||
            note.shares.some((s) => s.userId === userId && s.permission !== 'READ');

        if (!hasAccess) {
            throw new Error('You do not have permission to upload files to this note');
        }

        // Generate unique key
        const key = `${noteId}/${uuid()}-${file.originalname}`;

        // Upload to S3
        await this.s3
            .upload({
                Bucket: this.bucket,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
            })
            .promise();

        // Create attachment record
        const url = `${this.configService.get<string>('S3_ENDPOINT')}/${this.bucket}/${key}`;

        const attachment = await this.prisma.attachment.create({
            data: {
                noteId,
                filename: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                url,
                key,
            },
        });

        return attachment;
    }

    async deleteFile(attachmentId: string, userId: string) {
        const attachment = await this.prisma.attachment.findUnique({
            where: { id: attachmentId },
            include: {
                note: { include: { shares: true } },
            },
        });

        if (!attachment) {
            throw new Error('Attachment not found');
        }

        const hasAccess =
            attachment.note.authorId === userId ||
            attachment.note.shares.some(
                (s) => s.userId === userId && s.permission !== 'READ',
            );

        if (!hasAccess) {
            throw new Error('You do not have permission to delete this file');
        }

        // Delete from S3
        await this.s3
            .deleteObject({
                Bucket: this.bucket,
                Key: attachment.key,
            })
            .promise();

        // Delete from database
        await this.prisma.attachment.delete({
            where: { id: attachmentId },
        });

        return { success: true };
    }

    async getPresignedUrl(key: string): Promise<string> {
        return this.s3.getSignedUrlPromise('getObject', {
            Bucket: this.bucket,
            Key: key,
            Expires: 3600, // 1 hour
        });
    }

    async getAttachmentsByNote(noteId: string, userId: string) {
        // Verify note access
        const note = await this.prisma.note.findUnique({
            where: { id: noteId },
            include: { shares: true },
        });

        if (!note) {
            throw new Error('Note not found');
        }

        const hasAccess =
            note.authorId === userId ||
            note.shares.some((s) => s.userId === userId);

        if (!hasAccess) {
            throw new Error('You do not have permission to view attachments for this note');
        }

        return this.prisma.attachment.findMany({
            where: { noteId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
