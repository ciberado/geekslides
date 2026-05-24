/**
 * GeekSlides v2 — Video processor.
 *
 * Wraps <video> elements in <geek-video> components for timestamp control.
 */

import type { Processor } from '../sdk/types.ts';

export const videoProcessor: Processor = (slideElement: HTMLElement): void => {
  const videos = slideElement.querySelectorAll('video');
  if (videos.length === 0) return;

  const isCover = slideElement.classList.contains('mod-media-cover');

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

    // On cover slides, hoist out of wrapping <p> so that absolute positioning
    // resolves against the slide section rather than a zero-height paragraph.
    if (isCover) {
      geekVideo.setAttribute('cover', '');
      geekVideo.style.zIndex = '0';
      const parent = geekVideo.parentElement;
      if (parent && parent.tagName === 'P' && parent.children.length === 1 && parent.textContent.trim() === '') {
        parent.replaceWith(geekVideo);
      }
    }
  });
};
