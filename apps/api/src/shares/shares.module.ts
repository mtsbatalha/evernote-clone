import { Module } from '@nestjs/common';
import { SharesService } from './shares.service';
import { SharesController } from './shares.controller';

@Module({
    providers: [SharesService],
    controllers: [SharesController],
    exports: [SharesService],
})
export class SharesModule { }
