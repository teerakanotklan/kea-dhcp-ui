import http from 'http';
import { URL } from 'url';
import config from '../../config/default';
import mockDataService from '../../services/mockDataService';
import { buildCommandPayload } from './kea-command';
import { parseKeaResponse } from './kea-response';
import {
  KeaConnectionError,
  KeaTimeoutError,
  KeaCommandError,
  KeaParseError
} from './kea.errors';

export interface KeaClientOptions {
  agentUrl?: string;
  timeoutMs?: number;
}

export class KeaClient {
  private agentUrl: string;
  private timeoutMs: number;

  constructor(options: KeaClientOptions = {}) {
    this.agentUrl = options.agentUrl || config.keaCtrlAgentUrl;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /**
   * Execute command against Kea Control Agent
   */
  async execute<T = Record<string, unknown>>(
    command: string,
    service: string | string[] = ['dhcp4'],
    args: Record<string, unknown> = {}
  ): Promise<T> {
    if (!config.isProduction) {
      return mockDataService.handleCommand<T>(command, service, args);
    }

    const payload = buildCommandPayload(command, service, args);
    const postData = JSON.stringify(payload);
    const url = new URL(this.agentUrl);

    return new Promise<T>((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 8000,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.timeoutMs
      };

      const req = http.request(options, (res) => {
        let rawData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const agentResponse = parseKeaResponse<T>(rawData, command);
            // Result 0: success, Result 3: empty set (0 items found, e.g. lease4-get-all)
            if (agentResponse.result === 0 || agentResponse.result === 3) {
              resolve((agentResponse.arguments || {}) as T);
            } else {
              reject(
                new KeaCommandError(
                  command,
                  agentResponse.result,
                  agentResponse.text || `Kea command '${command}' returned error code ${agentResponse.result}`
                )
              );
            }
          } catch (e: unknown) {
            if (e instanceof KeaCommandError) {
              reject(e);
            } else {
              const msg = e instanceof Error ? e.message : String(e);
              reject(new KeaParseError(msg, rawData));
            }
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new KeaTimeoutError());
      });

      req.on('error', (err) => {
        reject(new KeaConnectionError(`Failed to connect to Kea Control Agent at ${this.agentUrl}: ${err.message}`, err));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Health check for Kea Control Agent
   */
  async isAlive(): Promise<boolean> {
    if (!config.isProduction) {
      return true;
    }
    try {
      await this.execute('status-get', ['dhcp4']);
      return true;
    } catch {
      try {
        await this.execute('version-get');
        return true;
      } catch {
        return false;
      }
    }
  }
}

export default new KeaClient();
