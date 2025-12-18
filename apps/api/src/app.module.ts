import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NotesModule } from './notes/notes.module';
import { NotebooksModule } from './notebooks/notebooks.module';
import { TagsModule } from './tags/tags.module';
import { SharesModule } from './shares/shares.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '../../.env', '../../../.env', '../.env'],
        }),
        PrismaModule,
        RedisModule,
        AuthModule,
        UsersModule,
        NotesModule,
        NotebooksModule,
        TagsModule,
        SharesModule,
        SearchModule,
        StorageModule,
    ],
})
export class AppModule { }
