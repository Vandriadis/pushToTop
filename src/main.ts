import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());
const proxy = {
  host: 'de.922s5.net',
  port: 6300,
  username: '17669994-zone-custom-region-UA-sessid-TkNVHywa',
  password: 'FQORPLVx',
};

const searchQueries = [
  'bet2fun',
  'бет2фан',
  'бет2фан ставки',
  'бет2фан вход',
  'бет2фан скачать',
  'бет2фан зеркало',
  'бет 2 фан',
  'бет ту фан',
];

const targetDomains = [
  'info-bet2fun.com',
  'betmaniaua.com',
  'bet2fun-bonus.com',
  'bet-2.fun',
  'bet2fun-sport.pro',
  'bet2fun-casino.online',
];

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced user agents with more variety
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

// Function to generate random mouse movement path
async function moveMouseRandomly(page: any) {
  const viewport = await page.viewport();
  const points = [];
  const numPoints = getRandomInt(3, 7);
  
  for (let i = 0; i < numPoints; i++) {
    points.push({
      x: getRandomInt(0, viewport.width),
      y: getRandomInt(0, viewport.height)
    });
  }

  for (const point of points) {
    await page.mouse.move(point.x, point.y, { steps: getRandomInt(25, 50) });
    await delay(getRandomInt(100, 300));
  }
}

// Function to simulate human-like scrolling
async function humanLikeScroll(page: any) {
  const viewport = await page.viewport();
  const maxScrolls = getRandomInt(3, 7);
  
  for (let i = 0; i < maxScrolls; i++) {
    const scrollAmount = getRandomInt(100, 300);
    await page.evaluate((amount: number) => {
      window.scrollBy({
        top: amount,
        behavior: 'smooth'
      });
    }, scrollAmount);
    await delay(getRandomInt(800, 2000));
  }
}

// Function to simulate random typing patterns
async function humanLikeType(page: any, selector: string, text: string) {
  await page.waitForSelector(selector);
  await page.click(selector);
  
  for (const char of text) {
    await page.type(selector, char, { delay: getRandomInt(50, 150) });
    if (Math.random() < 0.1) { // 10% chance of a longer pause
      await delay(getRandomInt(200, 500));
    }
  }
}

async function run() {
  const args = [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-site-isolation-trials',
    `--proxy-server=${proxy.host}:${proxy.port}`,
  ];

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args,
  });

  const page = await browser.newPage();

  // Enhanced stealth measures
  await page.evaluateOnNewDocument(() => {
    // Override navigator properties
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' }
      ],
    });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => getRandomInt(4, 8) });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => getRandomInt(4, 8) });

    // Mock permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({
            name: 'notifications',
            state: Notification.permission === 'default' ? 'prompt' : Notification.permission,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true
          } as PermissionStatus)
        : originalQuery(parameters);

    // Fix for chrome.runtime being undefined
    Object.defineProperty(window, 'chrome', {
      get: () => ({
        runtime: {},
        loadTimes: () => {},
        csi: () => {},
        app: {}
      }),
    });

    // Mock userAgentData
    Object.defineProperty(navigator, 'userAgentData', {
      get: () => ({
        brands: [
          { brand: 'Chromium', version: '122' },
          { brand: 'Google Chrome', version: '122' },
          { brand: 'Not(A:Brand', version: '24' }
        ],
        mobile: false,
        platform: 'Windows'
      }),
    });
  });

  // Set random viewport with more realistic dimensions
  await page.setViewport({
    width: getRandomInt(1366, 1920),
    height: getRandomInt(768, 1080),
    deviceScaleFactor: getRandomInt(1, 2),
    isMobile: false,
    hasTouch: false,
    isLandscape: true,
  });

  if (proxy.username && proxy.password) {
    await page.authenticate({
      username: proxy.username,
      password: proxy.password,
    });
  }

  // Set random user agent
  await page.setUserAgent(userAgents[getRandomInt(0, userAgents.length - 1)]);

  // Set cookies and local storage with error handling
  try {
    await page.evaluate(() => {
      try {
        localStorage.setItem('visited', 'true');
        localStorage.setItem('lastVisit', new Date().toISOString());
      } catch (e) {
        // Ignore localStorage errors as they're not critical
        console.log('LocalStorage access restricted - continuing without it');
      }
    });
  } catch (e) {
    console.log('Error setting localStorage - continuing without it');
  }

  for (const searchQuery of searchQueries) {
    try {
      console.log(`🔍 Поиск: "${searchQuery}"`);
      
      // Visit Google homepage first
      await page.goto('https://www.google.com/', { 
        waitUntil: 'networkidle0',
        timeout: 60000 
      });
      
      // Simulate human-like behavior before searching
      await moveMouseRandomly(page);
      await delay(getRandomInt(1000, 3000));
      
      // Type search query with human-like patterns
      await humanLikeType(page, 'textarea[name="q"]', searchQuery);
      await delay(getRandomInt(500, 1500));
      
      // Press Enter with random delay
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ 
        waitUntil: 'networkidle0',
        timeout: 60000 
      });

      // Simulate natural browsing behavior
      await moveMouseRandomly(page);
      await humanLikeScroll(page);
      await delay(getRandomInt(2000, 4000));

      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a')).map(a => a.href)
      );

      const found = targetDomains.map(domain => {
        const index = links.findIndex(link => link.includes(domain));
        return {
          domain,
          position: index >= 0 ? index + 1 : 'Not found',
        };
      });

      const screenshotPath = path.resolve(`search-${searchQuery}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      found.forEach(result => {
        console.log(`${result.domain}: ${result.position}`);
      });

      // Random delay between searches
      await delay(getRandomInt(5000, 10000));
    } catch (error) {
      console.error(`Error processing search query "${searchQuery}":`, error);
      // Continue with next query even if current one fails
      continue;
    }
  }

  try {
    await browser.close();
  } catch (error) {
    console.error('Error closing browser:', error);
  }
}

// Add error handling for the main run function
run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
