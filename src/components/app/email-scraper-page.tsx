'use client';

import { useState, useRef } from 'react';
import { FileUp, Download, Wand2, Loader2, FileText, X, Search, FileSpreadsheet } from 'lucide-react';
import { formatEmailsAction, scrapeEmailsAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Logo } from './logo';
import * as XLSX from 'xlsx';


type ScrapedResult = {
  website: string;
  email: string;
};

export default function EmailScraperPage() {
  const [results, setResults] = useState<ScrapedResult[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const resetState = () => {
    setResults([]);
    setFileName(null);
    setUrlInput('');
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }
  
  const handleFileSelect = (fileType: 'text' | 'excel') => {
    if(fileInputRef.current) {
        fileInputRef.current.accept = fileType === 'text' ? '.txt' : '.xlsx, .xls';
        fileInputRef.current.click();
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'text/plain' || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        resetState();
        setFileName(file.name);
        handleScrape(file);
      } else {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload a .txt or Excel file.',
        });
      }
    }
  };

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
    resetState();
    let urlToScrape = urlInput;
    if (!urlToScrape.startsWith('http://') && !urlToScrape.startsWith('https://')) {
        urlToScrape = `https://${urlToScrape}`;
    }
    handleScrape(urlToScrape);
  }

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
          resetState();
        }
    } catch (error) {
        setIsScraping(false);
        toast({
            variant: 'destructive',
            title: 'Error processing file',
            description: typeof error === 'string' ? error : 'An unexpected error occurred.',
        });
        resetState();
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
    const csvContent = 'data:text/csv;charset=utf-8,' + csvHeader + csvRows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'scraped_emails.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleRemoveFile = () => {
    setFileName(null);
    setResults([]);
    if(fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const hasResults = results.length > 0 || isScraping;

  return (
    <main className="container mx-auto py-8 px-4 md:px-0">
      <header className="text-center mb-10">
        <div className="inline-block">
            <Logo />
        </div>
        <p className="mt-2 text-lg text-muted-foreground">
          Harvest emails from a single URL or a list of websites in a .txt file.
        </p>
      </header>
      
      <Card className="w-full max-w-2xl mx-auto shadow-lg transition-all duration-500" style={{borderBottomRightRadius: hasResults ? 0 : 'var(--radius)', borderBottomLeftRadius: hasResults ? 0 : 'var(--radius)'}}>
        <Tabs defaultValue="file" className="w-full">
            <CardHeader>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="file">File Upload</TabsTrigger>
                    <TabsTrigger value="url">Single URL</TabsTrigger>
                </TabsList>
            </CardHeader>

            <TabsContent value="file">
                <CardHeader className='pt-0'>
                    <CardTitle>Website List</CardTitle>
                    <CardDescription>Upload a .txt or Excel file containing website URLs.</CardDescription>
                </CardHeader>
                <CardContent>
                <Input
                    id="file-upload"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isScraping}
                />
                {!fileName && (
                    <div className="flex gap-2">
                        <Button onClick={() => handleFileSelect('text')} className="w-full" disabled={isScraping}>
                        {isScraping && !urlInput ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileUp className="mr-2 h-4 w-4" />
                        )}
                        {isScraping && !urlInput ? 'Processing...' : 'Upload .txt'}
                        </Button>
                        <Button onClick={() => handleFileSelect('excel')} className="w-full" disabled={isScraping}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Upload Excel
                        </Button>
                    </div>
                )}

                {fileName && (
                    <div className="flex items-center justify-between p-3 rounded-md border bg-muted/50">
                        <div className='flex items-center gap-2 truncate'>
                            <FileText className="h-5 w-5 shrink-0" />
                            <span className="font-medium truncate">{fileName}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleRemoveFile} disabled={isScraping} className="h-6 w-6 shrink-0">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                </CardContent>
            </TabsContent>

            <TabsContent value="url">
                 <CardHeader className='pt-0'>
                    <CardTitle>Direct Input</CardTitle>
                    <CardDescription>Enter a single website URL to scrape for emails.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUrlSubmit} className="flex gap-2">
                        <Input 
                            type="url"
                            placeholder="example.com"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            disabled={isScraping}
                        />
                        <Button type="submit" disabled={isScraping}>
                            {isScraping && urlInput ? (
                               <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="mr-2 h-4 w-4" />
                            )}
                            Scrape
                        </Button>
                    </form>
                </CardContent>
            </TabsContent>

        </Tabs>
      </Card>
      
      {hasResults && (
        <Card className="w-full max-w-2xl mx-auto shadow-lg" style={{borderTopRightRadius: 0, borderTopLeftRadius: 0}}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle>Results</CardTitle>
                    <CardDescription>
                      {isScraping ? 'Searching for emails...' : `${results.length} emails found.`}
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleFormat} disabled={isFormatting || isScraping || results.length === 0}>
                        {isFormatting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        Format with AI
                    </Button>
                    <Button onClick={handleExport} disabled={isScraping || results.length === 0}>
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
                      <TableCell colSpan={2} className="text-center text-muted-foreground h-24">
                        No emails found from the provided source.
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
