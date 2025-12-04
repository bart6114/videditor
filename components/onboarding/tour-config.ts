import type { DriveStep } from 'driver.js';
import { PROJECTS_OVERVIEW_STEPS } from './steps/projects-overview';
import { PROJECT_DETAIL_STEPS } from './steps/project-detail';
import { TOUR_IDS } from './tour-ids';

export interface TourConfig {
  id: string;
  steps: DriveStep[];
  doneBtnText?: string;
}

export const TOUR_CONFIGS: Record<string, TourConfig> = {
  [TOUR_IDS.PROJECTS_OVERVIEW]: {
    id: TOUR_IDS.PROJECTS_OVERVIEW,
    steps: PROJECTS_OVERVIEW_STEPS,
    doneBtnText: 'Get Started',
  },
  [TOUR_IDS.PROJECT_DETAIL]: {
    id: TOUR_IDS.PROJECT_DETAIL,
    steps: PROJECT_DETAIL_STEPS,
    doneBtnText: 'Got it!',
  },
};
