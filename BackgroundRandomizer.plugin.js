/**
 * @name BackgroundRandomizer
 * @author Jake34959
 * @authorId 249963806589976587
 * @version MK.1
 * @description Randomizes the background URL for the theme
 */
const fs = require('fs');
const delay_min = 30 //This sets the time delay, currently it's set to 30 min
const delay = delay_min * 60 * 1000; 
const cssFilePath = ''; //Set this to the directory of the ClearVision_V6.theme.css file

class BackgroundRandomizer {
  constructor() {
    this.intervalId = null;
    this.bgurls = []; // Put the Urls for your backgrounds in here each one like this ["imglink.com/img.jpg", "imglink.com/secondimage.jpg"]
  }

  start() { 
    this.intervalId = setInterval(this.changeBackground.bind(this), delay); 
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  changeBackground() {
    const lastChoice = this.lastChoice || '';
    const pick = this.getRandomBackground();
    console.log(pick);

    while (pick === lastChoice) {
      this.pick = this.getRandomBackground();
    }

    this.lastChoice = pick;
    console.log(pick);

    let cssContent = fs.readFileSync(cssFilePath, 'utf8');

    cssContent = cssContent.replace(/--background-image:\s*url\([^\)]*\);/, `--background-image: url("${pick}");`);

    fs.writeFileSync(cssFilePath, cssContent, 'utf8');
  }

  getRandomBackground() {
    const bgurls = this.bgurls;
    return bgurls[Math.floor(Math.random() * bgurls.length)];
  }
}

module.exports = BackgroundRandomizer;