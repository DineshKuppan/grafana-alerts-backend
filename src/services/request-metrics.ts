import { register, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../utils/logger';

export interface RequestMetricsConfig {
  errorThreshold: number; // Error rate threshold (e.g., 0.05 = 5%)
  volumeThreshold: number; // Request volume threshold (e.g., 100000)
  timeWindow: number; // Time window in seconds (e.g., 300 = 5 minutes)
  alertCooldown: number; // Cooldown between alerts in seconds
}

export interface ErrorSummary {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  timeWindow: string;
  services: Record<string, {
    requests: number;
    errors: number;
    errorRate: number;
  }>;
}

export class RequestMetricsService {
  private requestCounter!: Counter<string>;
  private errorCounter!: Counter<string>;
  private requestDuration!: Histogram<string>;
  private activeRequestsGauge!: Gauge<string>;
  private errorRateGauge!: Gauge<string>;
  private lastAlertTime: number = 0;
  private config: RequestMetricsConfig;

  constructor(config: RequestMetricsConfig) {
    this.config = config;
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Total requests counter
    this.requestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service']
    });

    // Error counter
    this.errorCounter = new Counter({
      name: 'http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'route', 'status_code', 'error_type', 'service']
    });

    // Request duration histogram
    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'service'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    });

    // Active requests gauge
    this.activeRequestsGauge = new Gauge({
      name: 'http_requests_active',
      help: 'Number of active HTTP requests',
      labelNames: ['service']
    });

    // Error rate gauge
    this.errorRateGauge = new Gauge({
      name: 'http_error_rate',
      help: 'HTTP error rate percentage',
      labelNames: ['service']
    });
  }

  // Track successful request
  async recordRequest(method: string, route: string, statusCode: number, duration: number, service: string = 'api'): Promise<void> {
    const labels = { method, route, status_code: statusCode.toString(), service };
    
    this.requestCounter.inc(labels);
    this.requestDuration.observe({ method, route, service }, duration);

    // Update error rate
    await this.updateErrorRate(service);
  }

  // Track error request
  async recordError(method: string, route: string, statusCode: number, errorType: string, service: string = 'api'): Promise<void> {
    const requestLabels = { method, route, status_code: statusCode.toString(), service };
    const errorLabels = { method, route, status_code: statusCode.toString(), error_type: errorType, service };
    
    this.requestCounter.inc(requestLabels);
    this.errorCounter.inc(errorLabels);

    // Update error rate
    await this.updateErrorRate(service);

    logger.warn(`Error recorded: ${method} ${route} - ${statusCode} - ${errorType}`);
  }

  // Track active requests
  incrementActiveRequests(service: string = 'api'): void {
    this.activeRequestsGauge.inc({ service });
  }

  decrementActiveRequests(service: string = 'api'): void {
    this.activeRequestsGauge.dec({ service });
  }

  private async updateErrorRate(service: string): Promise<void> {
    try {
      // Get current metrics
      const requestMetrics = await this.requestCounter.get();
      const errorMetrics = await this.errorCounter.get();

      const totalRequests = requestMetrics.values
        .filter((v: any) => v.labels.service === service)
        .reduce((sum: number, v: any) => sum + v.value, 0);

      const totalErrors = errorMetrics.values
        .filter((v: any) => v.labels.service === service)
        .reduce((sum: number, v: any) => sum + v.value, 0);

      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
      this.errorRateGauge.set({ service }, errorRate);

    } catch (error) {
      logger.error(`Failed to update error rate: ${error}`);
    }
  }

  // Check if we should alert based on current metrics
  async checkErrorThresholds(): Promise<ErrorSummary | null> {
    try {
      const now = Date.now() / 1000;
      
      // Check cooldown
      if (now - this.lastAlertTime < this.config.alertCooldown) {
        return null;
      }

      const summary = await this.getErrorSummary();
      
      // Check if we should alert
      if (summary.totalRequests >= this.config.volumeThreshold && 
          summary.errorRate >= this.config.errorThreshold * 100) {
        
        this.lastAlertTime = now;
        logger.error(`High error rate detected: ${summary.errorRate.toFixed(2)}% over ${summary.totalRequests} requests`);
        return summary;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to check error thresholds: ${error}`);
      return null;
    }
  }

  async getErrorSummary(): Promise<ErrorSummary> {
    const requestMetrics = await this.requestCounter.get();
    const errorMetrics = await this.errorCounter.get();

    const totalRequests = requestMetrics.values
      .reduce((sum: number, v: any) => sum + v.value, 0);

    const totalErrors = errorMetrics.values
      .reduce((sum: number, v: any) => sum + v.value, 0);

    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Group by service
    const services: Record<string, { requests: number; errors: number; errorRate: number }> = {};
    
    // Calculate per-service metrics
    const requestsByService = requestMetrics.values
      .reduce((acc: Record<string, number>, v: any) => {
        const service = v.labels.service || 'unknown';
        acc[service] = (acc[service] || 0) + v.value;
        return acc;
      }, {} as Record<string, number>);

    const errorsByService = errorMetrics.values
      .reduce((acc: Record<string, number>, v: any) => {
        const service = v.labels.service || 'unknown';
        acc[service] = (acc[service] || 0) + v.value;
        return acc;
      }, {} as Record<string, number>);

    Object.keys(requestsByService).forEach(service => {
      const requests = requestsByService[service] || 0;
      const errors = errorsByService[service] || 0;
      const serviceErrorRate = requests > 0 ? (errors / requests) * 100 : 0;
      
      services[service] = {
        requests,
        errors,
        errorRate: serviceErrorRate
      };
    });

    return {
      totalRequests,
      totalErrors,
      errorRate,
      timeWindow: `${this.config.timeWindow}s`,
      services
    };
  }

  // Get current request volume for alerting
  async getCurrentRequestVolume(): Promise<number> {
    const requestMetrics = await this.requestCounter.get();
    return requestMetrics.values
      .reduce((sum: number, v: any) => sum + v.value, 0);
  }

  // Reset metrics (useful for testing)
  reset(): void {
    this.requestCounter.reset();
    this.errorCounter.reset();
    this.requestDuration.reset();
    this.activeRequestsGauge.reset();
    this.errorRateGauge.reset();
    this.lastAlertTime = 0;
  }
}

// Express middleware to automatically track requests
export function createMetricsMiddleware(metricsService: RequestMetricsService, serviceName: string = 'api') {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const route = req.route?.path || req.path || 'unknown';
    
    // Increment active requests
    metricsService.incrementActiveRequests(serviceName);

    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = (Date.now() - startTime) / 1000;
      const statusCode = res.statusCode;
      const method = req.method;

      // Decrement active requests
      metricsService.decrementActiveRequests(serviceName);

      // Record request (async, but we don't await to avoid blocking the response)
      if (statusCode >= 400) {
        const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
        metricsService.recordError(method, route, statusCode, errorType, serviceName).catch(error => {
          logger.error(`Failed to record error metrics: ${error}`);
        });
      } else {
        metricsService.recordRequest(method, route, statusCode, duration, serviceName).catch(error => {
          logger.error(`Failed to record request metrics: ${error}`);
        });
      }

      // Call original end
      originalEnd.apply(this, args);
    };

    next();
  };
}