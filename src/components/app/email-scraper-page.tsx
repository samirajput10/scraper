'use client';

import { useState, useRef } from 'react';
import { FileUp, Download, Wand2, Loader2, FileText, X, Search, FileSpreadsheet, CheckCircle, Shield, List } from 'lucide-react';
import { formatEmailsAction, scrapeEmailsAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from '@/hooks/use-toast';
import { Logo } from './logo';
import * as XLSX from 'xlsx';
import { Textarea } from '@/components/ui/textarea';


type ScrapedResult = {
  website: string;
  email: string;
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="bg-card p-6 rounded-xl shadow-lg hover:shadow-xl transition-all border border-border">
    <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-card-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);


export default function EmailScraperPage() {
  const [results, setResults] = useState<ScrapedResult[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [bulkUrlInput, setBulkUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const resetState = () => {
    setResults([]);
    setUrlInput('');
    setBulkUrlInput('');
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) {
        toast({
            variant: 'destructive',
            title: 'URL is empty',
            description: 'Please enter a website URL to scrape.',
        });
        return;
    }
    
    let urlToScrape = urlInput;
    if (!urlToScrape.startsWith('http://') && !urlToScrape.startsWith('https://')) {
        urlToScrape = `https://${urlToScrape}`;
    }
    handleScrape(urlToScrape);
  }

  const handleBulkUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkUrlInput) {
        toast({
            variant: 'destructive',
            title: 'URL list is empty',
            description: 'Please enter at least one website URL to scrape.',
        });
        return;
    }
    handleScrape(bulkUrlInput);
  }
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleScrape(file);
    }
  };

  const getFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            const urls = json.map(row => row[0]).filter(Boolean).join('\n');
            resolve(urls);
          } else {
            resolve(e.target?.result as string);
          }
        } catch (error) {
          reject('Failed to parse the file.');
        }
      };
      reader.onerror = () => reject('Failed to read the file.');
      
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  }

  async function handleScrape(source: File | string) {
    setIsScraping(true);
    setResults([]);

    try {
        const content = typeof source === 'string' ? source : await getFileContent(source);
        const result = await scrapeEmailsAction(content);
        
        setIsScraping(false);

        if (result.success) {
          setResults(result.results || []);
           if (result.results?.length === 0) {
            toast({
              title: 'No emails found',
              description: 'The scraper ran successfully but did not find any emails.',
            });
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Scraping Failed',
            description: result.error,
          });
        }
    } catch (error) {
        setIsScraping(false);
        toast({
            variant: 'destructive',
            title: 'Error processing source',
            description: typeof error === 'string' ? error : 'An unexpected error occurred.',
        });
    } finally {
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  }

  async function handleFormat() {
    setIsFormatting(true);
    const result = await formatEmailsAction(results);
    setIsFormatting(false);
    if (result.success) {
      setResults(result.formattedEmails || []);
      toast({
        title: 'Formatting Successful',
        description: 'Your email list has been cleaned by AI.'
      })
    } else {
      toast({
        variant: 'destructive',
        title: 'Formatting Failed',
        description: result.error,
      });
    }
  }

  function handleExport() {
    if (results.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'No results to export.',
      });
      return;
    }
    const csvHeader = 'website,email\n';
    const csvRows = results.map(r => `${r.website},${r.email}`).join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvHeader + csvRows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'scraped_emails.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main className="container mx-auto px-4 py-12">
        <header className="text-center mb-16">
            <div className="inline-block mb-8">
              <Logo />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
                Extract <span className="text-primary">Emails</span> Like a Ninja
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                The most advanced email scraping toolkit with AI-powered extraction, verification, and enrichment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="px-8 py-3 font-medium transition-all shadow-lg hover:shadow-primary/30">
                    Start Scraping
                </Button>
            </div>
        </header>

        <section className="mb-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <FeatureCard 
                    icon={<Search className="text-primary w-6 h-6" />}
                    title="Smart Scraping"
                    description="Extract emails from any website with our intelligent algorithms that detect patterns."
                />
                <FeatureCard 
                    icon={<CheckCircle className="text-primary w-6 h-6" />}
                    title="Instant Verification"
                    description="Validate emails in real-time to ensure deliverability and reduce bounce rates."
                />
                <FeatureCard 
                    icon={<Shield className="text-primary w-6 h-6" />}
                    title="GDPR Compliant"
                    description="All data is processed ethically and in compliance with privacy regulations."
                />
            </div>
        </section>

        <section className="bg-card rounded-xl shadow-xl p-6 md:p-8 mb-16 border border-border">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Try Our Email Scraper</h2>
            <Tabs defaultValue="single" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mx-auto max-w-lg">
                <TabsTrigger value="single">Single URL</TabsTrigger>
                <TabsTrigger value="bulk">Bulk URLs</TabsTrigger>
                <TabsTrigger value="txt">Upload .txt</TabsTrigger>
                <TabsTrigger value="excel">Upload Excel</TabsTrigger>
              </TabsList>
              <TabsContent value="single">
                <form onSubmit={handleUrlSubmit} className="flex flex-col md:flex-row gap-4 mt-6">
                    <Input 
                        type="text" 
                        placeholder="Enter URL to scrape (e.g. example.com)" 
                        className="flex-grow px-4 py-3 h-12 text-base focus:ring-2 focus:ring-primary focus:border-transparent"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        disabled={isScraping}
                    />
                    <Button type="submit" size="lg" className="px-6 py-3 font-medium transition-all h-12" disabled={isScraping}>
                        {isScraping && urlInput ? (
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                          <Search className="mr-2 h-5 w-5" />
                        )}
                        Extract Emails
                    </Button>
                </form>
              </TabsContent>
              <TabsContent value="bulk">
                <form onSubmit={handleBulkUrlSubmit} className="flex flex-col gap-4 mt-6">
                  <Textarea
                    placeholder="Enter one URL per line..."
                    className="min-h-48 text-base"
                    value={bulkUrlInput}
                    onChange={(e) => setBulkUrlInput(e.target.value)}
                    disabled={isScraping}
                  />
                  <Button type="submit" size="lg" className="px-6 py-3 font-medium transition-all h-12" disabled={isScraping}>
                    {isScraping && !urlInput ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <List className="mr-2 h-5 w-5" />
                    )}
                    Extract From List
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="txt">
                <Card className="mt-6 border-dashed">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Upload a .txt file</h3>
                    <p className="text-muted-foreground mb-4">Select a text file with one URL per line.</p>
                    <Button size="lg" onClick={() => fileInputRef.current?.click()} disabled={isScraping}>
                      {isScraping && !urlInput && !bulkUrlInput ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileUp className="mr-2 h-5 w-5" />}
                      Choose File
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="excel">
                <Card className="mt-6 border-dashed">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Upload an Excel file</h3>
                    <p className="text-muted-foreground mb-4">Select an .xlsx or .xls file with URLs in the first column.</p>
                    <Button size="lg" onClick={() => fileInputRef.current?.click()} disabled={isScraping}>
                      {isScraping && !urlInput && !bulkUrlInput ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileUp className="mr-2 h-5 w-5" />}
                      Choose File
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange}
              accept=".txt,.xlsx,.xls"
              disabled={isScraping}
            />

            <div className="bg-background/50 dark:bg-gray-700/20 rounded-lg p-4 border border-border mt-8">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-muted-foreground">{isScraping ? 'Scraping...' : `${results.length} emails found`}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleFormat} disabled={isFormatting || isScraping || results.length === 0}>
                        {isFormatting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Format with AI
                      </Button>
                      <Button variant="default" size="sm" onClick={handleExport} disabled={isScraping || results.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Export as CSV
                      </Button>
                    </div>
                </div>
                <div className="bg-card rounded border border-border min-h-40">
                  <ScrollArea className="h-72 w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email Address</TableHead>
                          <TableHead>Source Website</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isScraping ? (
                          Array.from({length: 10}).map((_, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
                              </TableCell>
                              <TableCell>
                                <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : results.length > 0 ? (
                          results.map((result, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{result.email}</TableCell>
                              <TableCell className="text-muted-foreground truncate max-w-xs">{result.website}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={2} className="h-56 text-center text-muted-foreground">
                              Your extracted emails will appear here
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
            </div>
        </section>

        <footer className="text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Webmail Harvester. All Rights Reserved.</p>
        </footer>
    </main>
  );
}
