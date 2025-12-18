import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { SharesService } from './shares.service';
import { User, SharePermission } from '@prisma/client';
import { IsString, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateShareDto {
    @ApiProperty()
    @IsString()
    noteId: string;

    @ApiProperty()
    @IsEmail()
    email: string;

    @ApiProperty({ enum: ['READ', 'WRITE', 'ADMIN'] })
    @IsEnum(['READ', 'WRITE', 'ADMIN'])
    permission: SharePermission;
}

class UpdateShareDto {
    @ApiProperty({ enum: ['READ', 'WRITE', 'ADMIN'] })
    @IsEnum(['READ', 'WRITE', 'ADMIN'])
    permission: SharePermission;
}

@ApiTags('shares')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shares')
export class SharesController {
    constructor(private readonly sharesService: SharesService) { }

    @Get('shared-with-me')
    @ApiOperation({ summary: 'Get notes shared with current user' })
    async getSharedWithMe(@CurrentUser() user: User) {
        return this.sharesService.getSharedWithMe(user.id);
    }

    @Get('note/:noteId')
    @ApiOperation({ summary: 'Get all shares for a note' })
    async getSharesForNote(
        @CurrentUser() user: User,
        @Param('noteId') noteId: string,
    ) {
        return this.sharesService.getSharesForNote(noteId, user.id);
    }

    @Post()
    @ApiOperation({ summary: 'Share a note with another user' })
    async shareNote(@CurrentUser() user: User, @Body() dto: CreateShareDto) {
        return this.sharesService.shareNote(
            dto.noteId,
            user.id,
            dto.email,
            dto.permission,
        );
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update share permission' })
    async updateShare(
        @CurrentUser() user: User,
        @Param('id') id: string,
        @Body() dto: UpdateShareDto,
    ) {
        return this.sharesService.updateShare(id, user.id, dto.permission);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Remove a share' })
    async removeShare(@CurrentUser() user: User, @Param('id') id: string) {
        await this.sharesService.removeShare(id, user.id);
        return { success: true };
    }
}
