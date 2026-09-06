import puppeteer from 'puppeteer-core';

const ZOOM_STEPS = Number(process.argv[2] ?? 3);

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = '/Users/davidwells/Projects/Web/Landing-Page-Template/public/assets/progression.png';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--force-color-profile=srgb', '--hide-scrollbars'],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 2 }
});

const page = await browser.newPage();
await page.goto('http://localhost:1420', { waitUntil: 'networkidle0', timeout: 30000 });

// Load the app's own example project through its real store action — this is a
// screenshot of the actual UI with actual data, not a mockup.
await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/store/projectStore.ts');
  const { normalizeProjectFile } = await import('/src/types/project.ts');
  const raw = await (await fetch('/examples/branching-adventure.gpproj')).json();
  useProjectStore.getState().openProject(normalizeProjectFile(raw), 'branching-adventure.gpproj');
});
await new Promise(r => setTimeout(r, 800));
await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/store/projectStore.ts');
  useProjectStore.getState().applyAutoLayout();
});
await new Promise(r => setTimeout(r, 800));

// Fit first, then centre on the branch that re-converges (Crossroads -> North
// Pass / South Marsh -> Ruined Keep) and zoom until stage names are readable.
// Fit alone squeezes all 12 stages into the width and the nodes become a smear.
for (const b of await page.$$('button')) {
  if ((await page.evaluate(el => el.textContent.trim(), b)) === 'Fit') { await b.click(); break; }
}
await new Promise(r => setTimeout(r, 600));

await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/store/projectStore.ts');
  useProjectStore.getState().focusNode('n5');   // South Marsh, mid-branch
});
await new Promise(r => setTimeout(r, 600));

const zoomIn = await page.$('.react-flow__controls-zoomin');
for (let i = 0; i < ZOOM_STEPS; i++) { await zoomIn.click(); await new Promise(r => setTimeout(r, 250)); }
await new Promise(r => setTimeout(r, 900));

await page.screenshot({ path: OUT });
console.log('wrote', OUT);
await browser.close();
