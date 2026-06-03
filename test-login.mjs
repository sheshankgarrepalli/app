import puppeteer from 'puppeteer';

const URL = 'https://app-j2nelyuvk-sheshanks-projects-5275d9db.vercel.app';

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.setDefaultTimeout(20000);

  const allCalls = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('/api/')) {
      const status = resp.status();
      try {
        const ct = resp.headers()['content-type'] || '';
        let body = '';
        if (ct.includes('json')) {
          body = await resp.text();
        }
        allCalls.push({ url: url.replace(URL, ''), status, body: body.slice(0, 300) });
      } catch {}
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      allCalls.push({ url: 'CONSOLE', status: msg.type().toUpperCase(), body: msg.text().slice(0, 300) });
    }
  });

  page.on('pageerror', err => {
    allCalls.push({ url: 'PAGE_ERROR', status: 'ERROR', body: err.message.slice(0, 300) });
  });

  // Step 1: Login page — go to home first
  console.log('1. Going to root...');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  console.log('   URL:', page.url());

  // Step 2: Navigate to inventory
  console.log('2. Going to /admin/inventory...');
  await page.goto(URL + '/admin/inventory', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  console.log('   URL:', page.url());

  // Step 3: Check page content
  const body = await page.evaluate(() => document.body.innerText || '');
  console.log('3. Page text (first 800):');
  console.log(body.slice(0, 800));

  // Step 4: Check for specific elements
  const hasTable = await page.evaluate(() => !!document.querySelector('table'));
  const hasCards = await page.evaluate(() => !!document.querySelector('.kpi-card'));
  const hasLoader = await page.evaluate(() => !!document.querySelector('[class*="spin"]'));
  
  console.log(`\n   Has table: ${hasTable}, Has KPI cards: ${hasCards}, Has loader: ${hasLoader}`);

  // Step 5: Check localStorage for auth
  const storage = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      items[k] = localStorage.getItem(k);
    }
    return items;
  });
  console.log('\n   localStorage:', JSON.stringify(storage, null, 2).slice(0, 500));

  // Print all API calls
  console.log('\n=== ALL API CALLS ===');
  allCalls.forEach(c => {
    console.log(`  ${c.status} | ${c.url} | ${c.body}`);
  });

  await page.screenshot({ path: '/tmp/inventory-debug.png' });
  console.log('\nScreenshot saved');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
