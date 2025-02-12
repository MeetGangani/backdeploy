// Simple logger utility
const getTimestamp = () => new Date().toISOString();

const formatMessage = (level, module, message, ...args) => {
  const timestamp = getTimestamp();
  const formattedArgs = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ');

  return `[${timestamp}] [${level}] [${module}] ${message} ${formattedArgs}`.trim();
};

const createLogger = (module) => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    info: (message, ...args) => {
      console.log(formatMessage('INFO', module, message, ...args));
    },
    error: (message, ...args) => {
      console.error(formatMessage('ERROR', module, message, ...args));
      // In production, you might want to send critical errors to a monitoring service
      if (isProduction) {
        // Add your error monitoring service here (e.g., Sentry)
      }
    },
    warn: (message, ...args) => {
      console.warn(formatMessage('WARN', module, message, ...args));
    },
    debug: (message, ...args) => {
      // Only log debug messages in development
      if (!isProduction) {
        console.debug(formatMessage('DEBUG', module, message, ...args));
      }
    },
    // Add method to log sensitive info only in development
    sensitive: (message, ...args) => {
      if (!isProduction) {
        console.log(formatMessage('SENSITIVE', module, message, ...args));
      }
    }
  };
};

export { createLogger }; 