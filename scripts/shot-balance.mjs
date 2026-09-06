import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = '/Users/davidwells/Projects/Web/Landing-Page-Template/public/assets/balance.png';

// A believable RPG balance project, built with the app's own Stat/Comparison
// types. Balance ships no example file, so this stands in for one.
const PROJECT = {
  version: 2,
  stats: [
    { id: 's1', name: 'XP to next level', category: 'Progression', type: 'formula',
      domain: { min: 1, max: 60, step: 1 },
      formula: { expression: 'base * x ^ exponent', parameters: { base: 100, exponent: 1.8 } },
      notes: 'Superlinear on purpose — late levels should feel earned, not granted.' },
    { id: 's2', name: 'Player damage', category: 'Combat', type: 'formula',
      domain: { min: 1, max: 60, step: 1 },
      formula: { expression: 'base + x * scaling', parameters: { base: 12, scaling: 4.5 } } },
    { id: 's3', name: 'Enemy HP', category: 'Combat', type: 'formula',
      domain: { min: 1, max: 60, step: 1 },
      formula: { expression: 'base * x ^ curve', parameters: { base: 30, curve: 1.35 } } },
    { id: 's4', name: 'Rare drop chance', category: 'Loot', type: 'points',
      domain: { min: 1, max: 60, step: 1 },
      points: [ {x:1,y:0.5},{x:10,y:1.2},{x:20,y:2.0},{x:35,y:3.5},{x:50,y:5.0},{x:60,y:6.5} ] }
  ],
  comparisons: [ { id: 'c1', name: 'Player damage vs Enemy HP', statIds: ['s2', 's3'] } ]
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--force-color-profile=srgb', '--hide-scrollbars'],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 2 }
});

const page = await browser.newPage();
await page.goto('http://localhost:1421', { waitUntil: 'networkidle0', timeout: 30000 });

await page.evaluate(async (project) => {
  const { useProjectStore } = await import('/src/store/projectStore.ts');
  const { normalizeProjectFile } = await import('/src/types/project.ts');
  useProjectStore.getState().openProject(normalizeProjectFile(project), 'rpg-curves.gbproj');
  useProjectStore.getState().selectStat('s1');   // the formula + sliders view
}, PROJECT);

await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: OUT });
console.log('wrote', OUT);
await browser.close();
