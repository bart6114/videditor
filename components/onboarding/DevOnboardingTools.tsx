import { useState } from 'react';
import { useOnboardingSafe } from '@/contexts/OnboardingContext';
import { Button } from '@/components/ui/button';
import { Bug, Play, RotateCcw, X, Check } from 'lucide-react';
import { TOUR_IDS, TourId } from './tour-ids';

const TOUR_LABELS: Record<TourId, string> = {
  [TOUR_IDS.PROJECTS_OVERVIEW]: 'Projects Overview',
  [TOUR_IDS.PROJECT_DETAIL]: 'Project Detail',
};

export function DevOnboardingTools() {
  const [isOpen, setIsOpen] = useState(false);
  const onboarding = useOnboardingSafe();

  if (process.env.NODE_ENV !== 'development' || !onboarding) {
    return null;
  }

  const { completedTours, activeTourId, startTour, resetTourForDev } = onboarding;

  return (
    <div className="fixed bottom-4 left-4 z-[9999]">
      {isOpen ? (
        <div className="bg-card border border-border rounded-lg shadow-soft-lg p-4 space-y-3 min-w-[240px]">
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

          <div className="text-xs text-muted-foreground space-y-2">
            <p>Active tour: {activeTourId || 'None'}</p>
            <div className="space-y-1">
              {Object.entries(TOUR_IDS).map(([key, id]) => (
                <div key={id} className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    {completedTours[id] ? (
                      <Check className="w-3 h-3 text-success" />
                    ) : (
                      <span className="w-3 h-3" />
                    )}
                    {TOUR_LABELS[id as TourId]}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        resetTourForDev(id);
                        setIsOpen(false);
                      }}
                      className="h-6 px-2 text-xs"
                      title="Reset & Start"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                    {!activeTourId && !completedTours[id] && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          startTour(id);
                          setIsOpen(false);
                        }}
                        className="h-6 px-2 text-xs"
                        title="Start"
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/70 pt-2 border-t border-border">
            Tip: ?tour=projects_overview or ?tour=project_detail
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
