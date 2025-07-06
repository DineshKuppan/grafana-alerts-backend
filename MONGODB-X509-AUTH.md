# MongoDB X.509 Certificate Authentication

This project now uses X.509 certificate authentication for MongoDB instead of username/password authentication. This provides token-like authentication that is more secure and suitable for production environments.

## Setup Instructions

1. **Generate Certificates**
   ```bash
   chmod +x generate-certs.sh
   ./generate-certs.sh
   ```

2. **Start Services**
   ```bash
   docker-compose up -d
   ```

## What Changed

### Authentication Method
- **Before**: Username/password authentication (`admin:admin123`)
- **After**: X.509 certificate authentication using client certificates

### Key Changes
- MongoDB now requires TLS connections with client certificates
- The client application uses certificate-based authentication
- A Certificate Authority (CA) is used to sign both server and client certificates

### Files Modified
- `docker-compose.yml`: Updated MongoDB service to use TLS and X.509 authentication
- `mongo-init-x509.js`: New initialization script for X.509 user creation
- `generate-certs.sh`: Script to generate required certificates

### Security Benefits
1. **No passwords in configuration**: Certificates act as secure tokens
2. **Mutual TLS**: Both server and client authenticate each other
3. **Certificate expiration**: Built-in expiration dates for security
4. **CA-based trust**: Centralized certificate management

## Certificate Details

The setup creates the following certificates:
- `ca-cert.pem`: Certificate Authority certificate
- `client-combined.pem`: Client certificate + private key for application
- `server-combined.pem`: Server certificate + private key for MongoDB

## MongoDB Connection

The application now connects using:
```
mongodb://mongodb:27017/monitoring-alerts?authSource=$external&authMechanism=MONGODB-X509&tls=true&tlsCertificateKeyFile=/app/certs/client-combined.pem&tlsCAFile=/app/certs/ca-cert.pem
```

## Troubleshooting

If you encounter certificate issues:
1. Ensure certificates are generated: `ls -la certs/`
2. Check MongoDB logs: `docker-compose logs mongodb`
3. Verify certificate permissions: `chmod 400 certs/*.pem`
4. Regenerate certificates if needed: `./generate-certs.sh`

## Production Considerations

For production use:
1. Use a proper CA or certificate management system
2. Implement certificate rotation
3. Store certificates securely (e.g., Kubernetes secrets, HashiCorp Vault)
4. Monitor certificate expiration dates
5. Use stronger key sizes (4096 bits) for enhanced security
