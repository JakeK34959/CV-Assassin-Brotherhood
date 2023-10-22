const fs = require('fs');
const css = require('css');
const { bgurls } = require('./Backgroundsurls'); // Import the bgurls array from Backgroundsurls.js

let lastChoice = '';

function changebackground() {
  let pick = bgurls[Math.floor(Math.random() * bgurls.length)];

  // Ensure that the new pick is different from the last choice
  while (pick === lastChoice) {
    pick = bgurls[Math.floor(Math.random() * bgurls.length)];
  }
  console.log(pick); // Use console.log to print pick

  lastChoice = pick;

  const cssFilePath = 'AssassinBrotherhood.theme.css';
  const cssContent = fs.readFileSync(cssFilePath, 'utf8');

  const ast = css.parse(cssContent);
  const newBackgroundImageUrl = `url("${pick}");`;

  ast.stylesheet.rules.forEach((rule) => {
    if (rule.type === 'rule') {
      rule.declarations.forEach((declaration) => {
        if (declaration.property === '--background-image') {
          declaration.value = newBackgroundImageUrl;
        }
      });
    }
  });

  const modifiedCss = css.stringify(ast);

  fs.writeFile(cssFilePath, modifiedCss, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

// Use setInterval without the while loop
setInterval(changebackground, 5000);
