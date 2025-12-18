import {
    Injectable,
    UnauthorizedException,
    ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface JwtPayload {
    sub: string;
    email: string;
}

export interface AuthResponse {
    accessToken: string;
    user: {
        id: string;
        email: string;
        name: string | null;
        avatar: string | null;
    };
}

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) { }

    async register(dto: RegisterDto): Promise<AuthResponse> {
        // Check if user exists
        const existingUser = await this.usersService.findByEmail(dto.email);
        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        // Hash password
        const hashedPassword = await hash(dto.password, 12);

        // Create user
        const user = await this.usersService.create({
            email: dto.email,
            name: dto.name,
            password: hashedPassword,
        });

        // Generate token
        const accessToken = this.generateToken(user.id, user.email);

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
            },
        };
    }

    async login(dto: LoginDto): Promise<AuthResponse> {
        const user = await this.usersService.findByEmail(dto.email);

        if (!user || !user.password) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await compare(dto.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const accessToken = this.generateToken(user.id, user.email);

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
            },
        };
    }

    async validateUser(payload: JwtPayload) {
        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return user;
    }

    private generateToken(userId: string, email: string): string {
        const payload: JwtPayload = { sub: userId, email };
        return this.jwtService.sign(payload);
    }
}
