import { useState } from 'react';
import { useOnboardingSafe } from '@/contexts/OnboardingContext';
import { Button } from '@/components/ui/button';
import { Bug, Play, RotateCcw, X } from 'lucide-react';

export function DevOnboardingTools() {
  const [isOpen, setIsOpen] = useState(false);
  const onboarding = useOnboardingSafe();

  if (process.env.NODE_ENV !== 'development' || !onboarding) {
    return null;
  }

  const { showTour, tourCompleted, startTour, resetTourForDev } = onboarding;

  return (
    <div className="fixed bottom-4 left-4 z-[9999]">
      {isOpen ? (
        <div className="bg-card border border-border rounded-lg shadow-soft-lg p-4 space-y-3 min-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              <Bug className="w-4 h-4 text-warning" />
              Onboarding Dev Tools
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Tour active: {showTour ? 'Yes' : 'No'}</p>
            <p>Completed: {tourCompleted ? 'Yes' : 'No'}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                resetTourForDev();
                setIsOpen(false);
              }}
              className="w-full justify-start"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset & Restart Tour
            </Button>

            {!showTour && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  startTour();
                  setIsOpen(false);
                }}
                className="w-full justify-start"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Tour
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground/70 pt-2 border-t border-border">
            Tip: Add ?tour=reset to URL
          </p>
        </div>
      ) : (
        <Button
          size="icon"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="rounded-full shadow-soft bg-card hover:bg-secondary"
          title="Onboarding Dev Tools"
        >
          <Bug className="w-4 h-4 text-warning" />
        </Button>
      )}
    </div>
  );
}
