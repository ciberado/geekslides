import SwipeListener from 'swipe-listener';

/** 
 * A simple controller that converts keypresses in events, fired at `document` level.
 * 
 * Events:
 * 
 * previousSlide (up arrow, left arrow)
 * nextSlide (down arrow, right arrow)
 * toggleSpeakerView (s)
 * changeAspectRatio (a)
 * cloneWindow (c)
 * toggleEmission (e)
 * 
 * @todo blank event (for screen cleaning)
 * @todo move key assignment to particular controllers
 * 
 */
class UserInputDevices {
  
  slideshow;
  keyboardEventNames = {};
  lockSwipe;

  constructor(slideshow) {
    this.slideshow = slideshow;
    window.addEventListener('keydown', (keyEvent) => {
      // avoid intercepting while introducing text
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) === true) {
        return;
      }
      this.handleKeyEvent(keyEvent);
    });

    this.addKeyboardEvent(37, 'previousSlide'); // left
    this.addKeyboardEvent(72, 'previousSlide'); // h
    this.addKeyboardEvent(39, 'nextSlide'); // right
    this.addKeyboardEvent(76, 'nextSlide'); // l
    this.addKeyboardEvent(83, 'toggleSpeakerView'); // s
    this.addKeyboardEvent(65, 'changeAspectRatio'); // a
    this.addKeyboardEvent(67, 'cloneWindow'); // c

    this.addKeyboardEvent(69, 'toggleEmission'); // e

    this.addKeyboardEvent(79, 'openSlides'); // o
    this.addKeyboardEvent(87, 'toggleGlobalWhiteboard'); // w


    // Slide swipe handling
    SwipeListener(this.slideshow.slideshowElem, {mouse : false});
    this.slideshow.slideshowElem.addEventListener('touchstart', evt => this.#blockSwipeWithPencil(evt), true);
    this.slideshow.slideshowElem.addEventListener('touchend', evt => this.#blockSwipeWithPencil(evt), true);

    this.slideshow.slideshowElem.addEventListener('swipe', (evt) => {
      if (this.lockSwipe === true) return;
      
      if (evt.detail.directions.left) {
        this.#dispatchEvent('nextSlide');
      } else if (evt.detail.directions.right) {
        this.#dispatchEvent('previousSlide');
      }
    });
  }

  #blockSwipeWithPencil(evt) {
    console.log(evt)
    if (evt.type === 'touchstart' || evt.type === 'touchend') {
      // Apparently, radiusX is really BIG if generated with the surface pencil instead of fingers
      if (evt.changedTouches[0].radiusX > 1000) {
        this.lockSwipe = true;
      } else {
        this.lockSwipe = false;
      }
    }
  }

  addKeyboardEvent(keyCode, eventName) {
    if (this.keyboardEventNames[keyCode] === undefined) {
      this.keyboardEventNames[keyCode] = [];
    }
    this.keyboardEventNames[keyCode].push(eventName);
  }

  #dispatchEvent(eventName) {
    let event = new CustomEvent(eventName);
    document.dispatchEvent(event);
  }

  handleKeyEvent(keyEvent) {
    const eventNames = this.keyboardEventNames[keyEvent.keyCode];
    if (eventNames === undefined) return;

    eventNames.forEach(n => this.#dispatchEvent(n));
    keyEvent.preventDefault();
  }
}

export { UserInputDevices as UserInputDevices };