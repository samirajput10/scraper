'use server';

import { formatScrapedEmails } from '@/ai/flows/format-scraped-emails';
import { z } from 'zod';
import * as cheerio from 'cheerio';

const urlSchema = z.string().url({ message: 'Please enter a valid URL.' });

// In a real application, this would involve a web scraping library.
async function scrape(url: string): Promise<string[]> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch ${url}. Status: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = html.match(emailRegex) || [];

        // Return unique emails
        return [...new Set(emails)];
    } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        return [];
    }
}


export async function scrapeEmailsAction(url: string) {
  const validation = urlSchema.safeParse(url);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    const emails = await scrape(validation.data);
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
