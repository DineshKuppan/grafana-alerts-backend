.PHONY: build up down logs clean install dev

# Build and start all services
up:
	docker-compose up -d

# Stop all services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# Clean up everything
clean:
	docker-compose down -v
	docker system prune -f

# Install dependencies
install:
	npm install

# Run in development mode
dev:
	npm run dev

# Build TypeScript
build:
	npm run build

# Check service health
health:
	@echo "Checking service health..."
	@curl -s http://localhost:3001/health | jq .

# Check metrics
metrics:
	@echo "Fetching metrics..."
	@curl -s http://localhost:3001/metrics

# Setup everything
setup: install build up
	@echo "Waiting for services to start..."
	@sleep 30
	@echo "Services should be ready!"
	@echo "Grafana: http://localhost:3000 (admin/admin)"
	@echo "Prometheus: http://localhost:9090"
	@echo "Alertmanager: http://localhost:9093"
	@echo "Monitoring API: http://localhost:3001"