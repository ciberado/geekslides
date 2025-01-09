const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');

// Initialize markdown-it
const md = new MarkdownIt();

// Read the Markdown file
const inputFile = '/home/ubuntu/projects/decks/50hz/slides/README.md';
const outputFile = '/tmp/output.md';
const content = fs.readFileSync(inputFile, 'utf8');

// Function to process image tokens
function processImageTokens(tokens) {
  return tokens.map(token => {
    if (token.type === 'inline') {
      token.children = token.children.map(child => {
        if (child.type === 'image') {
          // Uppercase alt text
          const altIndex = child.attrIndex('alt');
          if (altIndex !== -1) {
            child.attrs[altIndex][1] = child.attrs[altIndex][1].toUpperCase();
          }
          
          // Ensure src is absolute
          const srcIndex = child.attrIndex('src');
          if (srcIndex !== -1) {
            const src = child.attrs[srcIndex][1];
            if (!src.startsWith('http://') && !src.startsWith('https://')) {
              child.attrs[srcIndex][1] = path.resolve(process.cwd(), src);
            }
          }
          
          // Reconstruct the image markdown
          const alt = child.attrs[altIndex][1];
          const src = child.attrs[srcIndex][1];
          child.content = `![${alt}](${src})`;
        }
        return child;
      });
    }
    return token;
  });
}

// Process the tokens
const tokens = md.parse(content, {});
const processedTokens = processImageTokens(tokens);

// Convert tokens back to Markdown
let result = '';
processedTokens.forEach(token => {
  if (token.type === 'inline') {
    result += token.children.map(child => child.content).join('\n');
  } else if (token.type === 'fence') {
    result += '``````\n\n';
  } else {
    result += token.content;
  }
});

// Write the result to a new file
fs.writeFileSync(outputFile, result);

console.log(`Modified Markdown written to ${outputFile}`);
