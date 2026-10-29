import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bot, Loader2, RefreshCw, Sparkles } from 'lucide-react';
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
import type { AiNameSuggestions } from '@/shared/types/api';

interface AiRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
}

export function AiRenameDialog({ open, onOpenChange, groupId }: AiRenameDialogProps) {
  const { t } = useTranslation(['groups', 'common']);
  const queryClient = useQueryClient();
  const [names, setNames] = useState<AiNameSuggestions | null>(null);
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
      setError(t('aiRename.errorFallback'));
    } finally {
      setLoading(false);
    }
  };

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateGroup(groupId, { name }),
    onSuccess: (_, newName) => {
      toast.success(t('aiRename.success', { name: newName }));
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      onOpenChange(false);
      setNames(null);
    },
    onError: (err) => toastError(err),
  });

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setNames(null);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-ai" />
            <span>{t('aiRename.title')}</span>
          </DialogTitle>
          <DialogDescription>{t('aiRename.subtitle')}</DialogDescription>
        </DialogHeader>

        {/* Initial Prompt State */}
        {!names && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-ai/10 text-ai">
              <Bot className="size-7" />
            </div>
            <Button variant="ai" onClick={() => void generate()}>
              <Sparkles className="me-1.5 size-4" />
              {t('aiRename.generate')}
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-ai" />
            <p>{t('aiRename.generating')}</p>
          </div>
        )}

        {/* Error Fallback State */}
        {error && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void generate()}>
              <RefreshCw className="me-1.5 size-4" />
              {t('aiRename.regenerate')}
            </Button>
          </div>
        )}

        {/* Suggestions List */}
        {names && (
          <div className="space-y-4 py-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {t('aiRename.persianNames')}
              </p>
              <div className="flex flex-wrap gap-2">
                {names.persian.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => renameMutation.mutate(name)}
                    disabled={renameMutation.isPending}
                    className={cn(
                      'rounded-full border border-border bg-secondary px-3.5 py-1.5 text-sm font-medium transition-all hover:border-ai hover:bg-ai/10 hover:text-ai focus:outline-none focus:ring-2 focus:ring-ai/50',
                      renameMutation.isPending && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {t('aiRename.englishNames')}
              </p>
              <div className="flex flex-wrap gap-2">
                {names.english.map((name) => (
                  <button
                    key={name}
                    type="button"
                    dir="ltr"
                    onClick={() => renameMutation.mutate(name)}
                    disabled={renameMutation.isPending}
                    className={cn(
                      'rounded-full border border-border bg-secondary px-3.5 py-1.5 text-sm font-medium transition-all hover:border-ai hover:bg-ai/10 hover:text-ai focus:outline-none focus:ring-2 focus:ring-ai/50',
                      renameMutation.isPending && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{t('aiRename.clickToApply')}</p>
          </div>
        )}

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            {t('common:actions.close')}
          </Button>
          {names && !loading && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void generate()}
              disabled={renameMutation.isPending}
            >
              <RefreshCw className="me-1.5 size-4" />
              {t('aiRename.regenerate')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
