import { Mail } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-primary/20 rounded-lg">
        <Mail className="h-6 w-6 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        scraper by sami 😁
      </h1>
    </div>
  );
}
