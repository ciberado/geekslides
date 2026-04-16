/**
 * Test processor: adds a data-highlighted attribute to the slide content element.
 */
export default function highlightProcessor(slideElement) {
  slideElement.setAttribute('data-highlighted', 'true');
}
