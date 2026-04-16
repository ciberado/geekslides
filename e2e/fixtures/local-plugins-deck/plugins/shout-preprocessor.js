/**
 * Test preprocessor: converts "hello" to "HELLO" in the markdown source.
 */
export default function shoutPreprocessor(markdown) {
  return markdown.replaceAll('hello', 'HELLO');
}
