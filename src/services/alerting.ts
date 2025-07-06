import { ServiceStatus, AlertConfig } from '../types';
import { logger } from '../utils/logger';

export class AlertingService {
  private config: AlertConfig;
  private serviceStates: Map<string, 'up' | 'down'> = new Map();

  constructor(config: AlertConfig) {
    this.config = config;
  }

  async processAlert(status: ServiceStatus): Promise<void> {
    if (!this.config.enabled) return;

    const previousState = this.serviceStates.get(status.name);
    this.serviceStates.set(status.name, status.status);

    // Only alert on state changes
    if (previousState === status.status) return;

    if (status.status === 'down') {
      await this.sendAlert({
        summary: `${status.name} service is down`,
        description: `Service ${status.name} is not responding. Error: ${status.error}`,
        severity: 'critical',
        service: status.name
      });
    } else if (status.status === 'up' && previousState === 'down') {
      await this.sendAlert({
        summary: `${status.name} service is back up`,
        description: `Service ${status.name} has recovered`,
        severity: 'info',
        service: status.name
      });
    }
  }

  private async sendAlert(alert: {
    summary: string;
    description: string;
    severity: string;
    service: string;
  }): Promise<void> {
    try {
      const alertPayload = {
        alerts: [{
          labels: {
            alertname: `${alert.service}_down`,
            service: alert.service,
            severity: alert.severity
          },
          annotations: {
            summary: alert.summary,
            description: alert.description
          },
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
        }]
      };

      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger.info(`Alert sent: ${alert.summary}`);
    } catch (error) {
      logger.error(`Failed to send alert: ${error}`);
    }
  }
}