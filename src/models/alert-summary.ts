export interface IAlertSummary extends Document {
    date: Date;
    service: string;
    alertType: string;
    severity: string;
    totalAlerts: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
    totalDuration: number;
    resolvedAlerts: number;
    unresolvedAlerts: number;
  }
  
  const AlertSummarySchema = new Schema<IAlertSummary>({
    date: { type: Date, required: true },
    service: { type: String, required: true },
    alertType: { type: String, required: true },
    severity: { type: String, required: true },
    totalAlerts: { type: Number, default: 0 },
    avgDuration: { type: Number, default: 0 },
    maxDuration: { type: Number, default: 0 },
    minDuration: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    resolvedAlerts: { type: Number, default: 0 },
    unresolvedAlerts: { type: Number, default: 0 }
  }, {
    timestamps: true,
    collection: 'alert_summaries'
  });
  
  // Unique constraint to prevent duplicates
  AlertSummarySchema.index({ 
    date: 1, 
    service: 1, 
    alertType: 1, 
    severity: 1 
  }, { unique: true });
  
  export const AlertSummary = mongoose.model<IAlertSummary>('AlertSummary', AlertSummarySchema);
  import { ServiceStatus } from '../types';
  import { logger } from '../utils/logger';
  
  export interface SlackConfig {
    webhookUrl: string;
    channel: string;
    username: string;
    enabled: boolean;
  }
  
  export interface SlackMessage {
    channel?: string;
    username?: string;
    icon_emoji?: string;
    text: string;
    attachments?: SlackAttachment[];
  }
  
  export interface SlackAttachment {
    color: 'good' | 'warning' | 'danger';
    title: string;
    text: string;
    fields: SlackField[];
    ts: number;
  }
  
  export interface SlackField {
    title: string;
    value: string;
    short: boolean;
  }
  
  export class SlackNotifier {
    private config: SlackConfig;
    private serviceStates: Map<string, 'up' | 'down'> = new Map();
  
    constructor(config: SlackConfig) {
      this.config = config;
    }
  
    async processAlert(status: ServiceStatus): Promise<void> {
      if (!this.config.enabled) return;
  
      const previousState = this.serviceStates.get(status.name);
      this.serviceStates.set(status.name, status.status);
  
      // Only send alerts on state changes
      if (previousState === status.status) return;
  
      if (status.status === 'down') {
        await this.sendServiceDownAlert(status);
      } else if (status.status === 'up' && previousState === 'down') {
        await this.sendServiceRecoveredAlert(status);
      }
    }
  
    private async sendServiceDownAlert(status: ServiceStatus): Promise<void> {
      const emoji = this.getServiceEmoji(status.name);
      const message: SlackMessage = {
        channel: this.config.channel,
        username: this.config.username,
        icon_emoji: ':rotating_light:',
        text: `🚨 *${status.name.toUpperCase()} SERVICE DOWN* 🚨`,
        attachments: [{
          color: 'danger',
          title: `${emoji} ${status.name} Service Alert`,
          text: `The ${status.name} service is not responding and may require immediate attention.`,
          fields: [
            {
              title: 'Service',
              value: status.name,
              short: true
            },
            {
              title: 'Status',
              value: '🔴 DOWN',
              short: true
            },
            {
              title: 'Error',
              value: status.error || 'Connection failed',
              short: false
            },
            {
              title: 'Response Time',
              value: `${status.responseTime}ms`,
              short: true
            },
            {
              title: 'Time',
              value: status.lastCheck.toISOString(),
              short: true
            }
          ],
          ts: Math.floor(status.lastCheck.getTime() / 1000)
        }]
      };
  
      await this.sendSlackMessage(message);
    }
  
    private async sendServiceRecoveredAlert(status: ServiceStatus): Promise<void> {
      const emoji = this.getServiceEmoji(status.name);
      const message: SlackMessage = {
        channel: this.config.channel,
        username: this.config.username,
        icon_emoji: ':white_check_mark:',
        text: `✅ *${status.name.toUpperCase()} SERVICE RECOVERED* ✅`,
        attachments: [{
          color: 'good',
          title: `${emoji} ${status.name} Service Recovered`,
          text: `The ${status.name} service is now responding normally.`,
          fields: [
            {
              title: 'Service',
              value: status.name,
              short: true
            },
            {
              title: 'Status',
              value: '🟢 UP',
              short: true
            },
            {
              title: 'Response Time',
              value: `${status.responseTime}ms`,
              short: true
            },
            {
              title: 'Recovery Time',
              value: status.lastCheck.toISOString(),
              short: true
            }
          ],
          ts: Math.floor(status.lastCheck.getTime() / 1000)
        }]
      };
  
      await this.sendSlackMessage(message);
    }
  
    private getServiceEmoji(service: string): string {
      const emojis: Record<string, string> = {
        redis: ':redis:',
        rabbitmq: ':rabbit:',
        postgres: ':elephant:',
        postgresql: ':elephant:'
      };
      return emojis[service.toLowerCase()] || ':gear:';
    }
  
    private async sendSlackMessage(message: SlackMessage): Promise<void> {
      try {
        const response = await fetch(this.config.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });
  
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
  
        logger.info(`Slack notification sent for ${message.text}`);
      } catch (error) {
        logger.error(`Failed to send Slack notification: ${error}`);
      }
    }
  
    async sendTestMessage(): Promise<void> {
      const message: SlackMessage = {
        channel: this.config.channel,
        username: this.config.username,
        icon_emoji: ':gear:',
        text: '🔧 *Monitoring System Test*',
        attachments: [{
          color: 'good',
          title: 'Monitoring System Online',
          text: 'The monitoring system is running and ready to send alerts.',
          fields: [
            {
              title: 'Status',
              value: 'Online',
              short: true
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
  
      await this.sendSlackMessage(message);
    }
  }
  
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