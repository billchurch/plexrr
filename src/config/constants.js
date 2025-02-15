export const TRANSFER_CONSTANTS = {
    // Memory management
    CHUNK_SIZE: 64 * 1024, // 64KB chunks
    MAX_CONCURRENT_CHUNKS: 32,
    
    // Progress tracking
    SPEED_SAMPLE_SIZE: 10,
    
    // Connection timeouts
    READY_TIMEOUT: 20000,
    KEEPALIVE_INTERVAL: 10000,
    
    // Progress bar configuration
    PROGRESS_BAR: {
      complete: '=',
      incomplete: ' ',
      width: 50
    }
  };
  