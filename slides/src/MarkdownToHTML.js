import {default as MarkdownIt} from 'markdown-it'; 
import {default as markdownItFootnotePlugin} from 'markdown-it-footnote';
import {default as blockImagePlugin } from 'markdown-it-block-image';
import {default as containerPlugin} from 'markdown-it-container';
import {default as codePlugin} from 'markdown-it-highlightjs';


/**
 * Transforms a markdown string into another string containing HTML elements compatible with the slideshow.
 * One key feature of the library is to provide a way of consume markdown documents that are legible without
 * any transformation. To do so, this class is able to decode empty links with fake *href* destinations 
 * (invisible in general markdown rendering output) and transform them into `section` elements with
 * attributes like `id`, `class`, `style`, etc.
 * 
 */
class MarkdownToHTML {

  /**
   * Creates a new MarkdownToHTML transformer.
   * 
   * @param {string} markdown contains the text with the markdown representation of the slides.
   * @param {string} markdown base url prepended to all non-absolute external media.
   */
  constructor(markdown, baseUrl) {
    /** @property {string} markdown */
    this.markdown = markdown;
    /** @property {string} baseUrl */
    this.baseUrl = baseUrl;
    /** @property {string} html */
    this.html = null;
  }

  /** 
   * Currently transforms a text line like this:
   * 
   * #this-is-important1,.class1a,.class1b,bgurl(https://imgur.com/234kljasdf),bgcolor(white))
   * 
   * into a section description like this one:
   * 
   *     id="this-is-important" class="class1a class1b" 
   *     style="background-color: white; 
   *     background: url('https://imgur.com/234kljasdf') no-repeat center; background-size: cover;">
   * 
   * 
   * @param {string} line contains the codified description line
   */
  #parseSectionAttrs(line) {
    // attrs example:
    // #this-is-important1,.class1a,.class1b,bgurl(https://www.google.com),bgcolor(white)
    let id = '';
    let classes = '';
    let attrs = line.substring('<p><a href=\"'.length,  line.length - '"></a></p>'.length);
    for (let token of attrs.split(',')) {
      if (token.startsWith('.') === true) {
        classes += ' ' + token.replace(/[.]/g, ' ').substring('.'.length);
      } else if (token.startsWith('#') === true) {
        id = token.substring('#'.length);
      } 
    }

    let dataAttrs = {};
    const regex = /(bgurl|bgcolor|chart|bgimg|iframe)(\(.*?\))/g;
    let m;
    while ((m = regex.exec(attrs)) !== null) {
      const matches = m.filter(v=>v!==undefined && v!=='');
      const attrName = matches[matches.length-2];
      const attrValue= matches[matches.length-1];
      dataAttrs[attrName] = attrValue.substring(1, attrValue.length-1); // remove parenthesis
      if (m.index === regex.lastIndex)  regex.lastIndex++;
    }    

    return {id, classes: classes.trim(), dataAttrs};
  }




  /**
   * 
   * Quick and dirty markdown to slide transformation. This implementation is the result of my lack
   * of ability to properly understand the [markdownit](https://github.com/markdown-it/markdown-it) extension mechanism.
   * A well implemented alternative would more than welcomed, if you are in the mood ;-)
   * 
   * @param {string} htmlWithLinks contains the HTML document with the slides, but without the section
   * elements. Instead, there will be the anchores generated by the empty links in the markdown.
   */
  #replaceEmptyLinksWithSections(htmlWithLinks) {
    let slideIterator = htmlWithLinks.matchAll(/<p><a(.*?)href=(((?!img).)*?)\"><\/a><\/p>/g);
    let htmlWithSections = '';
    let oldChunkIndex = 0;
    let slideConfig;
    do {
      slideConfig = slideIterator.next();
      if (slideConfig.done === true) {
        htmlWithSections += htmlWithLinks.substring(oldChunkIndex, htmlWithLinks.length);
      } else if (slideConfig.value[0].length > 0) {
        htmlWithSections += htmlWithLinks.substring(oldChunkIndex, slideConfig.value.index);
        
        if (htmlWithSections.length > 0) {
          htmlWithSections += '</section>\n';
        }
        const attrs = this.#parseSectionAttrs(slideConfig.value[0]);
        let dataAttrs='';
        for (let k of Object.keys(attrs.dataAttrs)) {
          dataAttrs += `data-${k}="${attrs.dataAttrs[k]}"`;
          attrs.classes += ' ' + k;
        }
        htmlWithSections += `<section id='${attrs.id}' class='${attrs.classes}' ${dataAttrs}>`;
        oldChunkIndex = slideConfig.value.index + slideConfig.value[0].length;
      }
    } while (slideConfig.done !== true);
    htmlWithSections += '</section>'
    return htmlWithSections;
  }

  /**
   * If baseUrl is set and the link is NOT absolute, prepend it with
   * the correct prefix.
   * 
   * If the link refers to a video, transform the tag from `<a>` to `<video>`.
   * 
   */
  #markdownImageTransformation(defaultImageRenderer, tokens, idx, options, env, self) {
    let token = tokens[idx];
    let srcIndex = token.attrIndex('src');
    let src = token.attrs[srcIndex][1];

    const fileRE = /\b[^\s<>()]*?.\.(mp4|mkv|avi|jpg|gif|png|jpeg|svg)\b/gi
    const fileResult = fileRE.exec(src);

    if (fileResult !== null && fileResult[0].startsWith('http') === false && this.baseUrl) {
      token.attrs[srcIndex][1] = src.replace(fileResult[0], this.baseUrl + fileResult[0]);
      src = token.attrs[srcIndex][1];
    }

    const vidRE = /\b[^\s<>()]*?.\.(mp4|mkv|avi)\b/gi
    const vidREResult = vidRE.exec(src);
    if (vidREResult !== null) {
      let poster = src.replace(vidREResult[1], 'jpg');
      const html = `<video src="${src}" poster="${poster}"></video>\n`;
      return html;      
    }

    // pass token to default renderer.
    return defaultImageRenderer(tokens, idx, options, env, self);
  }

  #markdownLinkTransformation(defaultLinkRenderer, tokens, idx, options, env, self) {
    var hrefIdx = tokens[idx].attrIndex('href');
    let href = tokens[idx].attrs[hrefIdx][1];
    const fileRE = /\b[^\s<>()]*?.\.(mp4|mkv|avi|jpg|gif|png|jpeg|svg)\b/gi
    const fileResult = fileRE.exec(href);

    if (fileResult !== null && fileResult[0].startsWith('http') === false && this.baseUrl) {
      tokens[idx].attrs[hrefIdx][1] = href.replace(fileResult[0], this.baseUrl + fileResult[0]);
    }
    return defaultLinkRenderer(tokens, idx, options, env, self);
  }

  /**
   * 
   * Wraps every text node in a <span> element for easier CSS control.
   * 
   * @param {*} defaultRenderer used to create text nodes
   * @param {Array} tokens are the group of tokens being processed 
   * @param {*} idx the index of the token in the `tokens` attribute currently being rendered
   * @param {*} options 
   * @param {*} env 
   * @param {*} self 
   * @returns 
   */
  #markdownTextTransformation(defaultRenderer, tokens, idx, options, env, self) {
    return `<span>${tokens[idx].content}</span>`;
  }

  /**
   * Do the magic: transform the stored markdown into html. 
   * Currently using [markdownit](https://github.com/markdown-it/markdown-it)
   * and [markdown-it renderer update](https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer).
   */
  convert() {
    let md = MarkdownIt();
    md.use(markdownItFootnotePlugin)
      .use(codePlugin, {
        
      })
      .use(blockImagePlugin, {
        outputContainer : 'div'
      })
      .use(containerPlugin, 'notes', {
        validate: function(params) {
          const result = params.trim().match(/^notes$/i);
          return result;
        },
      
        render: function (tokens, idx) {
          var m = tokens[idx].info.trim().match(/^notes$/i);
      
          if (tokens[idx].nesting === 1) {
            return '<div class="slide-notes">';
          } else {
            return '</div>\n';
          }
        }
      });
    let defaultImageRenderer = md.renderer.rules.image;
    md.renderer.rules.image = (tokens, idx, options, env, self) => this.#markdownImageTransformation(defaultImageRenderer, tokens, idx, options, env, self);

    let defaultLinkRenderer = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };
    md.renderer.rules.link_open = (tokens, idx, options, env, self) => this.#markdownLinkTransformation(defaultLinkRenderer, tokens, idx, options, env, self);
    
    let defaultTextRenderer = md.renderer.rules.text;
    md.renderer.rules.text = (tokens, idx, options, env, self) => this.#markdownTextTransformation(defaultTextRenderer, tokens, idx, options, env, self);

    let rawHtml = md.render(this.markdown);
    let processedHtml = this.#replaceEmptyLinksWithSections(rawHtml);
    this.html = processedHtml;
    console.log(this.html)
  }
}

export { MarkdownToHTML };