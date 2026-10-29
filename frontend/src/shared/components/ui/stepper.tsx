import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface StepItem {
  id: string | number;
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number; // 0-indexed
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, className }) => {
  return (
    <div className={cn('flex items-center justify-between w-full', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className={cn(
                  'size-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-primary/10 text-primary ring-4 ring-primary/20',
                  !isCompleted && !isCurrent && 'border-border bg-muted/40 text-muted-foreground',
                )}
              >
                {isCompleted ? <Check className="size-4 stroke-[3]" /> : <span>{index + 1}</span>}
              </div>
              <span
                className={cn(
                  'text-xs font-medium text-center truncate max-w-[100px]',
                  isCurrent ? 'text-foreground font-semibold' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 -mt-5 transition-colors',
                  index < currentStep ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
