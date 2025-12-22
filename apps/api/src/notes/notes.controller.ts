import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/notes.dto';
import { User } from '@prisma/client';

@ApiTags('notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
    constructor(private readonly notesService: NotesService) { }

    @Get()
    @ApiOperation({ summary: 'Get all notes for current user' })
    @ApiQuery({ name: 'notebookId', required: false })
    @ApiQuery({ name: 'tagId', required: false })
    @ApiQuery({ name: 'trashed', required: false, type: Boolean })
    async findAll(
        @CurrentUser() user: User,
        @Query('notebookId') notebookId?: string,
        @Query('tagId') tagId?: string,
        @Query('trashed') trashed?: boolean,
    ) {
        return this.notesService.findAll(user.id, { notebookId, tagId, trashed });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a note by ID' })
    async findById(@CurrentUser() user: User, @Param('id') id: string) {
        return this.notesService.findById(id, user.id);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new note' })
    async create(@CurrentUser() user: User, @Body() dto: CreateNoteDto) {
        return this.notesService.create(user.id, dto);
    }

    @Post('bulk')
    @ApiOperation({ summary: 'Create multiple notes at once (for import)' })
    async bulkCreate(@CurrentUser() user: User, @Body() body: { notes: CreateNoteDto[] }) {
        return this.notesService.bulkCreate(user.id, body.notes);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a note' })
    async update(
        @CurrentUser() user: User,
        @Param('id') id: string,
        @Body() dto: UpdateNoteDto,
    ) {
        return this.notesService.update(id, user.id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a note permanently' })
    async delete(@CurrentUser() user: User, @Param('id') id: string) {
        await this.notesService.delete(id, user.id);
        return { success: true };
    }

    @Get(':id/versions')
    @ApiOperation({ summary: 'Get version history for a note' })
    async getVersions(@CurrentUser() user: User, @Param('id') id: string) {
        return this.notesService.getVersions(id, user.id);
    }

    @Post(':id/versions/:versionId/restore')
    @ApiOperation({ summary: 'Restore a note to a previous version' })
    async restoreVersion(
        @CurrentUser() user: User,
        @Param('id') id: string,
        @Param('versionId') versionId: string,
    ) {
        return this.notesService.restoreVersion(id, versionId, user.id);
    }

    @Patch(':id/tags')
    @ApiOperation({ summary: 'Update tags for a note' })
    async updateTags(
        @CurrentUser() user: User,
        @Param('id') id: string,
        @Body() body: { tagIds: string[] },
    ) {
        return this.notesService.updateTags(id, user.id, body.tagIds);
    }
}
