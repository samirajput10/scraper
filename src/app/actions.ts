'use server';

import { formatScrapedEmails } from '@/ai/flows/format-scraped-emails';
import { z } from 'zod';
import * as cheerio from 'cheerio';

const urlSchema = z.string().url({ message: 'Please enter a valid URL.' });

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const HEADERS = {
  'User-Agent': 'WebmailHarvester/1.0 (+https://firebase.google.com/docs/app-hosting)',
};

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

async function crawlEntireWebsite(startUrl: string, maxPages = 50): Promise<string[]> {
  const parsedStart = new URL(startUrl);
  const baseDomain = parsedStart.hostname;

  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  const foundEmails = new Set<string>();
  let pagesVisited = 0;

  while (queue.length > 0 && pagesVisited < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) {
      continue;
    }
    visited.add(url);
    pagesVisited++;

    const html = await getPage(url);
    if (!html) {
      continue;
    }

    const emailsInPage = html.match(EMAIL_RE) || [];
    for (const email of emailsInPage) {
      foundEmails.add(email);
    }

    const $ = cheerio.load(html);
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href')?.trim();
      if (!href || href.startsWith('mailto:') || href.startsWith('javascript:') || href.startsWith('tel:')) {
        return;
      }

      try {
        const newUrl = new URL(href, url);
        if (newUrl.hostname === baseDomain && !visited.has(newUrl.href) && !queue.includes(newUrl.href)) {
          queue.push(newUrl.href);
        }
      } catch (e) {
        // Ignore invalid URLs
      }
    });
    
    // Gentle delay to avoid overloading server
    if (queue.length > 0 && pagesVisited < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return Array.from(foundEmails);
}

export async function scrapeEmailsAction(url: string) {
  const validation = urlSchema.safeParse(url);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    const emails = await crawlEntireWebsite(validation.data);
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
