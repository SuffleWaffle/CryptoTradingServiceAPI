import * as os from 'os';

export function getIPAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];

    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if ((alias.family === 'IPv4' || alias.family === 4) && alias.address !== '127.0.0.1' && !alias.internal) return alias.address;
    }
  }
  return '0.0.0.0';
}
