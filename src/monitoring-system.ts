import { RedisMonitor } from './services/redis-monitor';
import { RabbitMQMonitor } from './services/rabbitmq-monitor';
import { PostgresMonitor } from './services/postgres-monitor';
import { MetricsService } from './services/metrics';
import { AlertingService } from './services/alerting';
import { SlackNotifier } from './services/slack-notifier';
import { RequestMetricsService } from './services/request-metrics';
import { MongoDBAlertStore } from './services/mongodb-alert-store';
import { EnhancedAlertingService } from './services/enhanced-alerting';
import { MonitoringConfig, ServiceStatus } from './types';
import { logger } from './utils/logger';

export class MonitoringSystem {
  private redisMonitor: RedisMonitor;
  private postgresMonitor: PostgresMonitor;
  private metricsService: MetricsService;
  private alertingService: AlertingService;
  private slackNotifier: SlackNotifier;
  private requestMetricsService: RequestMetricsService;
  private mongoStore: MongoDBAlertStore;
  private enhancedAlertingService: EnhancedAlertingService;
  private config: MonitoringConfig;
  private intervalId?: NodeJS.Timeout;
  private errorCheckIntervalId?: NodeJS.Timeout;
  private summaryIntervalId?: NodeJS.Timeout;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.redisMonitor = new RedisMonitor(config.redis.url, config.redis.timeout);
    this.postgresMonitor = new PostgresMonitor(config.postgres.url, config.postgres.timeout);
    this.metricsService = new MetricsService();
    this.alertingService = new AlertingService(config.alerts);
    this.slackNotifier = new SlackNotifier(config.slack);
    this.requestMetricsService = new RequestMetricsService(config.requestMetrics);
    
    // Initialize MongoDB store if enabled
    if (config.mongodb.enabled) {
      this.mongoStore = new MongoDBAlertStore(config.mongodb.connectionString);
      this.enhancedAlertingService = new EnhancedAlertingService(
        this.slackNotifier,
        this.mongoStore
      );
    }
  }

  async start(): Promise<void> {
    logger.info('Starting monitoring system...');

    // Connect to MongoDB if enabled
    if (this.config.mongodb.enabled && this.mongoStore) {
      try {
        await this.mongoStore.connect();
        logger.info('MongoDB alert storage enabled');
      } catch (error) {
        logger.error(`Failed to connect to MongoDB: ${error}`);
      }
    }

    // Send test Slack message if enabled
    if (this.config.slack.enabled) {
      try {
        await this.slackNotifier.sendTestMessage();
      } catch (error) {
        logger.warn(`Failed to send Slack test message: ${error}`);
      }
    }

    // Initial health check
    await this.performHealthChecks();

    // Schedule regular health checks
    this.intervalId = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Schedule error rate checks (every 30 seconds)
    if (this.config.errorAlerts.enabled) {
      this.errorCheckIntervalId = setInterval(async () => {
        await this.checkErrorRates();
      }, 30000);
    }

    // Schedule daily summary generation (every hour)
    if (this.config.mongodb.enabled && this.mongoStore) {
      this.summaryIntervalId = setInterval(async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await this.mongoStore.generateDailySummaries(yesterday);
      }, 3600000); // 1 hour
    }

    logger.info(`Monitoring system started with ${this.config.healthCheckInterval}ms interval`);
    logger.info(`Slack notifications: ${this.config.slack.enabled ? 'enabled' : 'disabled'}`);
    logger.info(`Error alerts: ${this.config.errorAlerts.enabled ? 'enabled' : 'disabled'}`);
    logger.info(`MongoDB storage: ${this.config.mongodb.enabled ? 'enabled' : 'disabled'}`);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.errorCheckIntervalId) {
      clearInterval(this.errorCheckIntervalId);
      this.errorCheckIntervalId = undefined;
    }
    if (this.summaryIntervalId) {
      clearInterval(this.summaryIntervalId);
      this.summaryIntervalId = undefined;
    }

    // Disconnect from MongoDB
    if (this.mongoStore) {
      await this.mongoStore.disconnect();
    }

    logger.info('Monitoring system stopped');
  }

  private async performHealthChecks(): Promise<void> {
    const checks = [
      this.redisMonitor.checkHealth(),
      this.rabbitmqMonitor.checkHealth(),
      this.postgresMonitor.checkHealth()
    ];

    const results = await Promise.allSettled(checks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const status = result.value;
        this.metricsService.updateServiceMetrics(status);
        
        // Use enhanced alerting if MongoDB is enabled, otherwise use basic alerting
        if (this.enhancedAlertingService) {
          this.enhancedAlertingService.processServiceAlert(status);
        } else {
          this.alertingService.processAlert(status);
          this.slackNotifier.processAlert(status);
        }
      } else {
        logger.error(`Health check failed: ${result.reason}`);
      }
    });
  }

  private async checkErrorRates(): Promise<void> {
    try {
      const errorSummary = await this.requestMetricsService.checkErrorThresholds();
      if (errorSummary) {
        if (this.enhancedAlertingService) {
          await this.enhancedAlertingService.processErrorAlert(errorSummary);
        }
      }
    } catch (error) {
      logger.error(`Error rate check failed: ${error}`);
    }
  }

  getMetricsService(): MetricsService {
    return this.metricsService;
  }

  getSlackNotifier(): SlackNotifier {
    return this.slackNotifier;
  }

  getRequestMetricsService(): RequestMetricsService {
    return this.requestMetricsService;
  }

  getMongoStore(): MongoDBAlertStore | undefined {
    return this.mongoStore;
  }

  getEnhancedAlertingService(): EnhancedAlertingService | undefined {
    return this.enhancedAlertingService;
  }

  async getCurrentStatus(): Promise<ServiceStatus[]> {
    const checks = [
      this.redisMonitor.checkHealth(),
      this.rabbitmqMonitor.checkHealth(),
      this.postgresMonitor.checkHealth()
    ];

    const results = await Promise.allSettled(checks);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const serviceNames = ['redis', 'rabbitmq', 'postgres'];
        return {
          name: serviceNames[index],
          status: 'down' as const,
          responseTime: 0,
          lastCheck: new Date(),
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
        };
      }
    });
  }

  // Get current error summary for API endpoint
  async getErrorSummary() {
    return await this.requestMetricsService.getErrorSummary();
  }

  // MongoDB-specific methods
  async getAlertHistory(query: any = {}) {
    if (!this.mongoStore) {
      throw new Error('MongoDB storage is not enabled');
    }
    return await this.mongoStore.queryAlerts(query);
  }

  async getAlertStats(startDate?: Date, endDate?: Date) {
    if (!this.mongoStore) {
      throw new Error('MongoDB storage is not enabled');
    }
    return await this.mongoStore.getAlertStats(startDate, endDate);
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string, reason?: string) {
    if (!this.mongoStore) {
      throw new Error('MongoDB storage is not enabled');
    }
    return await this.mongoStore.acknowledgeAlert(alertId, acknowledgedBy, reason);
  }

  async getActiveAlerts() {
    if (!this.mongoStore) {
      throw new Error('MongoDB storage is not enabled');
    }
    return await this.mongoStore.getActiveAlerts();
  }

  // Health check including MongoDB
  async getSystemHealth() {
    const status = await this.getCurrentStatus();
    const mongoHealth = this.mongoStore ? await this.mongoStore.healthCheck() : null;
    
    return {
      services: status,
      mongodb: {
        enabled: this.config.mongodb.enabled,
        connected: mongoHealth
      },
      timestamp: new Date()
    };
  }
}