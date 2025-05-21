import type { ProxyConfig } from '../types/config.js';

function validateProxyConfig(config: ProxyConfig): void {
  const requiredFields: (keyof ProxyConfig)[] = ['host', 'port', 'username', 'password'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required proxy configuration fields: ${missingFields.join(', ')}`);
  }
}

// export const proxy: ProxyConfig = {
//   host: 'gw.dataimpulse.com',
//   port: '823',
//   username: '2f9423e830bdd80a8973__cr.ua',
//   password: '08e2109223a997f1'
// };
export const proxy: ProxyConfig = {
  host: 'de.922s5.net',
  port: '6300',
  username: '17669994-zone-custom-region-UA-sessid-Nphb9uMA',
  password: 'FQORPLVx'
};
// Validate proxy configuration
validateProxyConfig(proxy);