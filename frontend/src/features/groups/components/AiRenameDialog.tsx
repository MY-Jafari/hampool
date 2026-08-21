import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { suggestGroupName, updateGroup } from '@/features/groups/api';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { toastError } from '@/shared/lib/errors';
import { cn } from '@/shared/lib/utils';

interface AiRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
}

export function AiRenameDialog({ open, onOpenChange, groupId }: AiRenameDialogProps) {
  const queryClient = useQueryClient();
  const [names, setNames] = useState<{ persian: string[]; english: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setNames(null);
    try {
      const result = await suggestGroupName(groupId);
      setNames(result);
    } catch {
      setError('AI در دسترس نیست؛ بعداً تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateGroup(groupId, { name }),
    onSuccess: () => {
      toast.success('نام گروه با موفقیت تغییر کرد ✨');
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      onOpenChange(false);
      setNames(null);
    },
    onError: (err) => toastError(err),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setNames(null);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-ai" />
            پیشنهاد نام با هوش مصنوعی
          </DialogTitle>
          <DialogDescription>
            پیشنهادها بر اساس هزینه‌های اخیر گروه با Gemini تولید می‌شوند. روی یک نام کلیک کنید تا اعمال شود.
          </DialogDescription>
        </DialogHeader>

        {!names && !loading && !error && (
          <div className="py-4 text-center">
            <Button variant="ai" onClick={() => void generate()}>
              <Bot className="size-4" />
              دریافت پیشنهاد نام
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-ai" />
            در حال تولید پیشنهادها با Gemini...
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void generate()}>
              <RefreshCw className="size-4" />
              تلاش مجدد
            </Button>
          </div>
        )}

        {names && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">نام‌های فارسی</p>
              <div className="flex flex-wrap gap-2">
                {names.persian.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => renameMutation.mutate(name)}
                    className={cn(
                      'rounded-full border border-border bg-secondary px-3 py-1.5 text-sm transition-colors hover:border-ai hover:text-ai',
                      renameMutation.isPending && 'opacity-60',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">English names</p>
              <div className="flex flex-wrap gap-2">
                {names.english.map((name) => (
                  <button
                    key={name}
                    type="button"
                    dir="ltr"
                    onClick={() => renameMutation.mutate(name)}
                    className={cn(
                      'rounded-full border border-border bg-secondary px-3 py-1.5 text-sm transition-colors hover:border-ai hover:text-ai',
                      renameMutation.isPending && 'opacity-60',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              اگر پیشنهادها را نمی‌پسندید، دوباره تولید کنید.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
          {names && !loading && (
            <Button variant="outline" onClick={() => void generate()}>
              <RefreshCw className="size-4" />
              تولید مجدد
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
