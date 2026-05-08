/**
 * Minimal test custom element for E2E verification.
 *
 * Renders a <div> with known text and class so tests can assert
 * that script-loaded components render inside slide DOM.
 */
class TestWidget extends HTMLElement {
  connectedCallback() {
    const wrapper = document.createElement('div');
    wrapper.className = 'test-widget-root';
    wrapper.textContent = 'Widget loaded';
    wrapper.setAttribute('data-init', 'true');
    this.appendChild(wrapper);
  }
}

customElements.define('test-widget', TestWidget);

export function init() {
  document.body.setAttribute('data-scripts-init', 'true');
}
