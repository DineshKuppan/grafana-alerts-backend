import express from 'express';
import { MonitoringSystem } from './monitoring-system';
import { createMetricsMiddleware } from './services/request-metrics';
import { config } from './config';
import { logger } from './utils/logger';

export class MonitoringServer {
  private app: express.Application;
  private monitoringSystem: MonitoringSystem;

  constructor() {
    this.app = express();
    this.monitoringSystem = new MonitoringSystem(config);
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // JSON parsing
    this.app.use(express.json());

    // Request metrics middleware
    const metricsMiddleware = createMetricsMiddleware(
      this.monitoringSystem.getRequestMetricsService(),
      'monitoring-api'
    );
    this.app.use(metricsMiddleware);
  }

  private setupRoutes(): void {
    // Health endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const status = await this.monitoringSystem.getSystemHealth();
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          ...status
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Metrics endpoint for Prometheus
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.monitoringSystem.getMetricsService().getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Status endpoint
    this.app.get('/status', async (req, res) => {
      try {
        const status = await this.monitoringSystem.getCurrentStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Error summary endpoint
    this.app.get('/error-summary', async (req, res) => {
      try {
        const summary = await this.monitoringSystem.getErrorSummary();
        res.json(summary);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Alert history endpoint
    this.app.get('/alerts', async (req, res) => {
      try {
        if (!config.mongodb.enabled) {
          return res.status(400).json({
            error: 'MongoDB storage is not enabled'
          });
        }

        const {
          service,
          alertType,
          severity,
          status,
          startDate,
          endDate,
          acknowledged,
          limit = 50,
          offset = 0,
          sortBy = 'timestamp',
          sortOrder = 'desc'
        } = req.query;

        const query: any = {
          service: service as string,
          alertType: alertType as string,
          severity: severity as string,
          status: status as string,
          acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          sortBy: sortBy as string,
          sortOrder: sortOrder as 'asc' | 'desc'
        };

        // Remove undefined values
        Object.keys(query).forEach(key => query[key] === undefined && delete query[key]);

        const result = await this.monitoringSystem.getAlertHistory(query);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to fetch alerts'
        });
      }
    });

    // Alert statistics endpoint
    this.app.get('/alerts/stats', async (req, res) => {
      try {
        if (!config.mongodb.enabled) {
          return res.status(400).json({
            error: 'MongoDB storage is not enabled'
          });
        }

        const { startDate, endDate } = req.query;
        const stats = await this.monitoringSystem.getAlertStats(
          startDate ? new Date(startDate as string) : undefined,
          endDate ? new Date(endDate as string) : undefined
        );
        res.json(stats);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to fetch alert stats'
        });
      }
    });

    // Active alerts endpoint
    this.app.get('/alerts/active', async (req, res) => {
      try {
        if (!config.mongodb.enabled) {
          return res.status(400).json({
            error: 'MongoDB storage is not enabled'
          });
        }

        const activeAlerts = await this.monitoringSystem.getActiveAlerts();
        res.json(activeAlerts);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to fetch active alerts'
        });
      }
    });

    // Acknowledge alert endpoint
    this.app.post('/alerts/:alertId/acknowledge', async (req, res) => {
      try {
        if (!config.mongodb.enabled) {
          return res.status(400).json({
            error: 'MongoDB storage is not enabled'
          });
        }

        const { alertId } = req.params;
        const { acknowledgedBy, reason } = req.body;

        if (!acknowledgedBy) {
          return res.status(400).json({
            error: 'acknowledgedBy is required'
          });
        }

        const success = await this.monitoringSystem.acknowledgeAlert(alertId, acknowledgedBy, reason);
        
        if (success) {
          res.json({
            message: 'Alert acknowledged successfully',
            alertId,
            acknowledgedBy,
            acknowledgedAt: new Date()
          });
        } else {
          res.status(404).json({
            error: 'Alert not found'
          });
        }
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to acknowledge alert'
        });
      }
    });

    // Test Slack notification endpoint
    this.app.post('/test-slack', async (req, res) => {
      try {
        if (!config.slack.enabled) {
          return res.status(400).json({
            error: 'Slack notifications are not enabled'
          });
        }

        await this.monitoringSystem.getSlackNotifier().sendTestMessage();
        res.json({
          message: 'Test Slack notification sent successfully'
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to send test notification'
        });
      }
    });

    // Test error alert endpoint
    this.app.post('/test-error-alert', async (req, res) => {
      try {
        if (!config.errorAlerts.enabled) {
          return res.status(400).json({
            error: 'Error alerts are not enabled'
          });
        }

        const testSummary = {
          totalRequests: 150000,
          totalErrors: 7500,
          errorRate: 5.0,
          timeWindow: '300s',
          services: {
            'api': { requests: 100000, errors: 5000, errorRate: 5.0 },
            'auth': { requests: 30000, errors: 1500, errorRate: 5.0 },
            'payment': { requests: 20000, errors: 1000, errorRate: 5.0 }
          }
        };

        const enhancedAlerting = this.monitoringSystem.getEnhancedAlertingService();
        if (enhancedAlerting) {
          await enhancedAlerting.processErrorAlert(testSummary);
        }

        res.json({
          message: 'Test error alert sent successfully',
          testSummary
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to send test error alert'
        });
      }
    });

    // Simulate service down for testing (development only)
    this.app.post('/simulate/:service/:status', async (req, res) => {
      const { service, status } = req.params;
      
      if (!['redis', 'rabbitmq', 'postgres'].includes(service)) {
        return res.status(400).json({
          error: 'Invalid service. Must be redis, rabbitmq, or postgres'
        });
      }

      if (!['up', 'down'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status. Must be up or down'
        });
      }

      try {
        const simulatedStatus = {
          name: service,
          status: status as 'up' | 'down',
          responseTime: Math.floor(Math.random() * 1000),
          lastCheck: new Date(),
          error: status === 'down' ? 'Simulated failure' : undefined
        };

        // Send to enhanced alerting system if available
        const enhancedAlerting = this.monitoringSystem.getEnhancedAlertingService();
        if (enhancedAlerting) {
          await enhancedAlerting.processServiceAlert(simulatedStatus);
        } else {
          await this.monitoringSystem.getSlackNotifier().processAlert(simulatedStatus);
        }
        
        res.json({
          message: `Simulated ${service} ${status} alert sent`,
          simulatedStatus
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to simulate alert'
        });
      }
    });

    // Simulate high error rate for testing
    this.app.post('/simulate-errors', async (req, res) => {
      try {
        const { count = 1000, errorRate = 0.1 } = req.body;
        const requestMetrics = this.monitoringSystem.getRequestMetricsService();

        // Simulate a burst of requests with errors
        for (let i = 0; i < count; i++) {
          const isError = Math.random() < errorRate;
          const method = 'GET';
          const route = '/api/test';
          const statusCode = isError ? 500 : 200;
          const duration = Math.random() * 1000;

          if (isError) {
            requestMetrics.recordError(method, route, statusCode, 'server_error', 'test-api');
          } else {
            requestMetrics.recordRequest(method, route, statusCode, duration, 'test-api');
          }
        }

        const summary = await requestMetrics.getErrorSummary();
        res.json({
          message: `Simulated ${count} requests with ${(errorRate * 100).toFixed(1)}% error rate`,
          summary
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to simulate errors'
        });
      }
    });

    // Load testing endpoint (generates traffic)
    this.app.get('/load-test', async (req, res) => {
      try {
        // Simulate random delay
        const delay = Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));

        // Random chance of error
        if (Math.random() < 0.02) { // 2% error rate
          return res.status(500).json({ error: 'Simulated server error' });
        }

        res.json({
          message: 'Load test endpoint',
          timestamp: new Date().toISOString(),
          delay: `${delay.toFixed(2)}ms`
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Load test failed'
        });
      }
    });

    // Reset metrics (for testing)
    this.app.post('/reset-metrics', async (req, res) => {
      try {
        this.monitoringSystem.getRequestMetricsService().reset();
        res.json({
          message: 'Metrics reset successfully'
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to reset metrics'
        });
      }
    });

    // MongoDB health check endpoint
    this.app.get('/mongodb/health', async (req, res) => {
      try {
        if (!config.mongodb.enabled) {
          return res.status(400).json({
            error: 'MongoDB storage is not enabled'
          });
        }

        const mongoStore = this.monitoringSystem.getMongoStore();
        if (!mongoStore) {
          return res.status(500).json({
            error: 'MongoDB store not initialized'
          });
        }

        const isHealthy = await mongoStore.healthCheck();
        res.json({
          mongodb: {
            enabled: true,
            connected: isHealthy,
            timestamp: new Date()
          }
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'MongoDB health check failed'
        });
      }
    });

    // Generate daily summaries manually (for testing)
    this.app.post('/generate-summaries', async (req, res) => {
      try {
        if (!config.mongodb.enabled) {
          return res.status(400).json({
            error: 'MongoDB storage is not enabled'
          });
        }

        const { date } = req.body;
        const targetDate = date ? new Date(date) : new Date();
        
        const mongoStore = this.monitoringSystem.getMongoStore();
        if (!mongoStore) {
          return res.status(500).json({
            error: 'MongoDB store not initialized'
          });
        }

        await mongoStore.generateDailySummaries(targetDate);
        res.json({
          message: 'Daily summaries generated successfully',
          date: targetDate.toISOString().split('T')[0]
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to generate summaries'
        });
      }
    });
  }

  async start(): Promise<void> {
    await this.monitoringSystem.start();
    
    this.app.listen(config.metricsPort, () => {
      logger.info(`Monitoring server started on port ${config.metricsPort}`);
      logger.info(`Metrics available at: http://localhost:${config.metricsPort}/metrics`);
      logger.info(`Health check at: http://localhost:${config.metricsPort}/health`);
      logger.info(`Error summary at: http://localhost:${config.metricsPort}/error-summary`);
      
      if (config.mongodb.enabled) {
        logger.info(`Alert history at: http://localhost:${config.metricsPort}/alerts`);
        logger.info(`Alert stats at: http://localhost:${config.metricsPort}/alerts/stats`);
        logger.info(`Active alerts at: http://localhost:${config.metricsPort}/alerts/active`);
        logger.info(`MongoDB health at: http://localhost:${config.metricsPort}/mongodb/health`);
      }
      
      logger.info(`Test Slack: POST http://localhost:${config.metricsPort}/test-slack`);
      logger.info(`Test error alert: POST http://localhost:${config.metricsPort}/test-error-alert`);
      logger.info(`Simulate errors: POST http://localhost:${config.metricsPort}/simulate-errors`);
      logger.info(`Load test: GET http://localhost:${config.metricsPort}/load-test`);
    });
  }

  async stop(): Promise<void> {
    await this.monitoringSystem.stop();
  }
}