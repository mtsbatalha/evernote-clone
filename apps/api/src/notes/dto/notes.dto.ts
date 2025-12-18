import { IsString, IsOptional, IsBoolean, IsArray, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNoteDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    title?: string;

    @ApiProperty({ required: false, description: 'TipTap JSON content' })
    @IsOptional()
    content?: any;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notebookId?: string;

    @ApiProperty({ required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tagIds?: string[];
}

export class UpdateNoteDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    title?: string;

    @ApiProperty({ required: false, description: 'TipTap JSON content' })
    @IsOptional()
    content?: any;

    @ApiProperty({ required: false, description: 'Plain text for search indexing' })
    @IsOptional()
    @IsString()
    plainText?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notebookId?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isPinned?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isTrashed?: boolean;
}
