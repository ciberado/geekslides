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
    this.addKeyboardEvent(33, 'previousSlide'); // page up
    this.addKeyboardEvent(72, 'previousSlide'); // h
    this.addKeyboardEvent(34, 'nextSlide'); // page down
    this.addKeyboardEvent(39, 'nextSlide'); // right
    this.addKeyboardEvent(76, 'nextSlide'); // l
    this.addKeyboardEvent(83, 'toggleSpeakerView'); // s
    this.addKeyboardEvent(65, 'changeAspectRatio'); // a
    this.addKeyboardEvent(67, 'cloneWindow'); // c

    this.addKeyboardEvent(69, 'toggleEmission'); // e

    this.addKeyboardEvent(79, 'openSlides'); // o
    this.addKeyboardEvent(87, 'toggleGlobalWhiteboard'); // w
    this.addKeyboardEvent(74, 'joinRoom'); // j

    // Slide swipe handling
    // TODO: Add chrome support
    this.slideshow.slideshowElem.addEventListener('touchstart', evt => this.#swipeStart(evt), true);
    this.slideshow.slideshowElem.addEventListener('touchend', evt => this.#swipeEnd(evt), true);

  }

  #swipeStart(evt) {
      // In new versions of Firefox, force is set to > 0 for pen events
      if (evt.changedTouches[0].force > 0) {
        this.swipeStartX = -1;
        this.swipeStartY = -1;    
      } else {
        this.swipeStartX = evt.changedTouches[0].screenX;
        this.swipeStartY = evt.changedTouches[0].screenY;
      }
  }

  #swipeEnd(evt) {
    // In new versions of Firefox, force is set to > 0 for pen events
    if (this.swipeStartX === -1 || evt.changedTouches[0].force > 0) {
      return;
    }
    const swipeWidth = this.swipeStartX - evt.changedTouches[0].screenX;
    const swipeHeight = Math.abs(this.swipeStartY - evt.changedTouches[0].screenY);

    if (swipeWidth > 150) {
      this.#dispatchEvent('nextSlide');
    }
    if (swipeWidth < -150) {
      this.#dispatchEvent('previousSlide');
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