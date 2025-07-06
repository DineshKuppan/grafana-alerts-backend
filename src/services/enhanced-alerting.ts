import { ServiceStatus } from '../types';
import { ErrorSummary } from './request-metrics';
import { SlackNotifier } from './slack-notifier';
import { MongoDBAlertStore } from './mongodb-alert-store';
import { logger } from '../utils/logger';

export class EnhancedAlertingService {
  private slackNotifier: SlackNotifier;
  private mongoStore: MongoDBAlertStore;
  private serviceStates: Map<string, 'up' | 'down'> = new Map();

  constructor(
    slackNotifier: SlackNotifier,
    mongoStore: MongoDBAlertStore
  ) {
    this.slackNotifier = slackNotifier;
    this.mongoStore = mongoStore;
  }

  async processServiceAlert(status: ServiceStatus): Promise<void> {
    const previousState = this.serviceStates.get(status.name);
    this.serviceStates.set(status.name, status.status);

    // Only process on state changes
    if (previousState === status.status) return;

    try {
      if (status.status === 'down') {
        // Store service down alert
        const alert = await this.mongoStore.storeServiceAlert(status, 'service_down');
        
        // Send Slack notification
        await this.slackNotifier.processAlert(status);
        
        // Update notification status in MongoDB
        if (this.slackNotifier['config'].enabled) {
          await this.mongoStore.updateNotificationStatus(
            alert.alertId,
            'slack',
            {
              channel: this.slackNotifier['config'].channel,
              messageId: `service_down_${status.name}_${Date.now()}`
            }
          );
        }

        logger.info(`Processed service down alert for ${status.name}`);
        
      } else if (status.status === 'up' && previousState === 'down') {
        // Store service recovery alert
        const alert = await this.mongoStore.storeServiceAlert(status, 'service_recovery');
        
        // Send Slack notification
        await this.slackNotifier.processAlert(status);
        
        // Update notification status in MongoDB
        if (this.slackNotifier['config'].enabled) {
          await this.mongoStore.updateNotificationStatus(
            alert.alertId,
            'slack',
            {
              channel: this.slackNotifier['config'].channel,
              messageId: `service_recovery_${status.name}_${Date.now()}`
            }
          );
        }

        logger.info(`Processed service recovery alert for ${status.name}`);
      }
    } catch (error) {
      logger.error(`Failed to process service alert for ${status.name}: ${error}`);
    }
  }

  async processErrorAlert(errorSummary: ErrorSummary): Promise<void> {
    try {
      // Determine severity based on error rate
      const severity = errorSummary.errorRate >= 10 ? 'critical' : 'warning';
      
      // Store error alert in MongoDB
      const alert = await this.mongoStore.storeErrorAlert(errorSummary, severity);
      
      // Send Slack notification
      await this.sendErrorSlackAlert(errorSummary, severity);
      
      // Update notification status
      await this.mongoStore.updateNotificationStatus(
        alert.alertId,
        'slack',
        {
          channel: '#alerts-critical',
          messageId: `error_rate_${Date.now()}`
        }
      );

      logger.info(`Processed error rate alert: ${errorSummary.errorRate.toFixed(2)}%`);
      
    } catch (error) {
      logger.error(`Failed to process error alert: ${error}`);
    }
  }

  private async sendErrorSlackAlert(summary: ErrorSummary, severity: 'warning' | 'critical'): Promise<void> {
    const color = severity === 'critical' ? 'danger' : 'warning';
    const emoji = severity === 'critical' ? '🚨' : '⚠️';
    
    const serviceBreakdown = Object.entries(summary.services)
      .map(([service, stats]) => 
        `*${service}*: ${stats.errors}/${stats.requests} (${stats.errorRate.toFixed(2)}%)`
      )
      .join('\n');

    const message = {
      channel: '#alerts-critical',
      username: 'ErrorBot',
      icon_emoji: ':rotating_light:',
      text: `${emoji} *HIGH ERROR RATE DETECTED* ${emoji}`,
      attachments: [{
        color,
        title: `${emoji} Error Rate Alert - ${summary.errorRate.toFixed(2)}%`,
        text: `High error rate detected during high traffic period`,
        fields: [
          {
            title: 'Error Rate',
            value: `${summary.errorRate.toFixed(2)}%`,
            short: true
          },
          {
            title: 'Total Requests',
            value: summary.totalRequests.toLocaleString(),
            short: true
          },
          {
            title: 'Total Errors',
            value: summary.totalErrors.toLocaleString(),
            short: true
          },
          {
            title: 'Time Window',
            value: summary.timeWindow,
            short: true
          },
          {
            title: 'Service Breakdown',
            value: serviceBreakdown,
            short: false
          }
        ],
        ts: Math.floor(Date.now() / 1000),
        actions: [
          {
            type: 'button',
            text: 'View Dashboard',
            url: 'http://localhost:3000/d/services-monitoring'
          },
          {
            type: 'button',
            text: 'Check Logs',
            url: 'http://localhost:3001/alerts'
          }
        ]
      }]
    };

    // Send via SlackNotifier's webhook
    const webhookUrl = this.slackNotifier['config'].webhookUrl;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    }
  }

  // Store custom alert (for extensibility)
  async storeCustomAlert(alertData: {
    alertName: string;
    alertType: string;
    severity: 'info' | 'warning' | 'critical';
    service: string;
    metadata?: any;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    tags?: string[];
  }): Promise<void> {
    try {
      const alertId = `custom_${alertData.alertType}_${Date.now()}`;
      const fingerprint = this.generateFingerprint(
        alertData.service, 
        alertData.alertType, 
        alertData.metadata || {}
      );

      const alert = {
        alertId,
        alertName: alertData.alertName,
        alertType: alertData.alertType as any,
        severity: alertData.severity,
        status: 'firing' as const,
        service: alertData.service,
        timestamp: new Date(),
        metadata: alertData.metadata || {},
        labels: alertData.labels || {},
        annotations: alertData.annotations || {},
        fingerprint,
        tags: alertData.tags || [],
        environment: process.env.NODE_ENV || 'production'
      };

      // Store in MongoDB using a more direct approach since it's a custom alert
      const Alert = (await import('../models/alert')).Alert;
      const alertDoc = new Alert(alert);
      await alertDoc.save();

      logger.info(`Stored custom alert: ${alertId}`);
    } catch (error) {
      logger.error(`Failed to store custom alert: ${error}`);
    }
  }

  // Send test alert for validation
  async sendTestAlert(alertType: 'service' | 'error' = 'service'): Promise<void> {
    try {
      if (alertType === 'service') {
        const testStatus: ServiceStatus = {
          name: 'test-service',
          status: 'down',
          responseTime: 5000,
          lastCheck: new Date(),
          error: 'Test simulation - service down'
        };

        await this.processServiceAlert(testStatus);
      } else {
        const testErrorSummary: ErrorSummary = {
          totalRequests: 150000,
          totalErrors: 9000,
          errorRate: 6.0,
          timeWindow: '300s',
          services: {
            'test-api': { requests: 100000, errors: 5000, errorRate: 5.0 },
            'test-auth': { requests: 30000, errors: 2000, errorRate: 6.67 },
            'test-payment': { requests: 20000, errors: 2000, errorRate: 10.0 }
          }
        };

        await this.processErrorAlert(testErrorSummary);
      }

      logger.info(`Sent test ${alertType} alert`);
    } catch (error) {
      logger.error(`Failed to send test alert: ${error}`);
    }
  }

  // Get alert statistics from MongoDB
  async getAlertStatistics(days: number = 7): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await this.mongoStore.getAlertStats(startDate, new Date());
    } catch (error) {
      logger.error(`Failed to get alert statistics: ${error}`);
      return null;
    }
  }

  // Get recent alerts for a specific service
  async getServiceAlerts(service: string, limit: number = 10): Promise<any> {
    try {
      return await this.mongoStore.getRecentAlertsForService(service, limit);
    } catch (error) {
      logger.error(`Failed to get service alerts: ${error}`);
      return [];
    }
  }

  // Get all active alerts
  async getActiveAlerts(): Promise<any> {
    try {
      return await this.mongoStore.getActiveAlerts();
    } catch (error) {
      logger.error(`Failed to get active alerts: ${error}`);
      return [];
    }
  }

  // Acknowledge alert
  async acknowledgeAlert(alertId: string, acknowledgedBy: string, reason?: string): Promise<boolean> {
    try {
      const result = await this.mongoStore.acknowledgeAlert(alertId, acknowledgedBy, reason);
      
      if (result) {
        logger.info(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);
        
        // Optionally send Slack notification about acknowledgment
        if (this.slackNotifier['config'].enabled) {
          await this.sendAcknowledgmentNotification(alertId, acknowledgedBy, reason);
        }
      }
      
      return result;
    } catch (error) {
      logger.error(`Failed to acknowledge alert ${alertId}: ${error}`);
      return false;
    }
  }

  private async sendAcknowledgmentNotification(
    alertId: string, 
    acknowledgedBy: string, 
    reason?: string
  ): Promise<void> {
    try {
      const message = {
        channel: this.slackNotifier['config'].channel,
        username: 'AlertBot',
        icon_emoji: ':white_check_mark:',
        text: `✅ *Alert Acknowledged*`,
        attachments: [{
          color: 'good',
          title: 'Alert Acknowledgment',
          fields: [
            {
              title: 'Alert ID',
              value: alertId,
              short: true
            },
            {
              title: 'Acknowledged By',
              value: acknowledgedBy,
              short: true
            },
            {
              title: 'Reason',
              value: reason || 'No reason provided',
              short: false
            },
            {
              title: 'Time',
              value: new Date().toISOString(),
              short: true
            }
          ],
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      const webhookUrl = this.slackNotifier['config'].webhookUrl;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
      }
    } catch (error) {
      logger.error(`Failed to send acknowledgment notification: ${error}`);
    }
  }

  // Generate fingerprint for alert grouping
  private generateFingerprint(service: string, alertType: string, metadata: any): string {
    const crypto = require('crypto');
    const fingerprintData = {
      service,
      alertType,
      threshold: metadata.threshold,
      route: metadata.route
    };
    return crypto.createHash('md5').update(JSON.stringify(fingerprintData)).digest('hex');
  }

  // Resolve alerts manually (for testing or manual intervention)
  async resolveAlert(fingerprint: string): Promise<number> {
    try {
      const resolvedCount = await this.mongoStore.resolveAlertsByFingerprint(fingerprint);
      
      if (resolvedCount > 0) {
        logger.info(`Manually resolved ${resolvedCount} alerts with fingerprint ${fingerprint}`);
      }
      
      return resolvedCount;
    } catch (error) {
      logger.error(`Failed to resolve alerts: ${error}`);
      return 0;
    }
  }

  // Generate and send daily summary
  async sendDailySummary(date: Date = new Date()): Promise<void> {
    try {
      // Generate summaries in MongoDB
      await this.mongoStore.generateDailySummaries(date);
      
      // Get statistics for the day
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      const stats = await this.mongoStore.getAlertStats(startDate, endDate);
      
      // Send summary to Slack
      if (this.slackNotifier['config'].enabled && stats.totalAlerts > 0) {
        await this.sendSlackDailySummary(date, stats);
      }
      
      logger.info(`Sent daily summary for ${date.toISOString().split('T')[0]}`);
    } catch (error) {
      logger.error(`Failed to send daily summary: ${error}`);
    }
  }

  private async sendSlackDailySummary(date: Date, stats: any): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    
    const serviceBreakdown = Object.entries(stats.alertsByService)
      .map(([service, count]) => `*${service}*: ${count}`)
      .join('\n');

    const message = {
      channel: this.slackNotifier['config'].channel,
      username: 'SummaryBot',
      icon_emoji: ':bar_chart:',
      text: `📊 *Daily Alert Summary - ${dateStr}*`,
      attachments: [{
        color: stats.criticalAlerts > 0 ? 'danger' : stats.warningAlerts > 0 ? 'warning' : 'good',
        title: `Alert Summary for ${dateStr}`,
        fields: [
          {
            title: 'Total Alerts',
            value: stats.totalAlerts.toString(),
            short: true
          },
          {
            title: 'Critical Alerts',
            value: stats.criticalAlerts.toString(),
            short: true
          },
          {
            title: 'Warning Alerts',
            value: stats.warningAlerts.toString(),
            short: true
          },
          {
            title: 'Resolved Alerts',
            value: stats.resolvedAlerts.toString(),
            short: true
          },
          {
            title: 'Avg Resolution Time',
            value: `${Math.round(stats.avgResolutionTime)} seconds`,
            short: true
          },
          {
            title: 'Active Alerts',
            value: stats.unresolvedAlerts.toString(),
            short: true
          },
          {
            title: 'Alerts by Service',
            value: serviceBreakdown,
            short: false
          }
        ],
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    const webhookUrl = this.slackNotifier['config'].webhookUrl;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    }
  }
}