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
import { NotebooksService } from './notebooks.service';
import { User } from '@prisma/client';
import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateNotebookDto {
    @ApiProperty()
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Matches(/^#[0-9a-fA-F]{6}$/)
    color?: string;
}

class UpdateNotebookDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Matches(/^#[0-9a-fA-F]{6}$/)
    color?: string;
}

@ApiTags('notebooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notebooks')
export class NotebooksController {
    constructor(private readonly notebooksService: NotebooksService) { }

    @Get()
    @ApiOperation({ summary: 'Get all notebooks' })
    async findAll(@CurrentUser() user: User) {
        return this.notebooksService.findAll(user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a notebook by ID' })
    async findById(@CurrentUser() user: User, @Param('id') id: string) {
        return this.notebooksService.findById(id, user.id);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new notebook' })
    async create(@CurrentUser() user: User, @Body() dto: CreateNotebookDto) {
        return this.notebooksService.create(user.id, dto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a notebook' })
    async update(
        @CurrentUser() user: User,
        @Param('id') id: string,
        @Body() dto: UpdateNotebookDto,
    ) {
        return this.notebooksService.update(id, user.id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a notebook' })
    async delete(@CurrentUser() user: User, @Param('id') id: string) {
        await this.notebooksService.delete(id, user.id);
        return { success: true };
    }
}
