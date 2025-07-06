import dotenv from 'dotenv';
import { MonitoringConfig } from '../types';

dotenv.config();

export const config: MonitoringConfig = {
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        timeout: 5000
    },
    postgres: {
        url: process.env.POSTGRES_URL || 'postgresql://postgres:password@localhost:5432/monitoring',
        timeout: 5000
    },
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
    metricsPort: parseInt(process.env.METRICS_PORT || '3001'),
    alerts: {
        webhookUrl: process.env.ALERT_WEBHOOK_URL || 'http://localhost:9093/api/v1/alerts',
        enabled: process.env.ALERTS_ENABLED !== 'false'
    },
    slack: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        channel: process.env.SLACK_CHANNEL || '#monitoring',
        username: process.env.SLACK_USERNAME || 'MonitorBot',
        enabled: process.env.SLACK_ENABLED === 'true' && !!process.env.SLACK_WEBHOOK_URL
    },
    errorAlerts: {
        enabled: process.env.ERROR_ALERTS_ENABLED === 'true',
        errorThreshold: parseFloat(process.env.ERROR_THRESHOLD || '0.05'), // 5%
        volumeThreshold: parseInt(process.env.VOLUME_THRESHOLD || '100000'), // 100k requests
        timeWindow: parseInt(process.env.ERROR_TIME_WINDOW || '300'), // 5 minutes
        alertCooldown: parseInt(process.env.ERROR_ALERT_COOLDOWN || '600') // 10 minutes
    },
    requestMetrics: {
        errorThreshold: parseFloat(process.env.ERROR_THRESHOLD || '0.05'),
        volumeThreshold: parseInt(process.env.VOLUME_THRESHOLD || '100000'),
        timeWindow: parseInt(process.env.ERROR_TIME_WINDOW || '300'),
        alertCooldown: parseInt(process.env.ERROR_ALERT_COOLDOWN || '600')
    },
    mongodb: {
        enabled: process.env.MONGODB_ENABLED === 'true',
        connectionString: process.env.MONGODB_URL || 'mongodb://localhost:27017/monitoring-alerts',
        database: process.env.MONGODB_DATABASE || 'monitoring-alerts'
    }
};