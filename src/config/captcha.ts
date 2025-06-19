function validateCaptchaApiKey(apiKey: string): void {
  if (!apiKey) {
    throw new Error('CAPTCHA_API_KEY is required');
  }
}

export const API_KEY = '';

// Validate API key
validateCaptchaApiKey(API_KEY); 
