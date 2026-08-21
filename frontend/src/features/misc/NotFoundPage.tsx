import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-secondary">
        <Compass className="size-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold">۴۰۴ — صفحه پیدا نشد</h1>
      <p className="mt-2 mb-6 max-w-sm text-sm text-muted-foreground">
        صفحه‌ای که دنبالش بودید وجود ندارد یا حذف شده است.
      </p>
      <Button asChild>
        <Link to="/">بازگشت به داشبورد</Link>
      </Button>
    </div>
  );
}
