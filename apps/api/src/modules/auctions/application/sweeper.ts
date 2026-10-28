import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { AuctionCloser } from './closer.js';
import { AUCTION_CONFIG, type AuctionConfig } from './support.js';

// In-process sweeper (MVP: no Redis/BullMQ). The DB (`ends_at`) stays the authority.
@Injectable()
export class AuctionSweeper implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('AuctionSweeper');
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly closer: AuctionCloser,
    @Inject(AUCTION_CONFIG) private readonly config: AuctionConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.sweeperEnabled) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.sweepIntervalMs);
    this.timer.unref();
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.closer.sweep();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'sweep failed');
    } finally {
      this.running = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    // Let an in-flight pass finish before the pool is closed.
    while (this.running) await new Promise((r) => setTimeout(r, 20));
  }
}
