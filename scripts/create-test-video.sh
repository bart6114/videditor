#!/bin/bash

# Create a simple test video using ffmpeg
# This creates a 10-second video with a black screen and audio tone

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/test-video.mp4"

if command -v ffmpeg &> /dev/null; then
  echo "Creating test video with ffmpeg..."
  ffmpeg -f lavfi -i color=c=black:s=1280x720:d=10 \
         -f lavfi -i sine=frequency=1000:duration=10 \
         -c:v libx264 -c:a aac -shortest \
         -y "$OUTPUT_FILE"

  if [ -f "$OUTPUT_FILE" ]; then
    echo "✓ Test video created: $OUTPUT_FILE"
    ls -lh "$OUTPUT_FILE"
  else
    echo "✗ Failed to create test video"
    exit 1
  fi
else
  echo "ffmpeg not found. Please install ffmpeg or manually create a test video at:"
  echo "  $OUTPUT_FILE"
  echo ""
  echo "You can download a sample video or create one with:"
  echo "  brew install ffmpeg  # on macOS"
  echo "  apt-get install ffmpeg  # on Ubuntu/Debian"
  exit 1
fi
