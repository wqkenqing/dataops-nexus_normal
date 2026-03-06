#!/bin/sh

# Generate the env-config.js file with runtime environment variables
# This runs every time the Docker container starts

cat <<EOF > /usr/share/nginx/html/env-config.js
window._env_ = {
  VITE_AUTH_API_URL: "${VITE_AUTH_API_URL:-http://localhost:8081}",
  VITE_AUTH_CLIENT_ID: "${VITE_AUTH_CLIENT_ID:-231814316654413e}",
  VITE_JAVA_API_URL: "${VITE_JAVA_API_URL:-}",
  VITE_PYTHON_API_URL: "${VITE_PYTHON_API_URL:-}"
};
EOF

# Execute the main command (e.g., nginx -g daemon off;)
exec "$@"
