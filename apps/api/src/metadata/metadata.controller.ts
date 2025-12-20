import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface LinkMetadata {
    url: string;
    title: string | null;
    description: string | null;
    image: string | null;
    favicon: string | null;
    siteName: string | null;
    domain: string;
}

@Controller('metadata')
@UseGuards(JwtAuthGuard)
export class MetadataController {
    @Get('link')
    async getLinkMetadata(@Query('url') url: string): Promise<LinkMetadata> {
        if (!url) {
            return {
                url: '',
                title: null,
                description: null,
                image: null,
                favicon: null,
                siteName: null,
                domain: '',
            };
        }

        try {
            // Parse domain from URL
            const urlObj = new URL(url);
            const domain = urlObj.hostname;

            // Fetch the HTML content
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; EvernoteClone/1.0; +https://evernote-clone.com)',
                    'Accept': 'text/html,application/xhtml+xml',
                },
                signal: AbortSignal.timeout(5000), // 5 second timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();

            // Parse Open Graph and meta tags
            const title = this.extractMetaContent(html, 'og:title')
                || this.extractMetaContent(html, 'twitter:title')
                || this.extractTitle(html);

            const description = this.extractMetaContent(html, 'og:description')
                || this.extractMetaContent(html, 'twitter:description')
                || this.extractMetaContent(html, 'description');

            const image = this.extractMetaContent(html, 'og:image')
                || this.extractMetaContent(html, 'twitter:image');

            const siteName = this.extractMetaContent(html, 'og:site_name')
                || domain;

            const favicon = this.extractFavicon(html, url)
                || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

            return {
                url,
                title,
                description,
                image: image ? this.resolveUrl(image, url) : null,
                favicon,
                siteName,
                domain,
            };
        } catch (error) {
            console.error('Error fetching link metadata:', error);
            const urlObj = new URL(url);
            return {
                url,
                title: urlObj.hostname,
                description: null,
                image: null,
                favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`,
                siteName: null,
                domain: urlObj.hostname,
            };
        }
    }

    private extractMetaContent(html: string, property: string): string | null {
        // Try property attribute (og:*, twitter:*)
        const propertyRegex = new RegExp(
            `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`,
            'i'
        );
        let match = html.match(propertyRegex);
        if (match) return match[1];

        // Try content before property
        const reverseRegex = new RegExp(
            `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`,
            'i'
        );
        match = html.match(reverseRegex);
        if (match) return match[1];

        // Try name attribute (description)
        const nameRegex = new RegExp(
            `<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`,
            'i'
        );
        match = html.match(nameRegex);
        if (match) return match[1];

        // Try content before name
        const reverseNameRegex = new RegExp(
            `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`,
            'i'
        );
        match = html.match(reverseNameRegex);
        if (match) return match[1];

        return null;
    }

    private extractTitle(html: string): string | null {
        const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        return match ? match[1].trim() : null;
    }

    private extractFavicon(html: string, baseUrl: string): string | null {
        // Look for link rel="icon" or rel="shortcut icon"
        const iconRegex = /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i;
        const match = html.match(iconRegex);

        if (match) {
            return this.resolveUrl(match[1], baseUrl);
        }

        // Try reverse order
        const reverseRegex = /<link[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut )?icon["']/i;
        const reverseMatch = html.match(reverseRegex);

        if (reverseMatch) {
            return this.resolveUrl(reverseMatch[1], baseUrl);
        }

        return null;
    }

    private resolveUrl(url: string, baseUrl: string): string {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        if (url.startsWith('//')) {
            return `https:${url}`;
        }
        const base = new URL(baseUrl);
        if (url.startsWith('/')) {
            return `${base.origin}${url}`;
        }
        return `${base.origin}/${url}`;
    }
}
