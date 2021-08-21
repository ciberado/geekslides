import { MarkdownToHTML } from '../scripts/MarkdownToHTML';

test('each slide separator generates a new slide', () => {
  const md = `
[]()

[]()

[]()
`;
  const m2h = new MarkdownToHTML(md);
  m2h.convert();
  const template = document.createElement('template');
  template.innerHTML = m2h.html;

  const sectionCount = template.content.querySelectorAll('section').length;

  expect(sectionCount).toBe(3);
});


test('slide separator with # defines the correct section id', () => {
  const md = `[](#this-is-the-id)`;
  const m2h = new MarkdownToHTML(md);
  m2h.convert();
  const template = document.createElement('template');
  template.innerHTML = m2h.html;

  const section = template.content.querySelector('section');

  expect(section.id).toEqual('this-is-the-id');
});

test('slide separator with . defines the correct multiple classes', () => {
  const md = `[](.first-class.second-class)`;
  const m2h = new MarkdownToHTML(md);
  m2h.convert();
  const template = document.createElement('template');
  template.innerHTML = m2h.html;

  const section = template.content.querySelector('section');

  expect(section.classList.contains('first-class')).toBe(true);
  expect(section.classList.contains('second-class')).toBe(true);
});

test('slide separator width bgurl defines the background cover', () => {
  const md = `[](bgurl(image.png))`;
  const m2h = new MarkdownToHTML(md);
  m2h.convert();
  const template = document.createElement('template');
  template.innerHTML = m2h.html;

  const section = template.content.querySelector('section');
  const backgroundImage = section.style.backgroundImage;

  expect(backgroundImage).toEqual('url(image.png)');
});

test('slide separator width bgcolor defines the background color', () => {
  const md = `[](bgcolor(white))`;
  const m2h = new MarkdownToHTML(md);
  m2h.convert();
  const template = document.createElement('template');
  template.innerHTML = m2h.html;

  const section = template.content.querySelector('section');
  const backgroundColor = section.style.backgroundColor;

  expect(backgroundColor).toEqual('white');
});

