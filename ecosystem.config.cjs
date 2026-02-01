const path = require('path')

module.exports = {
  apps: [
    {
      name: 'sql-agent',
      script: './start.sh',
      interpreter: '/bin/bash',
      // Use current directory or override with PM2_APP_CWD
      cwd: process.env.PM2_APP_CWD || path.resolve(__dirname),
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Restart on failure
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
    },
  ],
}
