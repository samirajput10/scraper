'use server';

import { formatScrapedEmails } from '@/ai/flows/format-scraped-emails';
import { z } from 'zod';

const urlSchema = z.string().url({ message: 'Please enter a valid URL.' });

// This is a mock function to simulate email scraping.
// In a real application, this would involve a web scraping library.
async function mockScrape(url: string): Promise<string[]> {
    console.log(`Scraping ${url}...`);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Return a mix of valid and invalid emails to showcase the formatter
    return [
        'contact@example.com',
        'info@business.co',
        'support@web.org',
        'john.doe@email.com',
        'jane.doe at gmail.com', // invalid format
        'sales[at]company.net', // invalid format
        'not-an-email',
        'jobs@', // invalid
        'marketing@corporate.com',
        'user@sub.domain.co.uk',
        'another.email@provider.com',
        'webmaster@site.net',
        'hello@world.io',
        'feedback@mail-server.com',
        'test@test.com'
    ];
}


export async function scrapeEmailsAction(url: string) {
  const validation = urlSchema.safeParse(url);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    const emails = await mockScrape(validation.data);
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
