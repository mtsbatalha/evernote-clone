import { Module } from '@nestjs/common';
import { NotebooksService } from './notebooks.service';
import { NotebooksController } from './notebooks.controller';

@Module({
    providers: [NotebooksService],
    controllers: [NotebooksController],
    exports: [NotebooksService],
})
export class NotebooksModule { }
