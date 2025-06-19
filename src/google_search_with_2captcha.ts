import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Solver } from '2captcha';

puppeteer.use(StealthPlugin());

const API_KEY = ''; // <-- Replace with your 2Captcha API key

const proxy = {
  host: 'de.922s5.net',
  port: 6300,
  username: '',
  password: '',
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const args = [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    `--proxy-server=${proxy.host}:${proxy.port}`,
  ];

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args,
  });

  const page = await browser.newPage();

  if (proxy.username && proxy.password) {
    await page.authenticate({
      username: proxy.username,
      password: proxy.password,
    });
  }

  await page.goto('https://www.google.com/search?q=bet2fun', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  await delay(30000);
  // Check for reCAPTCHA
  const recaptchaFrame = await page
    .frames()
    .find(f => f.url().includes('google.com/recaptcha/api2/anchor'));

  if (recaptchaFrame) {
    console.log('reCAPTCHA detected!');

    // Extract sitekey and data-s
    const sitekey = await page.$eval('.g-recaptcha', el => el.getAttribute('data-sitekey'));
    const dataS = await page.$eval('.g-recaptcha', el => el.getAttribute('data-s'));
    const pageurl = page.url();

    if (!sitekey || !dataS) {
      throw new Error('Could not extract sitekey or data-s');
    }

    // Solve with 2Captcha
    const solver = new Solver(API_KEY);

    console.log('Submitting to 2Captcha...');
    const { data } = await solver.recaptcha(
      sitekey,
      pageurl,
      {
        'data-s': dataS,
        proxy: `${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`,
        proxytype: 'HTTP', // or 'HTTPS' if your proxy supports it
      }
    );

    const token = data;

    // Inject token and submit
    await page.evaluate(token => {
      const textarea = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = token;
        // If the textarea is hidden, make it visible for form submission
        textarea.style.display = '';
      }
      // Submit the form
      const form = textarea?.closest('form');
      if (form) {
        form.submit();
      }
    }, token);

    console.log('Submitted token, waiting for navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Bypassed reCAPTCHA!');
  } else {
    console.log('No reCAPTCHA detected, search page loaded.');
  }

  // Now you can continue with your search logic...
  await delay(10000); // Wait 10 seconds to observe result
  await browser.close();
}

run().catch(console.error);
