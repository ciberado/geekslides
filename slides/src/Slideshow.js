/** 
 * 
 * Transforms a container element with a series of sections into a slideshow.
 * It **does not** react to keys or events, it just provides the functinoallity through an API.
 * 
 * The container element can be any type of html element. The slides must be `section`s.
 * 
 * Three css classes are used to bring slides to live: `.active` for the slide currently shown,
 * `.prev` for the precedent slide and `.next` for the next one. Those classes are being used 
 * mainly to animate the transitions between slides.
 * 
 * Slides are centered and scaled to keep the same aspect no matter what is the underlaying 
 * screen resolution, using `transform` property.
 * 
 * Two aspect ratios are supported, 4:3 and 16:9. The base resolution of the slides (in px) are
 * 960x720 and 1920x1080, but they are scaled up and down to fill the whole available space.
 * 
 * Partial elements are supported: any slide with `.partial` class on it will require several
 * `.gotoNextSlide()` invocations as each one will reveal a previously hidden element until all
 * of them become visible.
 * 
 * @see minislides.css 
 * 
 */
class Slideshow {

  /**
   * Initializes a new slideshow.
   * 
   * @param {HTMLElement} slideshowElem the parent container for the slideshow 
   * @param {Object} options
   * @param {string} options.aspectRatio the initial aspect ratio. Valid values are `4:3` and `16:9`
   */
  constructor(slideshowElem, options = {}) {
    /** @property {HTMLElement} slideShowElem contains the container element for the slideshow */
    this.slideshowElem = slideshowElem;    
    /** @property {string} aspectRatio saves the current aspect ratio */
    this.aspectRation = null;

    this.refreshSlideshowContent();
    this.setAspectRatio(options.aspectRatio);

    window.addEventListener('resize',() => this.updateSlidesScale());
    this.updateSlidesScale();  
  }

  /**
   * Proccesses all slides under the container element adding the necessary
   * listeners and classes.
   */
  refreshSlideshowContent() {
    [...this.slideshowElem.querySelectorAll('section')].forEach( 
      e => e.addEventListener('transitionend', (event) => this.observeSlideTransitions(event)));

    const activeSlide = this.slideshowElem.querySelector('.active');
    if (activeSlide === null) {
      this.slideshowElem.querySelector('section')?.classList.add('active');
    }

  }

  /**
   * @typedef {Object} Size
   */

  /**
   * 
   * Calculates the resolution of the viewport, based on `this.aspectRation`. Despite the
   * name of the property, it admits two formats: an actual ration (if contains a ':', like
   * for example `4:3`), or a explicit resolution (if contains a 'x', like in `1920x1080`).
   * 
   * Available base resolution in `px` units:
   * 
   * * 4:3 -> 960x720
   * * 16:9 -> 1920x1080
   * 
   * @returns {Size} the desired px resolution of each `slide` element based on the value of
   * `this.aspectRatio`.
   */
  calcSlideWidthForCurrentAspectRatio() {
    /** @property {number} w contains the width */
    let w;
    /** @property {number} y contains the height */
    let h;

    if (this.aspectRatio.includes('x') === true) {
      const parts = this.aspectRatio.split('x');
      w = parseInt(parts[0]);
      h = parseInt(parts[1]);
    } else switch (this.aspectRatio) {
      case '1:1':
        w = 1080;
        h = 1080;
        break;
      case '4:3' : 
        w = 960;
        h = 720;
        break;
      case '16:9' : 
      default :
        w = 1920;
        h = 1080;
    }

    return {w, h};
  }

  /**
   * Every slide has a fixed width and height based on the selected aspect ratio, as described in 
   * {@link Slideshow#calcSlideWidthForCurrentAspectRatio}. That area must be scaled to fit correctly in the
   * actual container element. This method is the one performing this task, by calculating the correct
   * factor (depending of what limit is smaller, the width or the height of the container size) and
   * then modifiying the corresponding classes (`.slidedeck section` and `.slidedeck.speaker section`).
   * 
   * Currently, the factor is appied to the `transform` property of those selectors.
   */
  updateSlidesScale() {
    const slideSize = this.calcSlideWidthForCurrentAspectRatio();
    const sx =  (this.slideshowElem.clientWidth / slideSize.w);
    const sy =  (this.slideshowElem.clientHeight / slideSize.h);

    let factor;
    if (this.slideshowElem.clientHeight < slideSize.h * sx) {
      factor = sy;
    } else {
      factor = sx;
    }

    const css = [...document.styleSheets].filter(s=>s.href && s.href.indexOf('index') !== -1)[0];
    const slideRule = [...css.cssRules].filter(r => r.selectorText === '.slidedeck section')[0];
    slideRule.style.transform = `translate(-50%, -50%) scale(${factor})`;
    const slideSpeakerRule = [...css.cssRules].filter(r => r.selectorText === '.slidedeck.speaker section')[0];
    slideSpeakerRule.style.transform = `scale(${factor/2})`;
  }

  /**
   * 
   * Updates the resolution of the viewport, and sets a class in the slideshow element
   * reflecting it.
   * 
   * @param {string} aspectRatio (16:9 or 4:3, currently)
   */
  setAspectRatio(aspectRatio = '16:9') {
    this.aspectRatio = aspectRatio;

    const classes = [...this.slideshowElem.classList];
    classes.forEach(c => {
      if (c.startsWith('resolution-') === true) {
        this.slideshowElem.classList.remove(c); 
      }
    });
    this.slideshowElem.classList.add('resolution-' + aspectRatio);

    // gets the stylesheet named minislides.css where the slides are formated
    const css = [...document.styleSheets].filter(s=>s.href && s.href.indexOf('index') !== -1)[0];
    // finds the rule corresponding to all slide
    const slideRule = [...css.cssRules].filter(r => r.selectorText === '.slidedeck section')[0];
    const {w, h} = this.calcSlideWidthForCurrentAspectRatio();
    slideRule.style.width = w + 'px';
    slideRule.style.height = h + 'px';

    // redraw the slides to show the new aspect ratio
    this.updateSlidesScale();
  }

  /**
   * @typedef {Object} Partials
   * @property {HTMLElement[]} shown HTMLElements containing partials already shown
   * @property {HTMLElement[]} unshown HTMLElements with the remaining (hidden) partials
   */  

  /**
   * Partials are list items that stops the flow of the slides until they become visible.
   * 
   * @returns {Partials} of the current slide.
   */
  getCurrentSlidePartials() {
    const shown = [];
    const unshown = [];

    const currentSlide = this.slideshowElem.querySelector('.active');
    if (currentSlide === null) return;
    
    if (currentSlide.classList.contains('partial') === true) {
      // list items inside .slide-notes elements are considered speaker notes
      // and should not stop slide flow.
      let listItems = 
        [...currentSlide.querySelectorAll('ul li, ol li')];
      let speakerNotesItems = 
        [...currentSlide.querySelectorAll('.slide-notes ul li, .slide-notes ol li')];
      listItems
        .filter(e => speakerNotesItems.indexOf(e) === -1)
        .forEach(e => e.classList.contains('partial-shown') ? shown.push([e]) : unshown.push([e]));

      let tableItem = currentSlide.querySelector('table');
      if (tableItem !== null) {
        const trElems = [...tableItem.querySelectorAll('tbody tr')];
        trElems.forEach(tr => tr.classList.contains('partial-shown') ? shown.push([tr]) : unshown.push([tr]));
      }
    }

    return { shown, unshown };
  }

  /**
   * Advances the slidedeck, showing next partial (if required) or
   * moving the `.active` class from the current slide element to its 
   * following sibling.
   * 
   * If the presentation is in *book-mode*, ensures the current
   * slide appears in the viewport.
   * 
   * @fires slideShownEvent
   * @fires partialShownEvent
   */
  gotoNextSlide() {
    // get the current slide element
    const currentSlide = this.slideshowElem.querySelector('.active');
    if (currentSlide === null) return;

    // get the current slide partials (shown and unshown)
    const partials = this.getCurrentSlidePartials();
    if (partials.unshown.length > 0) {
      // if there are still available partials, show the first one and
      // fire the corresponding event

      partials.unshown[0].forEach(e=>e.classList.add('partial-shown'));
      this.firePartialShown();
      return;  
    }

    let newActiveSlide = document.querySelector('.active + section');
     
    while ((newActiveSlide !== null) && newActiveSlide.classList.contains('hidden') === true) {
      newActiveSlide = newActiveSlide.nextElementSibling;
    }

    if (newActiveSlide === null) {
      // if it is the last slide, we are good
      return;
    }

    currentSlide.classList.remove('active');
    currentSlide.classList.add('prev');
    newActiveSlide.classList.remove('next');
    newActiveSlide.classList.remove('prev');
    newActiveSlide.classList.add('active');  

    // If wear in book view mode, syncronize presented slide
    if (this.slideshowElem.classList.contains('slidedeck-book') === true) {
      document.querySelector('.active').scrollIntoView({ behavior : 'smooth' });
    }

    this.fireSlideShown();
  }

  /**
   * Shows the previous slide, it exists. **Does not** hide partials.
   * 
   * If the presentation is in *book-mode*, ensures the current
   * slide appears in the viewport.
   * 
   * @fires slideShown
   */
  gotoPreviousSlide() {
    const currentSlide = this.slideshowElem.querySelector('.active');
    if (currentSlide === null) return;

    let newActiveSlide = currentSlide.previousElementSibling;

    while ((newActiveSlide !== null) && newActiveSlide.classList.contains('hidden') === true) {
      newActiveSlide = newActiveSlide.previousElementSibling;
    }

    if (newActiveSlide === null) {
      return;
    }
    currentSlide.classList.remove('active');
    currentSlide.classList.add('next');
    newActiveSlide.classList.remove('next');
    newActiveSlide.classList.remove('prev');
    newActiveSlide.classList.add('active');

    // If wear in book view mode, syncronize presented slide
    if (this.slideshowElem.classList.contains('slidedeck-book') === true) {
      document.querySelector('.active').scrollIntoView({ behavior : 'smooth' });
    }

    this.fireSlideShown();
  }

  /**
   * Move the `.activeSlide` class marker to the designated slide index
   * (0 based) and (optionally) partial.
   * 
   * The current implementation cycles through each slide until
   * reaching the desired one, so multiple events are fired.
   * 
   * @param {number} slideIndex contains the slide number, 0 based. Invalid 
   *        argument value is taken as NOOP
   * @param {partialIndex} partial index inside of the indicated slide
   * 
   * @fires slideShown
   * @fires partialShown
   * 
   * @todo with the current implementation, asking to show for a partial already
   *       visible fires no event and hides no other sibling partials. Maybe this
   *       behaviour can be improved by firing `partialUnshown` events and turning
   *       the rest of partials invisible.
   */
  gotoSlideIndex(slideIndex, partialIndex) {
    const slides = this.slideshowElem.querySelectorAll('section');
    const slideCount = slides.length;
    if (typeof(slideIndex) !== 'number' || slideIndex < 0 || slideIndex > slideCount-1) {
      console.warn(`Trying to reach incorrect slide (number ${slideIndex}).`);
      return;
    }

    // loop to the desired slide
    let currentIndex;
    do {
      currentIndex = this.getCurrentSlideIndex();
      if (currentIndex  < slideIndex) {
        this.gotoNextSlide();
      } else if (currentIndex > slideIndex) {
        this.gotoPreviousSlide();
      }
    } while (currentIndex !== slideIndex);

    slides[slideIndex].classList.add('active');
    
    if (partialIndex) {
      const partials = this.getCurrentSlidePartials();
      [].concat(partials.shown)
        .concat(partials.unshown)
        .forEach((e, i) => {
          if ((i < partialIndex) && (e[0].classList.contains('partial-shown') === false)) {
            e.forEach(e=>e.classList.add('partial-shown'));
            this.firePartialShown();
          }
        });
    }
  }

  /**
   * Cycles between the different views of the slides:
   * 
   * * Normal (presentation) mode: the `html` tag will have a `fullviewport` class
   *   and the `slideShowElem` will have the `slidedeck` one and the `presentation`. 
   *   This is the mode you use to show the slides.
   * 
   * * Speaker (with notes and next slide) mode: the `html` tag will have a `fullviewport` class
   *   and the `slideShowElem` will have both `slidedeck` and `speaker`classes. 
   *   This is the mode you use to help you while presenting life.
   * 
   * * Book (totally paginated, as in a book) mode: the `html` will NOT have any
   *   special class and the `slideShwElem` will only contain the `slidedeck-book` one.
   *   This mode will allow to pretty-print the slides like a book but it is also a good
   *   way to help the presenter while delivering online sessions.
   * 
   */
  toggleSpeakerView() {
    if (this.slideshowElem.classList.contains('speaker') == true) {
      this.slideshowElem.classList.remove('speaker');
      this.slideshowElem.classList.add('presentation');
      window.scrollTo(0,0);
    } else {
      // normal slides -> speaker mode
      this.slideshowElem.classList.remove('presentation');
      this.slideshowElem.classList.add('speaker');
    }
  }

  /**
   * @returns the currently active slide element
   */
  getCurrentSlideElem() {
    const currentSlide = this.slideshowElem.querySelector('.active');
    return currentSlide;
  }

  /**
   * @returns {number} the index of the current slide (0 based).
   */
  getCurrentSlideIndex() {
    const currentSlide = this.slideshowElem.querySelector('.active');
    const allSlides = [...this.slideshowElem.querySelectorAll('section')];

    return allSlides.indexOf(currentSlide);
  }

  /**
   * @returns {number} with the index of the last shown partial (1 based),
   *          0 if now partial is shown or -1 if the slide contains no
   *          partials.
   */
  getCurrentPartialIndex() {
    const currentSlide = this.slideshowElem.querySelector('.active');
    if (currentSlide.classList.contains('partial') == false) {
      return -1;
    } 
    let partialsShown = currentSlide.querySelectorAll('li.partial-shown');
    if (partialsShown === null) {
      partialsShown = currentSlide.querySelectorAll('th.partial-shown');
    }
    return partialsShown.length;
  }

  /**
   * Executed when the animation showing the current partition has finished.
   * 
   * @todo Decide if this method is usefull or listening the corresponding
   *       event should be enought.
   */
  observeSlideTransitions(event) {
    const activeSlide = this.slideshowElem.querySelector('.active');
    if (event.originalTarget === activeSlide && event.propertyName === 'left') {
      // TODO: is it useful?
    }
  }

  /**
   * @typedef {Event} slideShownEvent
   * @property {HTMLElement} detail.slideshow the slideshow container element
   * @property {HTMLElement} detail.currentSlideElem the currently presented slide
   * @property {number} detail.currentSlideIndex the index of the current slide (0 based)
   * @property {number} detail.lastPartialShownIndex the index of the last partial shown (1 based, 0 if none)
   */  


  /**
    * @returns {slideShownEvent} with information about the current status of the slideshow
    */
  fireSlideShown() {
    const currentSlideElem = this.slideshowElem.querySelectorAll('section')[this.getCurrentSlideIndex()];
    const partialShownItems = this.getCurrentSlidePartials();
    const lastPartialShownIndex = currentSlideElem.classList.contains('partial') ?
                                  partialShownItems.shown.length : -1;
    const event = new CustomEvent("slideShown", {
      detail: {
        slideshow : this,
        currentSlideElem,
        currentSlideId : currentSlideElem.id,
        currentSlideIndex : this.getCurrentSlideIndex(),
        lastPartialShownIndex 
      }
    });
    currentSlideElem.dispatchEvent(event);
  }

  /**
   * @typedef {Event} partialShownEvent
   * @property {HTMLElement} detail.slideshow the slideshow container element
   * @property {HTMLElement} detail.currentSlideElem the currently presented slide
   * @property {number} detail.currentSlideIndex the index of the current slide (0 based)
   * @property {HTMLElement} detail.lastPartialShownElem the partial that has just appeared
   * @property {number} detail.lastPartialShownIndex the index of the last partial shown (1 based, 0 if none)
   */  
  firePartialShown() {
    const currentSlideElem = this.slideshowElem.querySelectorAll('section')[this.getCurrentSlideIndex()];
    const partialShownItems = this.getCurrentSlidePartials();
    const lastPartialShownIndex = partialShownItems.shown.length;
    const lastPartialShownElem = partialShownItems.shown[lastPartialShownIndex-1][0];

    const event = new CustomEvent("partialShown", {
      detail: {
        slideshow : this,
        currentSlideElem,
        currentSlideIndex : this.getCurrentSlideIndex(),
        lastPartialShownElem,
        lastPartialShownIndex
      }
    });
    lastPartialShownElem.dispatchEvent(event);
  }
}

export {Slideshow};