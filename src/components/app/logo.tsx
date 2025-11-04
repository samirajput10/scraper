import { Mail } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="p-3 bg-primary/20 rounded-xl">
        <Mail className="h-7 w-7 text-primary" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Webmail Harvester
      </h1>
    </div>
  );
}
