/**
 * GeekSlides v2 — Video processor.
 *
 * Wraps <video> elements in <geek-video> components for timestamp control.
 */

import type { Processor } from '../types.ts';

export const videoProcessor: Processor = (slideElement: HTMLElement): void => {
  const videos = slideElement.querySelectorAll('video');
  if (videos.length === 0) return;

  videos.forEach((video) => {
    const geekVideo = document.createElement('geek-video');

    // Transfer data-timestamps attribute
    const timestamps = video.getAttribute('data-timestamps');
    if (timestamps) {
      geekVideo.setAttribute('data-timestamps', timestamps);
    }

    // Move the video inside the component
    geekVideo.appendChild(video.cloneNode(true));
    video.replaceWith(geekVideo);
  });
};
