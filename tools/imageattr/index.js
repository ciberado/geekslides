const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();

function extractAltTexts(markdown) {
    let altTexts = [];

    function extractAltTexts(tokens) {
         for (let i = 0; i < tokens.length; i++) {
            const currentToken = tokens[i];
            if (currentToken.type === 'image') {
                const src = currentToken.attrs.filter(a=>a[0]==='src')[0][1];
                const alt = currentToken.children.filter(c => c.type==='text')[0].content;
                altTexts.push({src, alt});
            } 
            if (currentToken.children) { 
                extractAltTexts(currentToken.children);
            }
        }    
    }

    const tokens = md.parseInline(markdown, {});
    extractAltTexts(tokens);
    return altTexts;
}

console.log(extractAltTexts('![hello how are you](https://example.com/image.jpg)'));