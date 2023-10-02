// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

// import * as fs from 'fs';
// import * as path from 'path';

// generate icon names array from icon folder
// icons folder is located in the root of the project
function generateIconsArray() {
  const icons = fs.readdirSync(path.join(__dirname, '../assets/crypto-icons'));
  return icons.map((icon) => icon.replace('.svg', ''));
}

const icons = generateIconsArray();
const json =JSON.stringify(icons);
console.log(json);
console.log(path.join(__dirname, '../assets/crypto-icons.json'));

fs.writeFileSync(path.join(__dirname, './crypto-icons.json'), json);
