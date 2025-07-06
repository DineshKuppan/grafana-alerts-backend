# Node.js TypeScript Monitoring System

A comprehensive monitoring system for Redis and PostgreSQL with Grafana dashboards, Prometheus metrics, and alerting.

## Features

- **Health Monitoring**: Real-time health checks for Redis and PostgreSQL
- **Metrics Collection**: Prometheus metrics for service availability and response times
- **Alerting**: Automated alerts via Alertmanager with email and webhook support
- **Dashboards**: Pre-configured Grafana dashboards for visualization
- **TypeScript**: Fully typed Node.js application
- **Docker Support**: Complete Docker Compose setup

## Quick Start

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd monitoring-system
   make setup
   ```

2. **Access services**:
   - Grafana: http://localhost:3000 (admin/admin)
   - Prometheus: http://localhost:9090
   - Alertmanager: http://localhost:9093
   - Monitoring API: http://localhost:3001

## Configuration

### Environment Variables

- `REDIS_URL`: Redis connection string
- `POSTGRES_URL`: PostgreSQL connection string
- `METRICS_PORT`: Port for metrics server
- `HEALTH_CHECK_INTERVAL`: Health check interval in ms
- `ALERT_WEBHOOK_URL`: Alertmanager webhook URL

### Alerting

Configure alerts in `alertmanager.yml`:
- Email notifications
- Webhook integrations
- Slack/Teams notifications

## API Endpoints

- `GET /health` - Overall system health
- `GET /metrics` - Prometheus metrics
- `GET /status` - Service status details

## Metrics

- `service_up`: Service availability (1=up, 0=down)
- `service_response_time_seconds`: Response time histogram
- `health_checks_total`: Health check counter

## Alerts

- **ServiceDown**: Service unavailable for >1 minute
- **ServiceHighResponseTime**: Response time >5 seconds
- **RedisDown**: Redis specific alert
- **PostgresDown**: PostgreSQL specific alert

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Start production
npm start
```

## Docker Commands

```bash
# Start all services
make up

# Stop all services
make down

# View logs
make logs

# Clean up
make clean

# Check health
make health
```

## Grafana Dashboard

The system includes a pre-configured dashboard showing:
- Service status indicators
- Response time graphs
- Health check rates
- Service details table

## Troubleshooting

1. **Services not starting**: Check Docker logs with `make logs`
2. **Metrics not appearing**: Verify Prometheus is scraping the `/metrics` endpoint
3. **Alerts not firing**: Check Alertmanager configuration and webhook URLs
4. **Dashboard not loading**: Ensure Grafana can reach Prometheus

## License

MIT
