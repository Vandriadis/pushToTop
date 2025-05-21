import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Solver } from '2captcha';
import { API_KEY } from './config/captcha.js';
import { proxy } from './config/proxy.js';
import { searchQueries, targetDomains, userAgents, languages } from './config/constants.js';
import { getRandomInt, delay, moveMouseRandomly, humanLikeScroll, humanLikeType } from './helpers/puppeteerUtils.js';
import { extractDomainPositions } from './helpers/searchUtils.js';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`);
  
  return parts.join(', ');
}

// Main functionality
async function handleCaptcha(page: Page): Promise<boolean> {
  try {
    const solver = new Solver(API_KEY);
    
    // Check for reCAPTCHA
    const recaptchaFrame = await new Promise(resolve => {
      const interval = setInterval(() => {
        const frame = page.frames().find((f: { url: () => string }) => f.url().includes('google.com/recaptcha/api2/anchor'));
        if (frame) {
          clearInterval(interval);
          resolve(frame);
        }
      }, 500);
      setTimeout(() => {
        clearInterval(interval);
        resolve(null);
      }, 5000);
    });

    if (recaptchaFrame) {
      console.log('reCAPTCHA detected!');
      // Try to find sitekey and data-s
      const sitekey = await page.$eval('.g-recaptcha', (el: Element) => el.getAttribute('data-sitekey'));
      const dataS = await page.$eval('.g-recaptcha', (el: Element) => el.getAttribute('data-s'));
      const pageurl = page.url();
      
      if (!sitekey || !dataS) {
        console.log('Could not extract sitekey or data-s, trying alternative method...');
        // Try alternative method to find reCAPTCHA elements
        const recaptchaElement = await page.$('.g-recaptcha');
        if (!recaptchaElement) {
          console.log('No reCAPTCHA element found');
          return false;
        }
        return false;
      }

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
      await page.evaluate((token: string) => {
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
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error handling CAPTCHA:', error);
    return false;
  }
}

interface SearchResult {
  domain: string;
  position: number;
  timestamp: string;
  clicked: boolean;
}

const searchResults: SearchResult[] = [];

async function handleDomainClick(page: Page, domain: string, position: number): Promise<boolean> {
  try {
    console.log(`Attempting to click domain: ${domain} at position ${position}`);
    
    // First try to find the domain link using a more robust selector
    const domainLink = await page.evaluate((domain: string) => {
      const links = Array.from(document.querySelectorAll('a[href*="' + domain + '"]'));
      if (links.length > 0) {
        return (links[0] as HTMLAnchorElement).href;
      }
      return null;
    }, domain);

    if (!domainLink) {
      console.log(`Could not find link for domain: ${domain}`);
      return false;
    }

    console.log(`Found link for domain: ${domainLink}`);
    
    // Move mouse randomly before clicking
    await moveMouseRandomly(page);
    await delay(getRandomInt(500, 1500));

    // Find the link element and get its position with more precise targeting
    const linkPosition = await page.evaluate((domain: string) => {
      const links = Array.from(document.querySelectorAll('a[href*="' + domain + '"]'));
      if (links.length > 0) {
        const link = links[0];
        const rect = link.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          visible: rect.top >= 0 && rect.left >= 0 && 
                  rect.bottom <= window.innerHeight && 
                  rect.right <= window.innerWidth
        };
      }
      return null;
    }, domain);

    if (linkPosition) {
      if (!linkPosition.visible) {
        console.log('Link is not visible, scrolling to it...');
        await page.evaluate((domain: string) => {
          const link = document.querySelector('a[href*="' + domain + '"]');
          if (link) link.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, domain);
        await delay(getRandomInt(1000, 2000));
      }

      // Move mouse to link with human-like movement
      await page.mouse.move(
        linkPosition.x + getRandomInt(-5, 5),
        linkPosition.y + getRandomInt(-5, 5),
        { steps: getRandomInt(25, 50) }
      );
      await delay(getRandomInt(300, 800));
      
      // Click with slight random offset
      await page.mouse.click(
        linkPosition.x + getRandomInt(-2, 2),
        linkPosition.y + getRandomInt(-2, 2)
      );
      
      // Wait for navigation to start
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        page.waitForSelector('body', { timeout: 30000 })
      ]);

      // Record the click in search results
      searchResults.push({
        domain,
        position,
        timestamp: new Date().toISOString(),
        clicked: true
      });
    } else {
      console.log('Could not find link position, trying direct navigation...');
      await page.goto(domainLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    
    // Wait for potential modal and close it
    try {
      await page.waitForSelector('xpath=//*[@id="modals-container"]/div/div/div[2]/div/button', { timeout: 5000 });
      await moveMouseRandomly(page);
      await delay(getRandomInt(500, 1000));
      await page.locator('xpath=//*[@id="modals-container"]/div/div/div[2]/div/button').click();
      console.log('Modal closed successfully');
    } catch (error) {
      console.log('No modal found or already closed');
    }

    // Stay on site for 100 seconds with random interactions
    console.log('Staying on site for 100 seconds...');
    const startTime = Date.now();
    const visitDuration = 100000; // 100 seconds in milliseconds
    
    while (Date.now() - startTime < visitDuration) {
      // Perform random interactions
      await moveMouseRandomly(page);
      await humanLikeScroll(page);
      
      // Try to click random links occasionally
      if (Math.random() < 0.3) { // 30% chance to click a link
        try {
          const links = await page.$$('a');
          if (links.length > 0) {
            const randomLink = links[Math.floor(Math.random() * links.length)];
            const isVisible = await randomLink.isVisible();
            if (isVisible) {
              await randomLink.click();
              await delay(getRandomInt(2000, 5000));
              await page.goBack();
            }
          }
        } catch (error) {
          console.log('Error clicking random link:', error);
        }
      }
      
      // Add some random pauses between interactions
      const remainingTime = visitDuration - (Date.now() - startTime);
      const delayTime = Math.min(getRandomInt(2000, 5000), remainingTime);
      await delay(delayTime);
      
      // Log progress every 20 seconds
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      if (elapsedSeconds % 20 === 0) {
        console.log(`Still on site: ${elapsedSeconds} seconds elapsed`);
      }
    }

    // Random delay before going back
    await delay(getRandomInt(1000, 2000));
    
    // Move mouse randomly before clicking back
    await moveMouseRandomly(page);
    await delay(getRandomInt(500, 1000));
    
    // Go back to search results
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await delay(getRandomInt(1000, 2000));
    
    console.log(`Successfully completed visit to ${domain}`);
    return true;
  } catch (error) {
    console.error(`Error handling domain click for ${domain}:`, error);
    return false;
  }
}

async function performSearch(page: Page, searchQuery: string, isFirstSearch: boolean): Promise<void> {
  try {
    console.log(`\n🔍 Starting search: "${searchQuery}"`);
    await page.goto('https://www.google.com/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    console.log('✅ Google page loaded');
    
    await moveMouseRandomly(page);
    await delay(getRandomInt(1000, 3000));

    // Wait for search input and ensure it's visible
    console.log('⌛ Waiting for search input...');
    await page.waitForSelector('textarea[name="q"], input[name="q"]', { visible: true, timeout: 10000 });
    console.log('✅ Search input found');
    
    // Clear any existing text
    await page.evaluate(() => {
      const input = document.querySelector('textarea[name="q"], input[name="q"]') as HTMLInputElement;
      if (input) input.value = '';
    });
    
    // Type search query
    console.log('⌨️ Typing search query...');
    await humanLikeType(page, 'textarea[name="q"], input[name="q"]', searchQuery);
    await delay(getRandomInt(500, 1500));
    
    // Ensure the text was entered
    const inputValue = await page.evaluate(() => {
      const input = document.querySelector('textarea[name="q"], input[name="q"]') as HTMLInputElement;
      return input ? input.value : '';
    });
    
    if (inputValue !== searchQuery) {
      console.log('⚠️ Text not entered correctly, retrying...');
      await page.evaluate((query) => {
        const input = document.querySelector('textarea[name="q"], input[name="q"]') as HTMLInputElement;
        if (input) input.value = query;
      }, searchQuery);
    }
    console.log('✅ Search query entered');

    console.log('⌛ Submitting query...');
    await page.keyboard.press('Enter');
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.waitForSelector('div#search', { timeout: 15000 }).catch(() => {})
    ]);
    console.log('✅ Search results loaded');

    // Check for reCAPTCHA
    console.log('🔍 Checking for reCAPTCHA...');
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
      }, 30000);
    });

    if (recaptchaFrame) {
      console.log('⚠️ reCAPTCHA detected!');
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
    } else {
      console.log('✅ No reCAPTCHA found');
    }

    // Start checking pages
    let pageNum = 1;
    let foundDomains = targetDomains.map(domain => ({ domain, position: 'Not found' as string, page: null as number | null }));
    let maxPages = 7;
    let stop = false;
    
    console.log(`\n📄 Starting page check (max ${maxPages} pages)`);
    
    while (pageNum <= maxPages && !stop) {
      console.log(`\n📄 Checking page ${pageNum}`);
      await moveMouseRandomly(page);
      await humanLikeScroll(page);
      await delay(getRandomInt(2000, 4000));

      // Check domain positions
      console.log('🔍 Searching for domains on page...');
      const found = await extractDomainPositions(page, targetDomains);
      console.log(`✅ Domains found on page: ${found.filter((r: { domain: string; position: string | number }) => r.position !== 'Not found').length}`);

      // Take screenshot if domains found
      if (found.some((result: { domain: string; position: string | number }) => result.position !== 'Not found')) {
        const screenshotPath = `results/search-${searchQuery}-page${pageNum}.png` as const;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot saved: ${screenshotPath}`);
      }

      // Process found domains
      for (const result of found) {
        if (result.position !== 'Not found') {
          const idx = foundDomains.findIndex(d => d.domain === result.domain);
          if (idx !== -1 && foundDomains[idx].position === 'Not found') {
            foundDomains[idx] = { domain: result.domain, position: String(result.position), page: pageNum };
            console.log(`\n🎯 Domain found: ${result.domain}`);
            console.log(`📍 Position: ${result.position}`);
            console.log(`📄 Page: ${pageNum}`);
            
            // Find domain link
            console.log('🔍 Looking for domain link...');
            const domainLink = await page.evaluate((domain: string) => {
              const links = Array.from(document.querySelectorAll('a[href*="' + domain + '"]'));
              if (links.length > 0) {
                return (links[0] as HTMLAnchorElement).href;
              }
              return null;
            }, result.domain);

            if (domainLink) {
              console.log(`✅ Link found: ${domainLink}`);
              console.log(`🔄 Visiting domain: ${result.domain}`);
              
              // Human-like behavior before clicking
              await moveMouseRandomly(page);
              await delay(getRandomInt(500, 1500));

              // Find link position
              const linkPosition = await page.evaluate((domain: string) => {
                const links = Array.from(document.querySelectorAll('a[href*="' + domain + '"]'));
                if (links.length > 0) {
                  const link = links[0];
                  const rect = link.getBoundingClientRect();
                  return {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    visible: rect.top >= 0 && rect.left >= 0 && 
                            rect.bottom <= window.innerHeight && 
                            rect.right <= window.innerWidth
                  };
                }
                return null;
              }, result.domain);

              if (linkPosition) {
                if (!linkPosition.visible) {
                  console.log('📜 Link not visible, scrolling to it...');
                  await page.evaluate((domain: string) => {
                    const link = document.querySelector('a[href*="' + domain + '"]');
                    if (link) link.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, result.domain);
                  await delay(getRandomInt(1000, 2000));
                }

                // Human-like mouse movement and click
                console.log('🖱️ Moving mouse to link...');
                await page.mouse.move(
                  linkPosition.x + getRandomInt(-5, 5),
                  linkPosition.y + getRandomInt(-5, 5),
                  { steps: getRandomInt(25, 50) }
                );
                await delay(getRandomInt(300, 800));
                
                console.log('🖱️ Clicking link...');
                await page.mouse.click(
                  linkPosition.x + getRandomInt(-2, 2),
                  linkPosition.y + getRandomInt(-2, 2)
                );
                
                // Wait for navigation with better error handling
                console.log('⌛ Waiting for page load...');
                try {
                  await Promise.race([
                    page.waitForNavigation({ 
                      waitUntil: ['domcontentloaded', 'networkidle0'],
                      timeout: 30000 
                    }),
                    page.waitForSelector('body', { timeout: 30000 })
                  ]);
                  
                  // Verify we actually navigated to the domain
                  const currentUrl = await page.url();
                  console.log(`📍 Current URL: ${currentUrl}`);
                  
                  if (!currentUrl.includes(result.domain)) {
                    console.log('⚠️ Navigation might have failed, trying direct navigation...');
                    await page.goto(domainLink, { 
                      waitUntil: ['domcontentloaded', 'networkidle0'],
                      timeout: 30000 
                    });
                  }

                  // Wait for page to be fully loaded
                  await page.waitForFunction(() => {
                    return document.readyState === 'complete';
                  }, { timeout: 30000 });
                  
                  console.log('✅ Page loaded successfully');

                  // Close modal if exists
                  try {
                    console.log('🔍 Checking for modal...');
                    await page.waitForSelector('xpath=//*[@id="modals-container"]/div/div/div[2]/div/button', { timeout: 5000 });
                    await moveMouseRandomly(page);
                    await delay(getRandomInt(500, 1000));
                    await page.locator('xpath=//*[@id="modals-container"]/div/div/div[2]/div/button').click();
                    console.log('✅ Modal closed');
                  } catch (error) {
                    console.log('ℹ️ Modal not found or already closed');
                  }

                  // Spend time on site
                  console.log('⏳ Spending time on site 100 seconds...');
                  const startTime = Date.now();
                  const visitDuration = 100000; // 100 seconds
                  
                  while (Date.now() - startTime < visitDuration) {
                    // Random actions
                    await moveMouseRandomly(page);
                    await humanLikeScroll(page);
                    
                    // Random clicks on links
                    if (Math.random() < 0.3) {
                      try {
                        const links = await page.$$('a');
                        if (links.length > 0) {
                          const randomLink = links[Math.floor(Math.random() * links.length)];
                          const isVisible = await randomLink.isVisible();
                          if (isVisible) {
                            console.log('🖱️ Clicking random link...');
                            await randomLink.click();
                            await delay(getRandomInt(2000, 5000));
                            console.log('↩️ Going back...');
                            await page.goBack();
                            await delay(getRandomInt(1000, 2000));
                          }
                        }
                      } catch (error) {
                        console.log('⚠️ Error clicking random link:', error);
                      }
                    }
                    
                    const remainingTime = visitDuration - (Date.now() - startTime);
                    const delayTime = Math.min(getRandomInt(2000, 5000), remainingTime);
                    await delay(delayTime);
                    
                    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                    if (elapsedSeconds % 20 === 0) {
                      console.log(`⏱️ Elapsed ${elapsedSeconds} seconds`);
                    }
                  }

                  // Go back to search results
                  console.log('↩️ Going back to search results...');
                  await delay(getRandomInt(1000, 2000));
                  await moveMouseRandomly(page);
                  await delay(getRandomInt(500, 1000));
                  await page.goBack({ waitUntil: 'domcontentloaded' });
                  await delay(getRandomInt(1000, 2000));
                  
                  console.log(`✅ Successfully completed visit to ${result.domain}`);
                } catch (error) {
                  console.error('❌ Error during page navigation:', error);
                  // Try to recover by going back
                  try {
                    await page.goBack();
                    console.log('↩️ Recovered by going back');
                  } catch (e) {
                    console.error('❌ Failed to recover:', e);
                  }
                }
              } else {
                console.log(`❌ Could not find link position for ${result.domain}`);
              }
            } else {
              console.log(`❌ Could not find link for domain: ${result.domain}`);
            }
          }
        }
      }

      // Check if all domains found
      const hasUnfound = foundDomains.some(d => d.position === 'Not found');
      if (!hasUnfound) {
        console.log('\n🎉 All domains found!');
        stop = true;
        break;
      }

      // Check for next page
      console.log('\n🔍 Checking for next page...');
      const nextPageHref = await page.evaluate((pageNum) => {
        const next = Array.from(document.querySelectorAll('a[aria-label]'))
          .find(a => a.getAttribute('aria-label') === `Page ${pageNum + 1}`);
        return next ? (next as HTMLAnchorElement).href : null;
      }, pageNum);
      
      if (nextPageHref) {
        console.log(`🔄 Moving to page ${pageNum + 1}`);
        await Promise.all([
          page.goto(nextPageHref, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
          page.waitForSelector('div#search', { timeout: 20000 }).catch(() => {})
        ]);
        pageNum++;
        await delay(getRandomInt(1000, 2000));
      } else {
        console.log('⚠️ Next page not found');
        break;
      }
    }

    // Log final results
    console.log('\n📊 Final search results:');
    foundDomains.forEach(result => {
      if (result.position === 'Not found') {
        console.log(`❌ ${result.domain} - Not found`);
      } else {
        console.log(`✅ ${result.domain} - Found on page ${result.page}, position ${result.position}`);
      }
    });

    // Save cookies
    console.log('\n💾 Saving cookies...');
    const cookiesPath = path.resolve('cookies.json');
    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log('✅ Cookies saved');
    
    await delay(getRandomInt(5000, 10000));
    console.log('\n⏳ Waiting before next search...\n');
  } catch (error) {
    console.error(`Error processing search query "${searchQuery}":`, error);
    throw error;
  }
}

async function processSearchResults(page: Page, targetDomains: string[]): Promise<void> {
  try {
    console.log('Processing search results...');
    
    // Extract domain positions
    const domainPositions = await extractDomainPositions(page, targetDomains);
    console.log('Found domain positions:', domainPositions);
    
    // Process each domain sequentially
    for (const result of domainPositions) {
      if (result.position !== 'Not found' && !result.clicked) {
        console.log(`Processing domain: ${result.domain}`);
        
        // Take screenshot of found domain
        const screenshotPath = `screenshots/${result.domain}_${Date.now()}.png` as const;
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved: ${screenshotPath}`);
        
        // Click and handle the domain
        const success = await handleDomainClick(page, result.domain, parseInt(result.position));
        if (success) {
          result.clicked = true;
          console.log(`Successfully processed domain: ${result.domain}`);
        } else {
          console.log(`Failed to process domain: ${result.domain}`);
        }
        
        // Random delay between domains
        await delay(getRandomInt(2000, 4000));
      }
    }

    // Save search results to file
    const resultsPath = `results/search_results_${Date.now()}.json`;
    await Bun.write(resultsPath, JSON.stringify(searchResults, null, 2));
    console.log(`Search results saved to: ${resultsPath}`);
  } catch (error) {
    console.error('Error processing search results:', error);
    throw error;
  }
}

interface DomainResult {
  domain: string;
  position: string;
}

async function visitDomain(page: Page, domain: string, position: string): Promise<void> {
  try {
    console.log(`🔄 Visiting domain: ${domain} (position: ${position})`);
    
    // Find domain link
    const domainLink = await page.evaluate((domain: string) => {
      const links = Array.from(document.querySelectorAll('a[href*="' + domain + '"]'));
      if (links.length > 0) {
        return (links[0] as HTMLAnchorElement).href;
      }
      return null;
    }, domain);

    if (!domainLink) {
      console.log(`❌ Could not find link for domain: ${domain}`);
      return;
    }

    // Human-like behavior before clicking
    await moveMouseRandomly(page);
    await delay(getRandomInt(500, 1500));

    // Find link position
    const linkPosition = await page.evaluate((domain: string) => {
      const links = Array.from(document.querySelectorAll('a[href*="' + domain + '"]'));
      if (links.length > 0) {
        const link = links[0];
        const rect = link.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          visible: rect.top >= 0 && rect.left >= 0 && 
                  rect.bottom <= window.innerHeight && 
                  rect.right <= window.innerWidth
        };
      }
      return null;
    }, domain);

    if (linkPosition) {
      if (!linkPosition.visible) {
        console.log('📜 Link not visible, scrolling to it...');
        await page.evaluate((domain: string) => {
          const link = document.querySelector('a[href*="' + domain + '"]');
          if (link) link.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, domain);
        await delay(getRandomInt(1000, 2000));
      }

      // Human-like mouse movement and click
      await page.mouse.move(
        linkPosition.x + getRandomInt(-5, 5),
        linkPosition.y + getRandomInt(-5, 5),
        { steps: getRandomInt(25, 50) }
      );
      await delay(getRandomInt(300, 800));
      
      await page.mouse.click(
        linkPosition.x + getRandomInt(-2, 2),
        linkPosition.y + getRandomInt(-2, 2)
      );
      
      // Wait for page load
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        page.waitForSelector('body', { timeout: 30000 }).catch(() => {})
      ]);

      // Close modal if exists
      try {
        await page.waitForSelector('xpath=//*[@id="modals-container"]/div/div/div[2]/div/button', { timeout: 5000 });
        await moveMouseRandomly(page);
        await delay(getRandomInt(500, 1000));
        await page.locator('xpath=//*[@id="modals-container"]/div/div/div[2]/div/button').click();
        console.log('✅ Modal closed');
      } catch (error) {
        console.log('ℹ️ Modal not found or already closed');
      }

      // Spend time on site
      console.log('⏳ Spending time on site 100 seconds...');
      const startTime = Date.now();
      const visitDuration = 100000; // 100 seconds
      
      while (Date.now() - startTime < visitDuration) {
        // Random actions
        await moveMouseRandomly(page);
        await humanLikeScroll(page);
        
        // Random clicks on links
        if (Math.random() < 0.3) {
          try {
            const links = await page.$$('a');
            if (links.length > 0) {
              const randomLink = links[Math.floor(Math.random() * links.length)];
              const isVisible = await randomLink.isVisible();
              if (isVisible) {
                await randomLink.click();
                await delay(getRandomInt(2000, 5000));
                await page.goBack();
              }
            }
          } catch (error) {
            console.log('⚠️ Error clicking random link:', error);
          }
        }
        
        const remainingTime = visitDuration - (Date.now() - startTime);
        const delayTime = Math.min(getRandomInt(2000, 5000), remainingTime);
        await delay(delayTime);
        
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        if (elapsedSeconds % 20 === 0) {
          console.log(`⏱️ Elapsed ${elapsedSeconds} seconds`);
        }
      }

      // Go back
      await delay(getRandomInt(1000, 2000));
      await moveMouseRandomly(page);
      await delay(getRandomInt(500, 1000));
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await delay(getRandomInt(1000, 2000));
      
      console.log(`✅ Successfully completed visit to ${domain}`);
    } else {
      console.log(`❌ Could not find link position for ${domain}`);
    }
  } catch (error) {
    console.error(`❌ Error visiting domain ${domain}:`, error);
  }
}

async function run(): Promise<void> {
  let browser: Browser | null = null;
  
  try {
    // Initialize browser with enhanced stealth settings
    const args = [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      `--proxy-server=${proxy.host}:${proxy.port}`,
    ];

    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args,
    });

    // Create new page
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

    // Authenticate proxy
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
          console.log('LocalStorage access restricted - continuing without it');
        }
      });
    } catch (e) {
      console.log('Error setting localStorage - continuing without it');
    }

    // Load cookies if they exist
    const cookiesPath = path.resolve('cookies.json');
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
      await page.setCookie(...cookies);
    }

    // Set random language
    await page.setExtraHTTPHeaders({
      'Accept-Language': languages[getRandomInt(0, languages.length - 1)].join(',')
    });

    // Process each search query
    for (const searchQuery of searchQueries) {
      try {
        await performSearch(page, searchQuery, true);
      } catch (error) {
        console.error(`Error processing search query "${searchQuery}":`, error);
        continue;
      }
    }
  } catch (error) {
    console.error('Error in main execution:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Start the script
run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});