export interface ProxyConfig {
  host: string;
  port: string;
  username: string;
  password: string;
}

export interface DomainPosition {
  domain: string;
  position: string;
  page: number | null;
  clicked: boolean;
}

export interface SearchResult {
  domain: string;
  url: string;
  title: string;
  description: string;
  position: number;
} 