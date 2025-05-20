import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { Solver } from '2captcha';
import { getRandomInt, delay, moveMouseRandomly, humanLikeScroll, humanLikeType } from './helpers/puppeteerUtils';
import { extractDomainPositions } from './helpers/searchUtils';
import { searchQueries, targetDomains, userAgents, languages } from './config/constants';
import { proxy } from './config/proxy';
import { API_KEY } from './config/captcha';

puppeteer.use(StealthPlugin());

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
        const found = await extractDomainPositions(page, targetDomains);

        // Если хотя бы один домен найден, делаем скриншот
        if (found.some((result: { domain: string; position: string | number }) => result.position !== 'Not found')) {
          const screenshotPath = path.resolve(`results/search-${searchQuery}-page${pageNum}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
        }

        // Логируем результат для каждой страницы
        found.forEach((result: { domain: string; position: string | number }, idx: number) => {
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
          // Ищем ссылку именно на следующую по номеру страницы
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
