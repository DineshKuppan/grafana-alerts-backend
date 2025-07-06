export interface ServiceStatus {
    name: string;
    status: 'up' | 'down';
    responseTime: number;
    lastCheck: Date;
    error?: string;
  }
  
  export interface AlertConfig {
    webhookUrl: string;
    enabled: boolean;
  }
  
  export interface SlackConfig {
    webhookUrl: string;
    channel: string;
    username: string;
    enabled: boolean;
  }
  
  export interface ErrorAlertConfig {
    enabled: boolean;
    errorThreshold: number; // Error rate threshold (0.05 = 5%)
    volumeThreshold: number; // Request volume threshold (100000)
    timeWindow: number; // Time window in seconds
    alertCooldown: number; // Cooldown between alerts
  }
  
  export interface RequestMetricsConfig {
    errorThreshold: number;
    volumeThreshold: number;
    timeWindow: number;
    alertCooldown: number;
  }
  
  export interface MongoDBConfig {
    enabled: boolean;
    connectionString: string;
    database: string;
  }
  
  export interface MonitoringConfig {
    redis: {
      url: string;
      timeout: number;
    };
    postgres: {
      url: string;
      timeout: number;
    };
    healthCheckInterval: number;
    metricsPort: number;
    alerts: AlertConfig;
    slack: SlackConfig;
    errorAlerts: ErrorAlertConfig;
    requestMetrics: RequestMetricsConfig;
    mongodb: MongoDBConfig;
  }