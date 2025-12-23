#!/bin/bash

# ==============================================================================
# Evernote Clone - Firewall Setup Script
# Configures UFW and iptables for Docker and application access
# ==============================================================================

set -e

echo ""
echo "========================================"
echo "  Firewall Configuration Script"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] Please run as root (sudo)"
    exit 1
fi

# ==============================================================================
# UFW Configuration
# ==============================================================================

echo "[INFO] Configuring UFW..."

# Check if UFW is installed
if command -v ufw &> /dev/null; then
    # Allow SSH (important - don't lock yourself out!)
    echo "[INFO] Allowing SSH..."
    ufw allow ssh
    ufw allow 22/tcp

    # Allow HTTP and HTTPS
    echo "[INFO] Allowing HTTP/HTTPS..."
    ufw allow 80/tcp
    ufw allow 443/tcp

    # Allow Docker subnet to communicate with host
    # This is essential for containers to access services on host
    echo "[INFO] Allowing Docker network traffic..."
    ufw allow from 172.16.0.0/12 to any comment "Docker networks"
    ufw allow from 10.0.0.0/8 to any comment "Docker/internal networks"
    ufw allow from 192.168.0.0/16 to any comment "Local network"

    # Allow specific application ports
    echo "[INFO] Allowing application ports..."
    ufw allow 3000:3010/tcp comment "Next.js/Web apps"
    ufw allow 4000:4010/tcp comment "API servers"
    ufw allow 5432/tcp comment "PostgreSQL"
    ufw allow 6379/tcp comment "Redis"
    ufw allow 7700/tcp comment "Meilisearch"
    ufw allow 9000/tcp comment "MinIO API"
    ufw allow 9001/tcp comment "MinIO Console"

    # Enable UFW if not already enabled
    if ufw status | grep -q "Status: inactive"; then
        echo "[INFO] Enabling UFW..."
        ufw --force enable
    fi

    ufw reload
    echo "[SUCCESS] UFW configured"
    ufw status verbose
else
    echo "[WARNING] UFW not installed, skipping..."
fi

# ==============================================================================
# iptables Configuration (for Docker compatibility)
# ==============================================================================

echo ""
echo "[INFO] Configuring iptables for Docker..."

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true

# Allow Docker bridge traffic
iptables -A INPUT -i docker0 -j ACCEPT 2>/dev/null || true

# Allow traffic from Docker networks to host
iptables -A INPUT -s 172.16.0.0/12 -j ACCEPT 2>/dev/null || true
iptables -A INPUT -s 10.0.0.0/8 -j ACCEPT 2>/dev/null || true

# Allow localhost
iptables -A INPUT -i lo -j ACCEPT 2>/dev/null || true

# FORWARD chain for Docker (if not already handled by Docker)
iptables -A FORWARD -i docker0 -j ACCEPT 2>/dev/null || true
iptables -A FORWARD -o docker0 -j ACCEPT 2>/dev/null || true

echo "[SUCCESS] iptables configured"

# ==============================================================================
# Persist iptables rules
# ==============================================================================

echo ""
echo "[INFO] Persisting iptables rules..."

if command -v iptables-save &> /dev/null; then
    if [ -d /etc/iptables ]; then
        iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
        echo "[SUCCESS] iptables rules saved to /etc/iptables/rules.v4"
    elif [ -d /etc/sysconfig ]; then
        iptables-save > /etc/sysconfig/iptables 2>/dev/null || true
        echo "[SUCCESS] iptables rules saved to /etc/sysconfig/iptables"
    else
        echo "[WARNING] Could not find iptables config directory"
        echo "[INFO] Run 'apt install iptables-persistent' to persist rules"
    fi
fi

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "========================================"
echo "  Firewall Configuration Complete"
echo "========================================"
echo ""
echo "Allowed ports:"
echo "  - SSH:        22"
echo "  - HTTP:       80"
echo "  - HTTPS:      443"
echo "  - Web Apps:   3000-3010"
echo "  - APIs:       4000-4010"
echo "  - PostgreSQL: 5432"
echo "  - Redis:      6379"
echo "  - Meilisearch:7700"
echo "  - MinIO:      9000, 9001"
echo ""
echo "Allowed networks:"
echo "  - Docker:     172.16.0.0/12, 10.0.0.0/8"
echo "  - Local:      192.168.0.0/16"
echo ""
echo "Test Docker-to-host connectivity:"
echo "  docker run --rm curlimages/curl curl -I http://172.17.0.1:3005"
echo ""
