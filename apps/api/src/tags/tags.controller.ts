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
import { TagsService } from './tags.service';
import { User } from '@prisma/client';
import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateTagDto {
    @ApiProperty()
    @IsString()
    @MaxLength(50)
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Matches(/^#[0-9a-fA-F]{6}$/)
    color?: string;
}

class UpdateTagDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Matches(/^#[0-9a-fA-F]{6}$/)
    color?: string;
}

@ApiTags('tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tags')
export class TagsController {
    constructor(private readonly tagsService: TagsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all tags' })
    async findAll(@CurrentUser() user: User) {
        return this.tagsService.findAll(user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a tag by ID' })
    async findById(@CurrentUser() user: User, @Param('id') id: string) {
        return this.tagsService.findById(id, user.id);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new tag' })
    async create(@CurrentUser() user: User, @Body() dto: CreateTagDto) {
        return this.tagsService.create(user.id, dto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a tag' })
    async update(
        @CurrentUser() user: User,
        @Param('id') id: string,
        @Body() dto: UpdateTagDto,
    ) {
        return this.tagsService.update(id, user.id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a tag' })
    async delete(@CurrentUser() user: User, @Param('id') id: string) {
        await this.tagsService.delete(id, user.id);
        return { success: true };
    }
}
