#!/bin/bash

# MongoDB Multi-User Authentication Test Script
# This script tests all the created users to ensure they have the correct permissions

echo "Testing MongoDB Multi-User Authentication..."
echo "=========================================="

# Wait for MongoDB to be ready
echo "Waiting for MongoDB to be ready..."
sleep 10

# Test function
test_user() {
    local username=$1
    local password=$2
    local database=$3
    local test_name=$4
    
    echo "Testing $test_name ($username)..."
    
    # Test connection
    docker exec -it grafanaalertsapp-mongodb-1 mongosh \
        --username "$username" \
        --password "$password" \
        --authenticationDatabase "admin" \
        --eval "
            try {
                db = db.getSiblingDB('$database');
                print('✓ Connection successful');
                
                // Test read permission
                var count = db.alerts.countDocuments();
                print('✓ Read permission: Found ' + count + ' documents');
                
                // Test write permission (if user should have it)
                if ('$username' === 'monitoring_app' || '$username' === 'api_service' || '$username' === 'db_admin') {
                    try {
                        db.test_collection.insertOne({test: 'data', timestamp: new Date()});
                        print('✓ Write permission: Insert successful');
                        db.test_collection.deleteOne({test: 'data'});
                        print('✓ Write permission: Delete successful');
                    } catch (e) {
                        print('✗ Write permission failed: ' + e.message);
                    }
                } else {
                    print('- Write permission: Not expected for this user');
                }
                
                print('');
            } catch (e) {
                print('✗ Connection failed: ' + e.message);
                print('');
            }
        " 2>/dev/null
}

# Test all users
echo "Starting user permission tests..."
echo ""

test_user "monitoring_app" "MonitoringApp2025!" "monitoring-alerts" "Main Application User"
test_user "analytics_user" "Analytics2025!" "monitoring-alerts" "Analytics User (Read-only)"
test_user "backup_user" "Backup2025!" "monitoring-alerts" "Backup User"
test_user "dev_user" "Developer2025!" "monitoring-alerts" "Developer User (Read-only)"
test_user "db_admin" "DbAdmin2025!" "monitoring-alerts" "Database Administrator"
test_user "api_service" "ApiService2025!" "monitoring-alerts" "API Service User"

echo "=========================================="
echo "Testing completed!"
echo ""
echo "Connection string examples:"
echo "Main App: mongodb://monitoring_app:MonitoringApp2025!@localhost:27017/monitoring-alerts?authSource=admin"
echo "Analytics: mongodb://analytics_user:Analytics2025!@localhost:27017/monitoring-alerts?authSource=admin"
echo "Backup: mongodb://backup_user:Backup2025!@localhost:27017/monitoring-alerts?authSource=admin"
echo "Dev: mongodb://dev_user:Developer2025!@localhost:27017/monitoring-alerts?authSource=admin"
echo "Admin: mongodb://db_admin:DbAdmin2025!@localhost:27017/monitoring-alerts?authSource=admin"
echo "API: mongodb://api_service:ApiService2025!@localhost:27017/monitoring-alerts?authSource=admin"
