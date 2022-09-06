import WhiteboardLayer from './WhiteboardLayer.js';

class GlobalWhiteboard {

  whiteboardContainerElem;
  whiteboard;

  constructor() {
    this.whiteboardContainerElem = this.#createParentElement();
    this.#updateWhiteboardScale();

    this.whiteboard = new WhiteboardLayer(this.whiteboardContainerElem);
    this.whiteboard.canvas.addEventListener('remoteWhiteboard', evt => this.#onRemote(evt));

    document.addEventListener('toggleGlobalWhiteboard', () => {
      if (this.whiteboardContainerElem.classList.contains('active') === true) {
        this.closeWhiteboard();
      } else {
        this.openWhiteboard();
      }
    }, true);  
  }

  #createParentElement() {
    const elem = document.createElement('div');
    elem.id = 'globalwbc';
    elem.classList.add('whiteboard-container');

    document.body.appendChild(elem);
    
    window.addEventListener('resize',() => this.#updateWhiteboardScale());

    return elem;
  }

  #updateWhiteboardScale() {
    const pageSize = { 
      w: document.body.offsetWidth,
      h: document.body.offsetHeight
    };

    const whiteboardSize = { w : 1920, h : 1080};
    const sx =  (pageSize.w / whiteboardSize.w);
    

    let factor;
    if (this.whiteboardContainerElem.clientHeight < whiteboardSize.h * sx) {
      factor = sx;
    } else {
      factor = sx;
    }

    const top = (pageSize.h-whiteboardSize.h*sx)/2;
    
    this.whiteboardContainerElem.style.top =  `${parseInt(top)}px`;
    this.whiteboardContainerElem.style.transform = `scale(${sx})`;
  }  

  /**
   * @fires whiteboardShown
   */
  openWhiteboard() {
    const classList = this.whiteboardContainerElem.classList;
    if (classList.contains('active') === false) {
      classList.add('active');
      this.#dispatchEvent('whiteboardShown');
    }
  }

  /**
   * @fires whiteboardHidden
   */
  closeWhiteboard() {
    const classList = this.whiteboardContainerElem.classList;
    if (classList.contains('active') === true) {
      classList.remove('active');
      this.#dispatchEvent('whiteboardHidden');
    }
  }

  #onRemote(evt) {
    const action = evt.detail.action;
    if (action === 'whiteboardShown') {
      this.openWhiteboard();
    } else if (action === 'whiteboardHidden') {
      this.closeWhiteboard();
    }
  }

  #dispatchEvent(eventName) {
    const detail = {
      source : this.whiteboard.canvas
    };
    let event = new CustomEvent(eventName, {detail});
    document.dispatchEvent(event);
  }

}

export default GlobalWhiteboard;