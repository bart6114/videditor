import type { DriveStep } from 'driver.js';

export const PROJECT_DETAIL_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Welcome to Your Project!',
      description:
        "This is your workspace for creating short-form content. Let's get started.",
      side: 'over',
      align: 'center',
    },
  },
  {
    element: '[data-tour="upload-asset-button"]',
    popover: {
      title: 'Upload a Video',
      description:
        'Start by uploading a long-form video. We support MP4 and MOV files up to 2GB.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'What Happens Next',
      description:
        "After upload, we'll automatically transcribe your video. Then you can use AI to find the best moments and generate engaging shorts for social media.",
      side: 'over',
      align: 'center',
    },
  },
  {
    popover: {
      title: "You're Ready!",
      description:
        'Click "Upload Asset" to add your first video and start creating shorts.',
      side: 'over',
      align: 'center',
    },
  },
];

export const PROJECT_DETAIL_TARGETS = {
  UPLOAD_ASSET_BUTTON: 'upload-asset-button',
} as const;
