import { Slideshow } from '../scripts/slideshow.js';
import expand from 'emmet';

let cssMock;

beforeEach(() => {
  cssMock = 
    { href : 'minislides', 
    cssRules : [
      { selectorText : '.slidedeck section',
        style : {}
      },
      { selectorText : '.slidedeck.speaker section',
        style : {}
      }
    ]
  }
});

test('default aspect ratio set to 16:9 and scales correctly the first slide', () => {
  document.styleSheets.push(cssMock);
  const parentElem = document.createElement('div');
  parentElem.style.width="1000px";
  parentElem.style.height="1000px";
  parentElem.appendChild(document.createElement('section'));
  const slideshow = new Slideshow(parentElem, { aspectRatio : "16:9" });
  expect(document.styleSheets[0].cssRules[0].style.width).toEqual('1600px');
  expect(document.styleSheets[0].cssRules[0].style.height).toEqual('900px');
});

test('explicit set of 16:9 aspect ratio works scales correctly the first slide', () => {
  document.styleSheets.push(cssMock);
  const parentElem = document.createElement('div');
  parentElem.style.width="1000px";
  parentElem.style.height="1000px";
  parentElem.appendChild(document.createElement('section'));
  const slideshow = new Slideshow(parentElem, { aspectRatio : "16:9" });
  expect(document.styleSheets[0].cssRules[0].style.width).toEqual('1600px');
  expect(document.styleSheets[0].cssRules[0].style.height).toEqual('900px');
});

test('explicit set of 4:3 aspect ratio works scales correctly the first slide', () => {
  document.styleSheets.push(cssMock);
  const parentElem = document.createElement('div');
  parentElem.style.width="1000px";
  parentElem.style.height="1000px";
  parentElem.appendChild(document.createElement('section'));
  const slideshow = new Slideshow(parentElem, { aspectRatio : "4:3" });
  expect(document.styleSheets[0].cssRules[0].style.width).toEqual('960px');
  expect(document.styleSheets[0].cssRules[0].style.height).toEqual('720px');
});

test('partials are correctly recovered', () => {
  const emmet = '(section>ul>li#a$*3)+'
               +'(section.active.partial>ul>li#b$.partial-shown*3+li#b4+li#b5)+'
               +'(section>ul>li#c$*3)';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  const partials = slideshow.getCurrentSlidePartials();
  const shownIds = partials.shown.map(e => e.id);
  const unshownIds = partials.unshown.map(e => e.id);

  expect(shownIds).toEqual(expect.arrayContaining(['b1', 'b2', 'b3']));
  expect(unshownIds).toEqual(expect.arrayContaining(['b4', 'b5']));
});

test('moving to next slide without partials works correctly', () => {
  const emmet = 'section.active+section*5+section#target+section*5';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  for (let i=0; i<6; i++) {
    slideshow.gotoNextSlide();
  }
  const currentSlide = parentElem.querySelector('.active');
  expect(currentSlide.id).toEqual('target');
});


test('moving to next slide without partials works correctly beyond the end of the deck', () => {
  const emmet = 'section.active+section*5+section#target';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  for (let i=0; i<20; i++) {
    slideshow.gotoNextSlide();
  }
  const currentSlide = parentElem.querySelector('.active');
  expect(currentSlide.id).toEqual('target');
});


test('moving to next partial works correctly', () => {
  const emmet = '(section>ul>li*2)+'
               +'(section.active.partial>ul>li#a+li#b+li#c)'
               +'(section>ul>li*2)';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  slideshow.gotoNextSlide();
  slideshow.gotoNextSlide();
  const partialShownSelector = 'section.active > ul > li.partial-shown';
  const partialShownIds = [...parentElem.querySelectorAll(partialShownSelector)].map(e=>e.id)
  expect(partialShownIds).toEqual(['a', 'b']);

});

test('moving to previous slide without partials works correctly', () => {
  const emmet = 'section#target+section*5+section.active+section*5';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  for (let i=0; i<6; i++) {
    slideshow.gotoPreviousSlide();
  }
  const currentSlide = parentElem.querySelector('.active');
  expect(currentSlide.id).toEqual('target');
});

test('moving to previous slide without partials works correctly beyond the beginning of the deck', () => {
  const emmet = 'section#target+section*5+section.active';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  for (let i=0; i<20; i++) {
    slideshow.gotoPreviousSlide();
  }
  const currentSlide = parentElem.querySelector('.active');
  expect(currentSlide.id).toEqual('target');
});

test('moving to previous slides ignores shown partials, and actually presents the previous section', () => {
  const emmet = '(section#target>ul>li*2)+'
               +'(section.active.partial>ul>li.partial-shown#a+li#b.partial-shown+li#c)'
               +'(section>ul>li*2)';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  slideshow.gotoPreviousSlide();
  const currentSlide = parentElem.querySelector('.active');
  expect(currentSlide.id).toEqual('target');
});

test('retrieving the current slide index works as expected, for the first slide', () => {
  const emmet = 'section.active+section*9';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  const currentSlideIndex = slideshow.getCurrentSlideIndex();
  expect(currentSlideIndex).toBe(0);
});

test('retrieving the current slide index works as expected, for any slide', () => {
  const emmet = 'section.active+section*9';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  for (let i=0; i < 10; i++) {
    const currentSlideIndex = slideshow.getCurrentSlideIndex();
    expect(currentSlideIndex).toBe(i);
    slideshow.gotoNextSlide();
  }
});

test('retrieving the current from a non-partial slide returns -1', () => {
  const emmet = 'section.active>ul>li*5';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  const partialIndex = slideshow.getCurrentPartialIndex();
  expect(partialIndex).toBe(-1);
});

test('retrieving the current partial index when none has been shown returns 0', () => {
  const emmet = 'section.active.partial>ul>li*5';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  const partialIndex = slideshow.getCurrentPartialIndex();
  expect(partialIndex).toBe(0);
});

test('retrieving the current partial index works as expected', () => {
  const emmet = 'section.active.partial>ul>(li.partial-shown*2+li*3)';
  const parentElem = document.createElement('div');
  parentElem.innerHTML = expand(emmet);
  const slideshow = new Slideshow(parentElem);
  const partialIndex = slideshow.getCurrentPartialIndex();
  expect(partialIndex).toBe(2);
});

