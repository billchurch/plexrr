import { Transform } from 'stream';

export class ThrottledStream extends Transform {
    constructor(options = {}) {
        super();
        this.bytesPerSecond = options.bytesPerSecond || 1024 * 1024; // Default 1MB/s
        this.lastCheck = Date.now();
        this.bytesThisPeriod = 0;
    }

    _transform(chunk, encoding, callback) {
        const now = Date.now();
        const timeDelta = now - this.lastCheck;
        this.bytesThisPeriod += chunk.length;

        // Calculate allowed bytes for the time period
        const allowedBytes = (this.bytesPerSecond * timeDelta) / 1000;

        if (this.bytesThisPeriod > allowedBytes) {
            // Calculate delay needed to maintain rate
            const requiredDelay = Math.ceil(
                (1000 * this.bytesThisPeriod) / this.bytesPerSecond - timeDelta
            );
            
            setTimeout(() => {
                this.lastCheck = Date.now();
                this.bytesThisPeriod = 0;
                this.push(chunk);
                callback();
            }, requiredDelay);
        } else {
            this.push(chunk);
            callback();
        }
    }
}
