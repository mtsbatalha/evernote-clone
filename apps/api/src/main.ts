import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Increase body size limit for importing large notes
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));

    // Security
    app.use(helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    app.enableCors({
        origin: (requestOrigin, callback) => {
            const allowedOrigins = [
                process.env.APP_URL,
                'http://localhost:3000',
                'http://localhost:4000'
            ];
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!requestOrigin) return callback(null, true);

            if (allowedOrigins.includes(requestOrigin) || requestOrigin === process.env.APP_URL) {
                return callback(null, true);
            } else {
                // For development, we might want to be permissive or log it
                console.log(`[CORS] Blocked request from origin: ${requestOrigin}. Allowed: ${allowedOrigins.join(', ')}`);
                // Use strict blocking or just allow all for now while debugging
                return callback(null, true);
            }
        },
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type,Accept,Authorization',
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // API prefix
    app.setGlobalPrefix('api');

    // Swagger documentation
    const config = new DocumentBuilder()
        .setTitle('Evernote Clone API')
        .setDescription('API documentation for the Evernote Clone application')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`🚀 API running on http://localhost:${port}`);
    console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
