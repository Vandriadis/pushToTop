function validateCaptchaApiKey(apiKey: string): void {
  if (!apiKey) {
    throw new Error('CAPTCHA_API_KEY is required');
  }
}

export const API_KEY = '073a33ff8679b4d94d77dd436c287d4f';

// Validate API key
validateCaptchaApiKey(API_KEY); 