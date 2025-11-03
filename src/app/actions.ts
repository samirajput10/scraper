'use server';

import { formatScrapedEmails } from '@/ai/flows/format-scraped-emails';
import { z } from 'zod';
import * as cheerio from 'cheerio';

const urlSchema = z.string().url({ message: 'Please enter a valid URL.' });

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const HEADERS = {
  'User-Agent': 'WebmailHarvester/1.0 (+https://firebase.google.com/docs/app-hosting)',
};
const CRAWL_KEYWORDS = ["contact", "about", "support", "team", "info"];


async function getPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
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
}


export async function scrapeEmailsAction(url: string) {
  const validation = urlSchema.safeParse(url);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    // Start with the main page, then crawl 1 level deeper for keyword links
    const emails = await targetedCrawl(validation.data, 1);
    return { success: true, emails };
  } catch (error) {
    console.error('Scraping failed:', error);
    return { success: false, error: 'Failed to scrape emails. The website may be blocking scrapers or is unavailable.' };
  }
}

export async function formatEmailsAction(emails: string[]) {
    if (!emails || emails.length === 0) {
        return { success: false, error: 'No emails to format.' };
    }

    try {
        const result = await formatScrapedEmails({ emails });
        return { success: true, formattedEmails: result.formattedEmails };
    } catch (error) {
        console.error('AI formatting failed:', error);
        return { success: false, error: 'AI formatting failed. Please try again.' };
    }
}
