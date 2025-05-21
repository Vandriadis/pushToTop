export interface DomainResult {
  domain: string;
  position: string;
  page: number | null;
  clicked: boolean;
}

export interface ProxyConfig {
  host: string;
  port: string;
  username: string;
  password: string;
}

export interface BrowserConfig {
  headless: boolean;
  executablePath: string;
  args: string[];
} 