'use server';

import { formatScrapedEmails } from '@/ai/flows/format-scraped-emails';
import * as cheerio from 'cheerio';

const URL_RE = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const HEADERS = {
  'User-Agent': 'WebmailHarvester/1.0 (+https://firebase.google.com/docs/app-hosting)',
};
const CRAWL_KEYWORDS = ["contact", "about", "support", "team", "info"];


async function getPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return await response.text();
    }
    return null;
  } catch (error) {
    // This can happen with timeouts or network errors
    return null;
  }
}

async function targetedCrawl(startUrl: string, depth = 1): Promise<string[]> {
  try {
    const parsedStart = new URL(startUrl);
    const baseDomain = parsedStart.hostname;

    const visited = new Set<string>();
    const emails = new Set<string>();

    async function crawl(url: string, currentDepth: number) {
      if (currentDepth < 0 || visited.has(url)) {
        return;
      }
      visited.add(url);

      const html = await getPage(url);
      if (!html) {
        return;
      }

      const emailsInPage = html.match(EMAIL_RE) || [];
      for (const email of emailsInPage) {
        emails.add(email);
      }
      
      if (currentDepth === 0) {
          return;
      }

      const $ = cheerio.load(html);
      const linksToVisit: Promise<void>[] = [];

      $('a[href]').each((_, element) => {
        const href = $(element).attr('href')?.trim();
        if (!href || href.startsWith('mailto:') || href.startsWith('javascript:') || href.startsWith('tel:')) {
          return;
        }

        try {
          const newUrl = new URL(href, url);
          if (newUrl.hostname === baseDomain && !visited.has(newUrl.href)) {
             const linkText = $(element).text().toLowerCase();
             const hasKeyword = CRAWL_KEYWORDS.some(keyword => newUrl.href.includes(keyword) || linkText.includes(keyword));

             if (hasKeyword) {
               linksToVisit.push(crawl(newUrl.href, currentDepth - 1));
             }
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      });

      await Promise.all(linksToVisit);
    }

    await crawl(startUrl, depth);
    return Array.from(emails);
  } catch (e) {
    // If the start URL is invalid, just return no emails
    return [];
  }
}


export async function scrapeEmailsAction(fileContent: string) {
    if (!fileContent) {
        return { success: false, error: 'The uploaded file is empty.' };
    }
    
    const urls = fileContent.split('\n').map(u => u.trim()).filter(Boolean);

    if (urls.length === 0) {
        return { success: false, error: 'No valid URLs found in the file.' };
    }

    const MAX_CONCURRENT_SCRAPES = 10;
    const results: { website: string; email: string }[] = [];
    
    for (let i = 0; i < urls.length; i += MAX_CONCURRENT_SCRAPES) {
        const chunk = urls.slice(i, i + MAX_CONCURRENT_SCRAPES);
        const promises = chunk.map(async (url) => {
            try {
                let prefixedUrl = url;
                if (!prefixedUrl.startsWith('http')) {
                    prefixedUrl = `https://${prefixedUrl}`;
                }
                const emails = await targetedCrawl(prefixedUrl, 1);
                return { url, emails };
            } catch (error) {
                return { url, error: `Failed to process ${url}.` };
            }
        });

        const settledResults = await Promise.all(promises);

        for (const result of settledResults) {
            if (result.emails && result.emails.length > 0) {
                result.emails.forEach(email => {
                    results.push({ website: result.url, email });
                });
            }
        }
    }

    return { success: true, results };
}

export async function formatEmailsAction(emails: { website: string; email: string }[]) {
    if (!emails || emails.length === 0) {
        return { success: false, error: 'No emails to format.' };
    }

    try {
        const uniqueEmails = Array.from(new Set(emails.map(e => e.email)));
        const result = await formatScrapedEmails({ emails: uniqueEmails });

        const formattedEmailSet = new Set(result.formattedEmails);
        const newResults = emails.filter(e => formattedEmailSet.has(e.email));

        return { success: true, formattedEmails: newResults };
    } catch (error) {
        console.error('AI formatting failed:', error);
        return { success: false, error: 'AI formatting failed. Please try again.' };
    }
}
