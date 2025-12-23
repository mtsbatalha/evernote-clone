import {
    createParamDecorator,
    ExecutionContext,
    SetMetadata,
} from '@nestjs/common';
import { User } from '@evernote-clone/database';

export const CurrentUser = createParamDecorator(
    (data: keyof User | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user as User;

        if (data) {
            return user[data];
        }

        return user;
    },
);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
