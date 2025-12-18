import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { SearchService } from './search.service';
import { User } from '@prisma/client';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
    constructor(private readonly searchService: SearchService) { }

    @Get()
    @ApiOperation({ summary: 'Search notes' })
    @ApiQuery({ name: 'q', required: true })
    @ApiQuery({ name: 'notebookId', required: false })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    async search(
        @CurrentUser() user: User,
        @Query('q') query: string,
        @Query('notebookId') notebookId?: string,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
    ): Promise<{ hits: any[]; total: number; processingTimeMs: number }> {
        return this.searchService.search(user.id, query, {
            notebookId,
            limit,
            offset,
        });
    }
}
