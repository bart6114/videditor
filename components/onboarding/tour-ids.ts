export const TOUR_IDS = {
  PROJECTS_OVERVIEW: 'projects_overview',
  PROJECT_DETAIL: 'project_detail',
} as const;

export type TourId = (typeof TOUR_IDS)[keyof typeof TOUR_IDS];
