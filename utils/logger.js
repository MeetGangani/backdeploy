// Simple logger utility
const createLogger = (module) => {
  return {
    info: (message, ...args) => {
      console.log(`[${module}] INFO:`, message, ...args);
    },
    error: (message, ...args) => {
      console.error(`[${module}] ERROR:`, message, ...args);
    },
    warn: (message, ...args) => {
      console.warn(`[${module}] WARN:`, message, ...args);
    },
    debug: (message, ...args) => {
      console.debug(`[${module}] DEBUG:`, message, ...args);
    }
  };
};

export { createLogger }; 