import type { DriveStep } from 'driver.js';

export const PROJECT_DETAIL_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Welcome to Your Project',
      description:
        "This is where the magic happens. Let's walk through how to generate shorts from your video.",
      side: 'over',
      align: 'center',
    },
  },
  {
    element: '[data-tour="video-player"]',
    popover: {
      title: 'Video Preview',
      description:
        'Watch your uploaded video here. Click anywhere on the thumbnail to start playback.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="transcription-status"]',
    popover: {
      title: 'Transcription',
      description:
        'Once your video is transcribed, click here to view and search through the full transcript.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '[data-tour="generate-shorts"]',
    popover: {
      title: 'Generate Shorts',
      description:
        'Configure how many shorts you want, their length, and any custom instructions. Then click "Generate" to let AI find the best moments.',
      side: 'left',
      align: 'start',
    },
  },
  {
    element: '[data-tour="social-platforms"]',
    popover: {
      title: 'Social Platforms',
      description:
        'Select which platforms you want to publish to. We\'ll generate optimized titles and captions for each one.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '[data-tour="shorts-table"]',
    popover: {
      title: 'Your Generated Shorts',
      description:
        'All your shorts appear here. Click any row to preview, download, or edit the social content.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '[data-tour="schedule-button"]',
    popover: {
      title: 'Schedule & Publish',
      description:
        'Select shorts and schedule them to publish directly to YouTube. You can set dates and times for each one.',
      side: 'bottom',
      align: 'center',
    },
  },
];

export const PROJECT_DETAIL_TARGETS = {
  VIDEO_PLAYER: 'video-player',
  TRANSCRIPTION_STATUS: 'transcription-status',
  GENERATE_SHORTS: 'generate-shorts',
  SOCIAL_PLATFORMS: 'social-platforms',
  SHORTS_TABLE: 'shorts-table',
  SCHEDULE_BUTTON: 'schedule-button',
} as const;
