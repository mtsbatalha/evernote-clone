import { Module } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesController } from './notes.controller';
import { SearchModule } from '../search/search.module';

@Module({
    imports: [SearchModule],
    providers: [NotesService],
    controllers: [NotesController],
    exports: [NotesService],
})
export class NotesModule { }
