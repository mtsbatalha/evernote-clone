import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create demo user
    const hashedPassword = await hash('demo123', 12);

    const user = await prisma.user.upsert({
        where: { email: 'demo@example.com' },
        update: {},
        create: {
            email: 'demo@example.com',
            name: 'Demo User',
            password: hashedPassword,
        },
    });

    console.log('✅ Created user:', user.email);

    // Create default notebook
    const notebook = await prisma.notebook.upsert({
        where: {
            ownerId_name: {
                ownerId: user.id,
                name: 'Personal Notes'
            }
        },
        update: {},
        create: {
            name: 'Personal Notes',
            color: '#6366f1',
            isDefault: true,
            ownerId: user.id,
        },
    });

    console.log('✅ Created notebook:', notebook.name);

    // Create some tags
    const tags = await Promise.all([
        prisma.tag.upsert({
            where: { userId_name: { userId: user.id, name: 'important' } },
            update: {},
            create: { name: 'important', color: '#ef4444', userId: user.id },
        }),
        prisma.tag.upsert({
            where: { userId_name: { userId: user.id, name: 'work' } },
            update: {},
            create: { name: 'work', color: '#3b82f6', userId: user.id },
        }),
        prisma.tag.upsert({
            where: { userId_name: { userId: user.id, name: 'ideas' } },
            update: {},
            create: { name: 'ideas', color: '#10b981', userId: user.id },
        }),
    ]);

    console.log('✅ Created tags:', tags.map(t => t.name).join(', '));

    // Create sample notes
    const notes = await Promise.all([
        prisma.note.create({
            data: {
                title: 'Welcome to Evernote Clone!',
                content: {
                    type: 'doc',
                    content: [
                        {
                            type: 'heading',
                            attrs: { level: 1 },
                            content: [{ type: 'text', text: 'Welcome to Evernote Clone!' }],
                        },
                        {
                            type: 'paragraph',
                            content: [
                                { type: 'text', text: 'This is your first note. Start writing and organize your thoughts!' },
                            ],
                        },
                        {
                            type: 'bulletList',
                            content: [
                                {
                                    type: 'listItem',
                                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Create notebooks to organize notes' }] }],
                                },
                                {
                                    type: 'listItem',
                                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Use tags for quick filtering' }] }],
                                },
                                {
                                    type: 'listItem',
                                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Share notes with collaborators' }] }],
                                },
                            ],
                        },
                    ],
                },
                plainText: 'Welcome to Evernote Clone! This is your first note. Start writing and organize your thoughts! Create notebooks to organize notes Use tags for quick filtering Share notes with collaborators',
                isPinned: true,
                authorId: user.id,
                notebookId: notebook.id,
                tags: {
                    create: [{ tagId: tags[0]!.id }],
                },
            },
        }),
        prisma.note.create({
            data: {
                title: 'Meeting Notes',
                content: {
                    type: 'doc',
                    content: [
                        {
                            type: 'heading',
                            attrs: { level: 2 },
                            content: [{ type: 'text', text: 'Weekly Standup - December 16' }],
                        },
                        {
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Discussed project milestones and upcoming deadlines.' }],
                        },
                    ],
                },
                plainText: 'Weekly Standup - December 16 Discussed project milestones and upcoming deadlines.',
                authorId: user.id,
                notebookId: notebook.id,
                tags: {
                    create: [{ tagId: tags[1]!.id }],
                },
            },
        }),
        prisma.note.create({
            data: {
                title: 'App Ideas',
                content: {
                    type: 'doc',
                    content: [
                        {
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Brainstorming session for new features:' }],
                        },
                        {
                            type: 'orderedList',
                            content: [
                                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AI-powered note suggestions' }] }] },
                                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Voice-to-text transcription' }] }] },
                                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Template library' }] }] },
                            ],
                        },
                    ],
                },
                plainText: 'Brainstorming session for new features: AI-powered note suggestions Voice-to-text transcription Template library',
                authorId: user.id,
                notebookId: notebook.id,
                tags: {
                    create: [{ tagId: tags[2]!.id }],
                },
            },
        }),
    ]);

    console.log('✅ Created notes:', notes.map(n => n.title).join(', '));

    console.log('🎉 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
