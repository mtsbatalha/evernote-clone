import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ example: 'demo@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'demo123' })
    @IsString()
    @MinLength(6)
    password: string;
}

export class RegisterDto {
    @ApiProperty({ example: 'demo@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'Demo User' })
    @IsString()
    @MinLength(2)
    name: string;

    @ApiProperty({ example: 'demo123' })
    @IsString()
    @MinLength(6)
    password: string;
}
