import videoCSS from './videoslide.css';

/**
 * Manages the playback of a video element, revealing each section of the track
 * each time a new partial is invoked. This way it is possible to create a video
 * recording any kind of action or animation and play step by step, revealing
 * content just like with any other type of partial.
 * 
 * The timestamp marks must be present as *MM:ss* on each list items of the partial
 * list, like presented in the following example:
 * 
 * ```
 *   <ul>
 *     <li>00:00 Movie title</li>
 *     <li>00:05 River scene</li>
 *     <li>00:15 Main character introduction</li>
 *   </ul>
 * ```
 * 
 */
class VideoSlideController {
  
  /** The slide element (usually, a `section`) managed by this controller. */
  slideElem;
  /** The video element placed inside the slide. */
  videoElem;
  /** An array of `integers` with the seconds at which the playback should be paused */
  marks;
  /** The current part of the video being played (current partial) */
  currentMarkIndex;

  constructor(slideElem) {
    this.slideElem = slideElem;
    this.videoElem = this.slideElem.querySelector('video');
    this.marks = null;
    this.currentMarkIndex = 0;
    this.buildMarks();
    document.addEventListener('partialShown', (evt) => this.startNextMark(evt), true);
    this.videoElem.addEventListener("timeupdate", (evt) => this.stopAtNextMark(evt), true);
  }

  buildMarks() {
    function textToSeconds(text) {
      const re = /([0-9]?[0-9]).+([0-5][0-9]).+/ig;
      const parts = re.exec(text);
      return parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }

    this.marks = 
      [...this.slideElem.querySelectorAll('li')]
      .map(e=>textToSeconds(e.innerText));
  }

  startNextMark(evt) {
    // not the managed slide
    if (evt.detail.currentSlideElem !== this.slideElem) return;
    // no more marks
    if (evt.detail.currentMarkIndex >= this.marks.length) return;

    this.currentMarkIndex = evt.detail.lastPartialShownIndex-1;
    this.videoElem.currentTime = this.marks[this.currentMarkIndex];
    this.videoElem.play();
  }

  stopAtNextMark(evt) {
    const nextMarkTime = this.marks[this.currentMarkIndex+1];
    if (this.videoElem.currentTime >= nextMarkTime) {
      this.videoElem.pause();
    }
  }
}

export default VideoSlideController;