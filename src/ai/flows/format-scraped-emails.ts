'use server';

/**
 * @fileOverview This file contains a Genkit flow that formats and standardizes scraped email addresses using AI.
 *
 * - formatScrapedEmails - A function that takes an array of scraped emails and returns a formatted array.
 * - FormatScrapedEmailsInput - The input type for the formatScrapedEmails function.
 * - FormatScrapedEmailsOutput - The return type for the formatScrapedEmails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FormatScrapedEmailsInputSchema = z.object({
  emails: z.array(z.string()).describe('An array of scraped email addresses.'),
});
export type FormatScrapedEmailsInput = z.infer<typeof FormatScrapedEmailsInputSchema>;

const FormatScrapedEmailsOutputSchema = z.object({
  formattedEmails: z
    .array(z.string())
    .describe('An array of formatted and standardized email addresses.'),
});
export type FormatScrapedEmailsOutput = z.infer<typeof FormatScrapedEmailsOutputSchema>;

export async function formatScrapedEmails(input: FormatScrapedEmailsInput): Promise<FormatScrapedEmailsOutput> {
  return formatScrapedEmailsFlow(input);
}

const formatScrapedEmailsPrompt = ai.definePrompt({
  name: 'formatScrapedEmailsPrompt',
  input: {schema: FormatScrapedEmailsInputSchema},
  output: {schema: FormatScrapedEmailsOutputSchema},
  prompt: `You are an expert in data cleansing and standardization.

You are given a list of scraped email addresses. Your task is to format and standardize these emails, removing any incorrect or malformed data.

Input Emails:
{{#each emails}}{{{this}}}
{{/each}}

Output the formatted and standardized email addresses.

Ensure that the output only contains valid email addresses.

Output Format: An array of strings.
`,
});

const formatScrapedEmailsFlow = ai.defineFlow(
  {
    name: 'formatScrapedEmailsFlow',
    inputSchema: FormatScrapedEmailsInputSchema,
    outputSchema: FormatScrapedEmailsOutputSchema,
  },
  async input => {
    const {output} = await formatScrapedEmailsPrompt(input);
    return output!;
  }
);
