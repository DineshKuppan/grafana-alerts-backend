import { register, Gauge, Counter, Histogram } from 'prom-client';
import { ServiceStatus } from '../types';

export class MetricsService {
  private serviceUpGauge: Gauge<string>;
  private serviceResponseTimeHistogram: Histogram<string>;
  private healthCheckCounter: Counter<string>;

  constructor() {
    // Clear default metrics
    register.clear();

    // Service availability gauge (1 = up, 0 = down)
    this.serviceUpGauge = new Gauge({
      name: 'service_up',
      help: 'Service availability (1 = up, 0 = down)',
      labelNames: ['service']
    });

    // Response time histogram
    this.serviceResponseTimeHistogram = new Histogram({
      name: 'service_response_time_seconds',
      help: 'Service response time in seconds',
      labelNames: ['service'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
    });

    // Health check counter
    this.healthCheckCounter = new Counter({
      name: 'health_checks_total',
      help: 'Total number of health checks performed',
      labelNames: ['service', 'status']
    });
  }

  updateServiceMetrics(status: ServiceStatus): void {
    const labels = { service: status.name };
    
    // Update availability gauge
    this.serviceUpGauge.set(labels, status.status === 'up' ? 1 : 0);
    
    // Update response time
    this.serviceResponseTimeHistogram.observe(labels, status.responseTime / 1000);
    
    // Update counter
    this.healthCheckCounter.inc({ 
      service: status.name, 
      status: status.status 
    });
  }

  getMetrics(): Promise<string> {
    return register.metrics();
  }

  getRegister() {
    return register;
  }
}