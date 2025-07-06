import { Client } from 'pg';
import { ServiceStatus } from '../types';
import { logger } from '../utils/logger';

export class PostgresMonitor {
  private connectionString: string;
  private timeout: number;

  constructor(connectionString: string, timeout: number = 5000) {
    this.connectionString = connectionString;
    this.timeout = timeout;
  }

  async checkHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    const client = new Client({
      connectionString: this.connectionString,
      connectionTimeoutMillis: this.timeout
    });

    try {
      await client.connect();
      
      // Test query
      const result = await client.query('SELECT 1 as health_check');
      if (result.rows[0].health_check !== 1) {
        throw new Error('Invalid health check response');
      }

      await client.end();

      const responseTime = Date.now() - startTime;
      logger.info(`PostgreSQL health check successful - ${responseTime}ms`);

      return {
        name: 'postgres',
        status: 'up',
        responseTime,
        lastCheck: new Date()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(`PostgreSQL health check failed: ${error}`);

      try {
        await client.end();
      } catch (endError) {
        logger.error(`Error ending PostgreSQL connection: ${endError}`);
      }

      return {
        name: 'postgres',
        status: 'down',
        responseTime,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}