import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import * as path from 'path';

class ConfigService {
  constructor(private env: { [k: string]: string | undefined }) {}

  private getValue(key: string, throwOnMissing = true): string {
    const value = this.env[key];
    if (!value && throwOnMissing) {
      throw new Error(`config error - missing env.${key}`);
    }

    if (key === 'POSTGRES_TLS_CERT_FILE_NAME') {
      if (this.env[key] && this.env[key].length > 0) {
        const file = path.resolve(__dirname, './assets/certs', this.env[key]);
        if (fs.existsSync(file)) {
          return readFileSync(file).toString();
        }

        // fixme - throw error if file not found
        Logger.debug(`*** ${process.env.NODE_ENV}`, process.env.APP_NAME || 'ConfigService');
        return '';
      }
    }

    return value;
  }

  public ensureValues(keys: string[]) {
    keys.forEach((k) => this.getValue(k, true));
    return this;
  }

  public getPort() {
    return this.getValue('PORT', true);
  }

  public isProduction() {
    const mode = this.getValue('MODE', false);
    return mode != 'DEV';
  }
}

const configService = new ConfigService(process.env);
//   .ensureValues([
//   'POSTGRES_HOST',
//   'POSTGRES_PORT',
//   'POSTGRES_USER',
//   'POSTGRES_PASSWORD',
//   'POSTGRES_DATABASE',
// ]);

export { configService };
