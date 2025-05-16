import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { Solver } from '2captcha';

puppeteer.use(StealthPlugin());

const API_KEY = '073a33ff8679b4d94d77dd436c287d4f'; // <-- Replace with your 2Captcha API key
const proxy = {
  host: 'de.922s5.net',
  port: 6300,
  username: '17669994-zone-custom-region-UA-sessid-fgmPp8Iz',
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

  // --- ДОБАВЛЕНО: Работа с cookies (сохраняем и подгружаем между сессиями) ---
  const cookiesPath = path.resolve('cookies.json');
  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
    await page.setCookie(...cookies);
  }

  // --- ДОБАВЛЕНО: Рандомизация языка браузера ---
  const languages = [
    ['ru-RU', 'ru', 'en-US', 'en'],
    ['uk-UA', 'uk', 'en-US', 'en'],
    ['en-US', 'en'],
    ['ru', 'en'],
    ['uk', 'en']
  ];
  await page.setExtraHTTPHeaders({
    'Accept-Language': languages[getRandomInt(0, languages.length - 1)].join(',')
  });

  for (const searchQuery of searchQueries) {
    try {
      console.log(`🔍 Поиск: "${searchQuery}"`);
      await page.goto('https://www.google.com/', { 
        waitUntil: 'networkidle0',
        timeout: 60000 
      });
      await moveMouseRandomly(page);
      await delay(getRandomInt(1000, 3000));
      await humanLikeType(page, 'textarea[name="q"]', searchQuery);
      await delay(getRandomInt(500, 1500));
      await page.keyboard.press('Enter');
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.waitForSelector('div#search', { timeout: 15000 }).catch(() => {})
      ]);

      // --- Проверка и решение reCAPTCHA ---
      const recaptchaFrame = await new Promise(resolve => {
        const interval = setInterval(() => {
          const frame = page.frames().find(f => f.url().includes('google.com/recaptcha/api2/anchor'));
          if (frame) {
            clearInterval(interval);
            resolve(frame);
          }
        }, 500);
        setTimeout(() => {
          clearInterval(interval);
          resolve(null);
        }, 30000); // 30 секунд
      });

      if (recaptchaFrame) {
        console.log('reCAPTCHA detected!');
        // Пробуем найти sitekey и data-s
        const sitekey = await page.$eval('.g-recaptcha', el => el.getAttribute('data-sitekey'));
        const dataS = await page.$eval('.g-recaptcha', el => el.getAttribute('data-s'));
        const pageurl = page.url();
        if (!sitekey || !dataS) {
          throw new Error('Could not extract sitekey or data-s');
        }
        const solver = new Solver(API_KEY);
        console.log('Submitting to 2Captcha...');
        const { data } = await solver.recaptcha(
          sitekey,
          pageurl,
          {
            'data-s': dataS,
            proxy: `${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`,
            proxytype: 'HTTP',
          }
        );
        const token = data;
        await page.evaluate(token => {
          const textarea = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
          if (textarea) {
            textarea.value = token;
            textarea.style.display = '';
          }
          const form = textarea?.closest('form');
          if (form) {
            form.submit();
          }
        }, token);
        console.log('Submitted token, waiting for navigation...');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
        console.log('Bypassed reCAPTCHA!');
      }

      // --- Новый цикл по страницам ---
      let pageNum = 1;
      let foundDomains = targetDomains.map(domain => ({ domain, position: 'Not found' as string, page: null as number | null }));
      let maxPages = 7; // Максимум страниц для проверки
      let stop = false;
      while (pageNum <= maxPages && !stop) {
        await moveMouseRandomly(page);
        await humanLikeScroll(page);
        await delay(getRandomInt(2000, 4000));

        // Проверяем позиции доменов
        const found = await page.evaluate((targetDomains) => {
          const citeNodes = Array.from(document.querySelectorAll('cite'));
          const citeTexts = citeNodes.map(node => (node.textContent ? node.textContent.trim() : ''));
          return targetDomains.map(domain => {
            const index = citeTexts.findIndex(text => text.includes(domain));
            return {
              domain,
              position: index >= 0 ? index + 1 : 'Not found',
            };
          });
        }, targetDomains);

        // Если хотя бы один домен найден, делаем скриншот
        if (found.some(result => result.position !== 'Not found')) {
          const screenshotPath = path.resolve(`results/search-${searchQuery}-page${pageNum}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
        }

        // Логируем результат для каждой страницы
        found.forEach((result, idx) => {
          if (result.position !== 'Not found' && foundDomains[idx].position === 'Not found') {
            foundDomains[idx] = { domain: result.domain, position: String(result.position), page: pageNum };
            console.log(`${result.domain} page=${pageNum} place=${result.position}`);
          }
        });

        // Проверяем, остались ли ещё не найденные домены
        const hasUnfound = foundDomains.some(d => d.position === 'Not found');
        if (!hasUnfound) {
          stop = true;
          break;
        }

        // Переход на следующую страницу
        const nextPageHref = await page.evaluate((pageNum) => {
          // Ищем ссылку именно на следующую по номеру страницу
          const next = Array.from(document.querySelectorAll('a[aria-label]'))
            .find(a => a.getAttribute('aria-label') === `Page ${pageNum + 1}`);
          return next ? (next as HTMLAnchorElement).href : null;
        }, pageNum);
        if (nextPageHref) {
          await Promise.all([
            page.goto(nextPageHref, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
            page.waitForSelector('div#search', { timeout: 20000 }).catch(() => {})
          ]);
          pageNum++;
          await delay(getRandomInt(1000, 2000));
        } else {
          break;
        }
      }

      // Если домен не найден ни на одной странице, логируем Not found
      foundDomains.forEach(result => {
        if (result.position === 'Not found') {
          console.log(`${result.domain} Not found`);
        }
      });

      // --- ДОБАВЛЕНО: Сохраняем cookies после каждого поиска ---
      const cookies = await page.cookies();
      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
      await delay(getRandomInt(5000, 10000));
    } catch (error) {
      console.error(`Error processing search query "${searchQuery}":`, error);
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
