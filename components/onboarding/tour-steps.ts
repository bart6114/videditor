import type { DriveStep } from 'driver.js';

export const TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Welcome to VidEditor!',
      description:
        "Let's take a quick tour. We'll show you how to upload videos, generate shorts, and get the most out of your content.",
      side: 'over',
      align: 'center',
    },
  },
  {
    element: '[data-tour="video-upload"]',
    popover: {
      title: 'Upload Your Video',
      description:
        'Start by uploading a video. We support MP4 and MOV files up to 2GB. Once uploaded, we will automatically transcribe it.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: 'Navigation',
      description:
        'Use the sidebar to navigate between your projects, calendar, preferences, and billing settings.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="projects-list"]',
    popover: {
      title: 'Your Projects',
      description:
        'All your uploaded videos appear here. Click any project to view its transcription, then use AI to automatically generate engaging shorts from the best moments.',
      side: 'top',
      align: 'center',
    },
  },
  {
    popover: {
      title: "You're All Set!",
      description:
        "You're ready to start creating. Upload your first video to begin generating engaging short-form content.",
      side: 'over',
      align: 'center',
    },
  },
];

export const TOUR_TARGETS = {
  VIDEO_UPLOAD: 'video-upload',
  SIDEBAR: 'sidebar',
  PROJECTS_LIST: 'projects-list',
} as const;
