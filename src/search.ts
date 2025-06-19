import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const proxy = {
  host: 'de.922s5.net',
  port: 6300,
  username: '',
  password: '',
};

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to simulate human-like typing
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

  try {
    const page = await browser.newPage();

    // Enhanced stealth measures
    await page.evaluateOnNewDocument(() => {
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

    // Set random viewport
    await page.setViewport({
      width: getRandomInt(1366, 1920),
      height: getRandomInt(768, 1080),
      deviceScaleFactor: getRandomInt(1, 2),
      isMobile: false,
      hasTouch: false,
      isLandscape: true,
    });

    // Set proxy authentication
    if (proxy.username && proxy.password) {
      await page.authenticate({
        username: proxy.username,
        password: proxy.password,
      });
    }

    // Set user agent
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    ];
    await page.setUserAgent(userAgents[getRandomInt(0, userAgents.length - 1)]);

    console.log('🌐 Opening Google...');
    await page.goto('https://www.google.com/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });

    console.log('⌨️ Typing search query...');
    await humanLikeType(page, 'textarea[name="q"]', 'bet2fun');
    
    console.log('⏳ Waiting for 1 minute...');
    await delay(60000); // Wait for 1 minute

    console.log('✅ Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

// Run the script
run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 
