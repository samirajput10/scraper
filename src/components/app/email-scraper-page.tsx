'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Download, Wand2, Loader2 } from 'lucide-react';
import { formatEmailsAction, scrapeEmailsAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Logo } from './logo';

const formSchema = z.object({
  url: z.string().url({ message: 'Please enter a valid URL.' }),
});

export default function EmailScraperPage() {
  const [emails, setEmails] = useState<string[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsScraping(true);
    setEmails([]);
    const result = await scrapeEmailsAction(values.url);
    setIsScraping(false);

    if (result.success) {
      setEmails(result.emails || []);
    } else {
      toast({
        variant: 'destructive',
        title: 'Scraping Failed',
        description: result.error,
      });
    }
  }

  async function handleFormat() {
    setIsFormatting(true);
    const result = await formatEmailsAction(emails);
    setIsFormatting(false);
    if (result.success) {
      setEmails(result.formattedEmails || []);
    } else {
      toast({
        variant: 'destructive',
        title: 'Formatting Failed',
        description: result.error,
      });
    }
  }

  function handleExport() {
    if (emails.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'No emails to export.',
      });
      return;
    }
    const csvContent = 'data:text/csv;charset=utf-8,' + 'email\n' + emails.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'scraped_emails.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const hasResults = emails.length > 0 || isScraping;

  return (
    <main className="container mx-auto py-8 px-4 md:px-0">
      <header className="text-center mb-10">
        <div className="inline-block">
            <Logo />
        </div>
        <p className="mt-2 text-lg text-muted-foreground">
          Enter a website URL to start harvesting emails.
        </p>
      </header>

      <Card className="w-full max-w-2xl mx-auto shadow-lg transition-all duration-500" style={{borderBottomRightRadius: hasResults ? 0 : 'var(--radius)', borderBottomLeftRadius: hasResults ? 0 : 'var(--radius)'}}>
        <CardHeader>
          <CardTitle>Website URL</CardTitle>
          <CardDescription>Enter the full URL of the website you want to scrape.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} disabled={isScraping} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isScraping}>
                {isScraping ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {isScraping ? 'Scraping...' : 'Scrape Emails'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {hasResults && (
        <Card className="w-full max-w-2xl mx-auto shadow-lg" style={{borderTopRightRadius: 0, borderTopLeftRadius: 0}}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle>Results</CardTitle>
                    <CardDescription>
                      {isScraping ? 'Searching for emails...' : `${emails.length} emails found. You can format or export them.`}
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleFormat} disabled={isFormatting || isScraping || emails.length === 0}>
                        {isFormatting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        Format with AI
                    </Button>
                    <Button onClick={handleExport} disabled={isScraping || emails.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72 w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isScraping ? (
                     Array.from({length: 10}).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
                        </TableCell>
                      </TableRow>
                     ))
                  ) : emails.length > 0 ? (
                    emails.map((email, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{email}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="text-center text-muted-foreground col-span-full">
                        No emails found on the provided URL.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
