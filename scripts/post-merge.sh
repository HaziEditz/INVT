#!/bin/bash
set -e

# No build step required — pure Node.js/static file server.
# Dependencies are not managed via npm install (no package.json in root).
# Workflows are restarted automatically by the platform after merge.
echo "Post-merge setup complete."
