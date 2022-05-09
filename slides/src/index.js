import { Slideshow } from './Slideshow.js';
import { UserInputDevices } from './UserInputDevices.js';
import { SlideshowController } from './SlideshowController.js';
import SyncController from './SyncController.js';
import GlobalWhiteboard from './whiteboard/GlobalWhiteboard.js';
import Toolbar from './toolbar/Toolbar.js';

async function loadSlideshow(slideshowController) {
  let url;
  let index = 0;

  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  if (urlParams.get('url') !== null) {
    url = urlParams.get('url');
    index = parseInt(urlParams.get('index')) || 0;
    console.log(`Attempting to get content from url param (${url}#${index}).`);
  } else if (location.hash && window.sessionStorage.getItem('lastInputSlideshowUrl')) {
    // if there is a hash set (like #32) probably we are reloading the content
    url = window.sessionStorage.getItem('lastInputSlideshowUrl');
    index = parseInt(location.hash.substring(1)) || 0;
  } else {
    url = location.href;
    if (url.endsWith('index.html')) url = url.substring(0, url.lastIndexOf('index.html'));
    console.log(`Attempting to get content from the current address (${url}).`);
  }
  
  await slideshowController.changeSlideshowContent(url, index);
}

(async function() {
  console.log('Running.')

  const slideshow = new Slideshow(document.querySelector('#s1'), { aspectRatio : '16:9'});
  const uid = new UserInputDevices(slideshow);
  const slideshowController = new SlideshowController(slideshow);
  const syncController = new SyncController(slideshowController);

  const globalWhiteboardCtrl = new GlobalWhiteboard();

  await loadSlideshow(slideshowController);

  const toolbar = new Toolbar(document.body);
  console.log('All initialized.');
}());


