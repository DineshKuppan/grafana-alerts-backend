#!/bin/bash

set -e

# Create certs directory if it doesn't exist
mkdir -p certs
cd certs

# Generate CA private key
openssl genpkey -algorithm RSA -out ca-key.pem -aes256 -pass pass:changeme

# Generate CA certificate
openssl req -new -x509 -key ca-key.pem -out ca-cert.pem -days 365 -passin pass:changeme -subj "/C=US/ST=CA/L=San Francisco/O=MonitoringApp/CN=MonitoringCA"

# Generate client private key
openssl genpkey -algorithm RSA -out client-key.pem

# Generate client certificate signing request
openssl req -new -key client-key.pem -out client-csr.pem -subj "/C=US/ST=CA/L=San Francisco/O=MonitoringApp/CN=monitoring_client"

# Generate client certificate signed by CA
openssl x509 -req -in client-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -out client-cert.pem -days 365 -CAcreateserial -passin pass:changeme

# Create combined client certificate file
cat client-cert.pem client-key.pem > client-combined.pem

# Generate server private key
openssl genpkey -algorithm RSA -out server-key.pem

# Generate server certificate signing request
openssl req -new -key server-key.pem -out server-csr.pem -subj "/C=US/ST=CA/L=San Francisco/O=MonitoringApp/CN=mongodb"

# Generate server certificate signed by CA
openssl x509 -req -in server-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -out server-cert.pem -days 365 -CAcreateserial -passin pass:changeme

# Create combined server certificate file
cat server-cert.pem server-key.pem > server-combined.pem

# Set proper permissions
chmod 400 *.pem
chmod 444 ca-cert.pem

# Clean up temporary files
rm -f *.csr *.srl

echo "Certificates generated successfully!"
echo "CA Certificate: certs/ca-cert.pem"
echo "Client Certificate: certs/client-combined.pem"
echo "Server Certificate: certs/server-combined.pem"
echo ""
echo "To use these certificates, run:"
echo "  docker-compose up -d"
