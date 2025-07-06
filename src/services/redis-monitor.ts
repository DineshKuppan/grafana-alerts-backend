import { createClient, RedisClientType } from 'redis';
import { ServiceStatus } from '../types';
import { logger } from '../utils/logger';

export class RedisMonitor {
  private client: RedisClientType;
  private url: string;
  private timeout: number;

  constructor(url: string, timeout: number = 5000) {
    this.url = url;
    this.timeout = timeout;
    this.client = createClient({ url });
  }

  async checkHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      // Connect with timeout
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), this.timeout)
      );

      await Promise.race([connectPromise, timeoutPromise]);

      // Test with ping
      const pong = await this.client.ping();
      if (pong !== 'PONG') {
        throw new Error('Invalid ping response');
      }

      await this.client.disconnect();

      const responseTime = Date.now() - startTime;
      logger.info(`Redis health check successful - ${responseTime}ms`);

      return {
        name: 'redis',
        status: 'up',
        responseTime,
        lastCheck: new Date()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(`Redis health check failed: ${error}`);

      try {
        await this.client.disconnect();
      } catch (disconnectError) {
        logger.error(`Error disconnecting Redis: ${disconnectError}`);
      }

      return {
        name: 'redis',
        status: 'down',
        responseTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}