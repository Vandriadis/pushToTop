export async function extractDomainPositions(page: any, targetDomains: string[]) {
  return await page.evaluate((targetDomains: string[]) => {
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
} 