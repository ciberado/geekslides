import 'notie/dist/notie.css';
import notie from 'notie/dist/notie.js';
import { MarkdownToHTML } from './MarkdownToHTML.js';
import WhiteboardLayer from './whiteboard/WhiteboardLayer.js';
import VideoSlideController from './VideoSlideController.js';
import ChartSlideController from './ChartSlideController.js';

/**
 * Transforms a slide, adding a background image based in its `data-bgurl` attribute.
 * 
 * @param {HTMLElement} slideElem 
 */
function bgUrlProcessor(slideElem) {
  const bgUrl = slideElem.dataset.bgurl;
  if (bgUrl) {
    slideElem.style.background = `url(${bgUrl}) no-repeat center`;
    slideElem.style.backgroundSize = 'cover';
  }
}


/**
 * Transforms a slide, seting the background color based in its `data-bgcolor` attribute.
 * 
 * @param {HTMLElement} slideElem 
 */
function bgColorProcessor(slideElem) {
  const bgColor = slideElem.dataset.bgcolor;
  if (bgColor) {
    slideElem.style.backgroundColor = bgColor;
  }
}

/**
 * 
 * @param {HTMLElement} slideElem with the slide to be transformed by the processor
 */
function chartProcessor(slideElem) {
  const chartOptions = slideElem.dataset.chart;
  if (chartOptions) {
    new ChartSlideController(slideElem);
  }
}

/**
 * 
 * This processor is quite sophisticated, as it extracts the footnotes references 
 * placed inside the slide and moves the actual footnotes to the speakers notes of
 * the current slide instead of keeping them at the end of the document. 
 * This way, context is better preserved.
 * 
 * @param {HTMLElement} slideElem with the slide to be transformed by the processor
 */
function footnotesProcessor(slideElem) {
  const footNoteRefElems = [...slideElem.querySelectorAll('.footnote-ref a')];
  if (footNoteRefElems.length === 0) return;

  let slideNotesElem = slideElem.querySelector('.slide-notes');
  if (slideNotesElem === null) {
    slideNotesElem = document.createElement('.slide-notes');
  }
  const slideNotesHeaderElem = document.createElement('h2');
  slideNotesHeaderElem.innerText = 'Foot notes';
  slideNotesElem.appendChild(slideNotesHeaderElem);
  slideElem.appendChild(slideNotesElem);

  const footNoteListElem = document.createElement('ol');
  footNoteListElem.start = footNoteRefElems[0].href.substring(footNoteRefElems[0].href.indexOf('#fn') + "#fn".length);
  footNoteListElem.classList.add('local-foot-notes');
  footNoteRefElems.forEach(fnre => {
    const footNoteElemId = fnre.href.substring(fnre.href.indexOf('#'));
    const footNoteElem = document.querySelector(footNoteElemId).cloneNode(true);
    footNoteListElem.append(footNoteElem);
  });
  slideNotesElem.appendChild(footNoteListElem);
}

/**
 * If the slide contains the class hidden, it is removed from the presentation.
 * 
 * @param {HTMLElement} slideElem with the slide to be transformed by the processor
 */
function hiddenSlidesProcessor(slideElem) {
  if (slideElem.classList.contains('hidden') === true) {
    slideElem.parentNode.removeChild(slideElem);
  }
}

/**
 * For each slide containing at least one list, make it partial by appending
 * the `.partial` class.
 * 
 * @param {HTMLElement} slideElem with the slide to be transformed by the processor
 */
function partializeProcessor(slideElem) {
  if (slideElem.querySelector('ul, ol') !== null) {
    slideElem.classList.add('partial');
  }
}

/**
 * Transforms a slide, injecting an <iframe> element based on the `iframe` attribute.
 * 
 * @param {HTMLElement} slideElem 
 */
function iframeProcessor(slideElem) {
  const iframeSrc = slideElem.dataset.iframe;
  if (iframeSrc) {
    const iframeElem = document.createElement('iframe');
    iframeElem.src = iframeSrc;
    slideElem.appendChild(iframeElem);

    const nextSlideBtnElem = document.createElement('button')
    nextSlideBtnElem.classList.add('iFrameNextSlide');
    nextSlideBtnElem.addEventListener('click', (evt) => {
      let event = new CustomEvent('nextSlide');
      document.dispatchEvent(event);  
    });
    nextSlideBtnElem.innerHTML = "➜";
    slideElem.appendChild(nextSlideBtnElem);
  }
}

/**
 * 
 * Transforms the whole markdown document before it is converted to HTML,
 * injecting a slide separator each time three empty lines are found on it.
 * 
 * @param {string} markdown 
 */
function threeEmptyLinesSlicerPreprocessor(markdown) {
  return '[]()\n\n' + markdown.replaceAll('\n\n\n\n', '\n\n[]()\n\n');
}

/**
 * 
 * Replaces blank lines with html comments, so an empty paragraph is inserted 
 * in the resulting html. Specially useful for separating consecutive
 * lists of elements.
 * 
 * @param {string} markdown 
 */
function emptyLineSeparatorPreprocessor(markdown) {
  return markdown.replaceAll('\n\n', '\n\n<!-- -->\n\n');
}

/**
 * This class reacts to user generated events (`nextSlide`, `previousSlide`, `toggleSpeakerView`, `cloneWindow`),
 * slide lifecycle events (`slideShown`, `partialShown`) and address bar changes (`hashchange`) updating the
 * associated slideshow.
 * 
 * 
 */
class SlideshowController {

  static DEFAULT_CONFIG = {
    content: 'content.md',
    resolution : '16:9',
    styles: '',
    preprocessor : [

    ],
    processors: [
      hiddenSlidesProcessor,
      bgUrlProcessor,
      bgColorProcessor,
      footnotesProcessor,
      chartProcessor,
      iframeProcessor
    ],
    script: '',
    liveReload : false
  };


  /** Source of the different files used to create the slideshow. */
  config;
  slideshow;
  baseUrl;

  /**
   * Initializes a new controller.
   * 
   * @param {Slideshow} slideshow the slideshow object 
   */
  constructor(slideshow) {
    /* @property {Slideshow} slideshow object */
    this.slideshow = slideshow;

    document.addEventListener('nextSlide', (event) => {
      this.slideshow.gotoNextSlide();
    });
    document.addEventListener('previousSlide', (event) => {
      this.slideshow.gotoPreviousSlide();
    });
    document.addEventListener('toggleSpeakerView', (event) => {
      this.slideshow.toggleSpeakerView();
    });
    document.addEventListener('slideShown', (event) => {
      let newHash = event.detail.currentSlideIndex;
      if (event.detail.lastPartialShownIndex > 0) {
        newHash += '.' + event.detail.lastPartialShownIndex;
      }
      window.location.hash = newHash;
    });
    document.addEventListener('partialShown', (event) => {
      window.location.hash = event.detail.currentSlideIndex + '.' + event.detail.lastPartialShownIndex;
    });

    window.addEventListener('hashchange', () => {
      this.matchHashIndex();
    });


    document.addEventListener('cloneWindow', () => {
      const baseUrl = this.baseUrl;
      const newWindow = window.open(window.location);
      newWindow.addEventListener('load', () => {
        const message = {
          command: 'slideUrlChange',
          baseUrl: baseUrl,
          slideIndex: slideshow.getCurrentSlideIndex()
        };
      }, true);
    });

    document.addEventListener('changeAspectRatio', (event) => {
      let newAspectRation = this.slideshow.aspectRatio === '4:3' ? '16:9' : '4:3';
      this.slideshow.setAspectRatio(newAspectRation);
    });

    document.addEventListener('openSlides', () => {
      this.#inputSlideshowUrl();
    });

    this.matchHashIndex();

  }

  #initWhiteboards() {
    [...this.slideshow.slideshowElem.querySelectorAll('section')]
    .forEach(e => {
      new WhiteboardLayer(e);
    });
  }

  #initVideoslides() {
    [...this.slideshow.slideshowElem.querySelectorAll('section')]
    .filter(e => e.querySelector('video') !== null)
      .forEach(e => {
        new VideoSlideController(e);
      });
  }

  /**
   * Provides synchronization between the new value of the hash portion of the current http address and
   * the active slide.
   * 
   * The hash format is very simple: `#` symbol followed by an integer indicating the slide number (0 based) and
   * optionally a point (`.`) followed by an integer representing the partial index (1 based, as 0 indicates none shown).
   * For example, `#4.2` will navigate to the fifth slide and present the first two partials.
   */
  matchHashIndex() {
    let hashParts = (/#(\d+)\.?(\d+)?/g).exec(window.location.hash);
    if (hashParts == null) {
      return;
    }
    this.slideshow.gotoSlideIndex(parseInt(hashParts[1]),
      hashParts[2] ? parseInt(hashParts[2]) : undefined);
  }


  #input(text, value) {
    return new Promise((resolve, reject) => {
      const options = {
        text,
        value,
        submitText: 'Accept',
        position: 'bottom',
        submitCallback: v => resolve(v),
        cancelCallback: v => resolve(null)
      };

      notie.input(options);
    });
  }

  /**
   * Asks for the url of the slide show to be presented and in case it is
   * correctly provided updates the slidesshow.
   * 
   * @fires userOpenedSlides if it has been possible to open the new slideck
   */
  async #inputSlideshowUrl() {
    const value = window.sessionStorage.getItem('lastInputSlideshowUrl');
    let baseUrl = await this.#input('introduce the slides url, please:', value ? value : '');
    if (baseUrl === null) return;

    if (baseUrl !== '') {
      if (baseUrl.startsWith('http') === false) {
        baseUrl = 'http://' + baseUrl;
      }
      if (baseUrl.endsWith('/') === false) {
        baseUrl = baseUrl + '/'
      }
    }
    const slidesLoaded = await this.changeSlideshowContent(baseUrl);
    if (slidesLoaded === true) {
      this.#dispatchEvent('userOpenedSlides', {
        baseUrl: this.baseUrl
      });
    } else {
      notie.alert({ type: 'error', text: 'Error opening slideshow.', position: 'bottom' });
    }
  }

  /**
   * Loads into the DOM a new CSS file.
   * 
   * @param {string} url with the path to the CSS file.
   * @returns the promise that will be resolved once the CSS is loaded.
   */
  async loadLocalCSS(url) {
    const cssLoadedPromise = new Promise((resolve, reject) => {
      console.log(`Loading styles from ${url}.`);
      const cssElem = document.createElement('link');
      cssElem.rel = 'stylesheet';
      cssElem.type = 'text/css';
      cssElem.href = url;
      cssElem.onload = (evt) => {
        resolve();
      }
      document.querySelector('head').appendChild(cssElem);
    });

    return cssLoadedPromise;
  }

  /**
   * 
   * @param {string} url to monitor. Each second, that url will be fetched. If the
   *        `last-modified` tag doesn't match with the previous version, a window
   *        reloading will be triggered.
   */
  async activateLiveReload(url) {
    let previousTime = '';
    setInterval(async function() {
      const response = await fetch(url);
      const currentTime = response.headers.get('last-modified');
      if (previousTime && previousTime !== currentTime) {
        window.location.reload();
      } else {
        previousTime = currentTime;
      }
    }      
    , 1000);
  }

  /**
   * 
   * @param {string} newBaseUrl 
   * @param {string} newSlideIndex 
   *
   * @returns true if a new slideshow has been correctly loaded, false otherwise.
   * @fires slideshowLoaded
   */
  async changeSlideshowContent(newBaseUrl, newSlideIndex) {
    if (this.baseUrl === newBaseUrl) return true;

    if (newBaseUrl.endsWith('/') === false) {
      newBaseUrl += '/';
    }
    // load configuration (or use the default one)
    console.log(`Loading configuration for ${newBaseUrl}.`);
    let fetchedConfig;
    try {
      fetchedConfig = await fetch(newBaseUrl + 'config.json');
      this.config = JSON.parse(await fetchedConfig.text());
      console.log(`Configuration retrieved.\n\n${fetchedConfig}\n\n`);
    } catch (error) {
      console.log(`Configuration file not present. Trying default config (${JSON.stringify(SlideshowController.DEFAULT_CONFIG)}).`);
      this.config = SlideshowController.DEFAULT_CONFIG;
    }
    // Try to load content, return false if it is not possible
    let markdown = null;
    let fetchedContent = await fetch(newBaseUrl + this.config.content);
    if (fetchedContent.ok !== true) {
      console.info(`Error retrieving markdown for ${newBaseUrl}: ${fetchedContent.status} ${fetchedContent.statusText}`);
      // Create an artificial markdown document describing 200 slides implemented as images. This
      // is useful when the presentation is generated exporting from a pdf document using
      // `pdftoppm -r 150 -png slides.pdf Slide`.
      console.info(`Generating synthetic markdown document for png images.`);
      markdown = [...Array(200).keys()].map(e => `[](bgurl(Slide-${e<9? '0' : ''}${e+1}.png))`).join('\r\n\r\n');
    } else {
      markdown = await fetchedContent.text();
      if (this.config.liveReload === true) {
        this.activateLiveReload(newBaseUrl + this.config.content);
      }
    }

    this.baseUrl = newBaseUrl;
    
    let baseElem = document.querySelector('base');
    if (!baseElem) {
      baseElem = document.createElement('base');
      document.querySelector('head').appendChild(baseElem);
    }
    baseElem.href = this.baseUrl;

    // Add (if exists) local css
    if (this.config.styles) {
      const styles = Array.isArray(this.config.styles) ? this.config.styles : [this.config.styles]; 
      styles.forEach(url => this.loadLocalCSS(newBaseUrl + url));
    }

    // Pre-process the markdown document
    if (this.config.preprocessors) {
      for (const preprocessor of this.config.preprocessors.map(sp => typeof(sp) === 'string' ? eval(sp) : sp)) {
        markdown = preprocessor(markdown);
      }  
    }

    // Parse the markdown content and transform it into HTML
    let m2h = new MarkdownToHTML(markdown, this.baseUrl);
    m2h.convert();
    this.slideshow.slideshowElem.innerHTML = m2h.html;

    // Process each slide
    [...this.slideshow.slideshowElem.querySelectorAll('section')]
    .forEach((e, i) => {
      // Set the ids of the slides without a proper one
      if (!e.id) e.id = `slide${i}`;
      this.config.processors.map(sp => typeof(sp) === 'string' ? eval(sp) : sp).forEach(sp => sp(e));
    });

    if (this.config.resolution) {
      this.slideshow.setAspectRatio(this.config.resolution);
    }
    this.slideshow.refreshSlideshowContent();
    if (newSlideIndex) this.slideshow.gotoSlideIndex(newSlideIndex);

    this.#initWhiteboards();
    this.#initVideoslides();

    window.sessionStorage.setItem('lastInputSlideshowUrl', this.baseUrl);

    this.#dispatchEvent('slideshowLoaded', { newBaseUrl, currentSlideIndex: newSlideIndex });

    return true;
  }

  #dispatchEvent(eventName, detail) {
    let event = new CustomEvent(eventName, { detail });
    document.dispatchEvent(event);
  }

}

export { SlideshowController as SlideshowController };