import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { UsersService } from './users.service';
import { User } from '@evernote-clone/database';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me')
    @ApiOperation({ summary: 'Get current user profile' })
    async getProfile(@CurrentUser() user: User) {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            createdAt: user.createdAt,
        };
    }

    @Patch('me')
    @ApiOperation({ summary: 'Update current user profile' })
    async updateProfile(
        @CurrentUser() user: User,
        @Body() data: { name?: string; avatar?: string },
    ) {
        return this.usersService.update(user.id, data);
    }

    @Patch('me/password')
    @ApiOperation({ summary: 'Change current user password' })
    async changePassword(
        @CurrentUser() user: User,
        @Body() data: { currentPassword: string; newPassword: string },
    ) {
        await this.usersService.changePassword(
            user.id,
            data.currentPassword,
            data.newPassword,
        );
        return { message: 'Password changed successfully' };
    }
}
