import { Page } from 'puppeteer';

export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function moveMouseRandomly(page: Page) {
  const viewport = page.viewport();
  const points = [];
  const numPoints = getRandomInt(3, 7);
  for (let i = 0; i < numPoints; i++) {
    points.push({
      x: getRandomInt(0, viewport?.width ?? 1920),
      y: getRandomInt(0, viewport?.height ?? 1080)
    });
  }
  for (const point of points) {
    await page.mouse.move(point.x, point.y, { steps: getRandomInt(25, 50) });
    await delay(getRandomInt(100, 300));
  }
}

export async function humanLikeScroll(page: Page) {
  const viewport = page.viewport();
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

export async function humanLikeType(page: Page, selector: string, text: string) {
  await page.waitForSelector(selector);
  await page.click(selector);
  for (const char of text) {
    await page.type(selector, char, { delay: getRandomInt(50, 150) });
    if (Math.random() < 0.1) {
      await delay(getRandomInt(200, 500));
    }
  }
} 