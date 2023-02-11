import css from './styles.css';

class Toolbar {

  toolbarElem;

  constructor(parentElem) {
    this.parentElem = parentElem;

    const templateElem = document.createElement('template');
    templateElem.innerHTML = `
      <ul class="toolbar">
      <li class="action"><button type="button" data-action="emit">Emit</button></li>
      <li class="action"><button type="button" data-action="white">White</button></li>
      <li class="action"><button type="button" data-action="black">Black</button></li>
      <li class="action"><button type="button" data-action="red">Red</button></li>
      <li class="action"><button type="button" data-action="green">Green</button></li>
      <li class="action"><button type="button" data-action="yellow">Yellow</button></li>
    
      <li class="action"><button type="button" data-action="big">Big</button></li>
      <li class="action"><button type="button" data-action="thin">Thin</button></li>
    
      <li class="action"><button type="button" data-action="transparent">Transparent</button></li>
      <li class="action"><button type="button" data-action="opaque">Opaque</button></li>

      <li class="action"><button type="button" data-action="eraser">Eraser</button></li>
      
      <li class="action"><button type="button" data-action="whiteboard">Whiteboard</button></li>
    
      <li class="action"><button type="button" data-action="clear">Clear</button></li>
    </ul>
    `.trim();
    
    this.toolbarElem = document.importNode(templateElem.content.firstChild, true);

    this.parentElem.appendChild(this.toolbarElem);

    [...this.toolbarElem.querySelectorAll('button')]
      .forEach(e => {
        e.addEventListener('click', (evt) => this[e.dataset.action]());
      })

    document.addEventListener('touchstart', evt => this.#showToolbar(), true);
  }

  #showToolbar() {
    this.toolbarElem.classList.add('active');
  }

  emit() {
    this.#dispatchEvent('toggleEmission');
  }

  white() {
    this.#dispatchEvent('changeWhiteboardPen', {
      color : 'white'
    });
  }
  
  black() {
    this.#dispatchEvent('changeWhiteboardPen', {
      color : 'black'
    });
  }
  
  red() {
    this.#dispatchEvent('changeWhiteboardPen', {
      color : 'red'
    });
  }
  
  green() {
    this.#dispatchEvent('changeWhiteboardPen', {
      color : 'green'
    });
  }
  
  yellow() {
    this.#dispatchEvent('changeWhiteboardPen', {
      color : 'yellow'
    });
  }

  big() {
    this.#dispatchEvent('changeWhiteboardPen', {
      penSize : 18
    });
  }
  
  thin() {
    this.#dispatchEvent('changeWhiteboardPen', {
      penSize : 3
    });
  }

  whiteboard() {
    this.#dispatchEvent('toggleGlobalWhiteboard');
  }
  
  clear() {
    this.#dispatchEvent('clearVisibleWhiteboard');
  }
  
  transparent() {
    this.#dispatchEvent('changeWhiteboardPen', {
      opacity : 0.01
    });
  }

  opaque() {
    this.#dispatchEvent('changeWhiteboardPen', {
      opacity : 1
    });
  }

  eraser() {
    this.#dispatchEvent('changeWhiteboardPen', {
      color : 'eraser'
    });
  }  

  #dispatchEvent(eventName, detail) {
    let event = new CustomEvent(eventName, { detail });
    document.dispatchEvent(event);
  }
}

export default Toolbar;