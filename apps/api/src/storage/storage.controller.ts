import {
    Controller,
    Post,
    Delete,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { StorageService } from './storage.service';
import { User } from '@prisma/client';

@ApiTags('storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
    constructor(private readonly storageService: StorageService) { }

    @Post('upload/:noteId')
    @ApiOperation({ summary: 'Upload a file attachment' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(
        FileInterceptor('file', {
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB
            },
        }),
    )
    async uploadFile(
        @CurrentUser() user: User,
        @Param('noteId') noteId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        return this.storageService.uploadFile(noteId, file, user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a file attachment' })
    async deleteFile(@CurrentUser() user: User, @Param('id') id: string) {
        return this.storageService.deleteFile(id, user.id);
    }
}
