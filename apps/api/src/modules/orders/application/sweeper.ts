import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { ORDER_CONFIG, type OrderConfig } from './support.js';

// In-process sweeper for unpaid orders (MVP: no job queue). The DB clock decides what is overdue.
@Injectable()
export class OrderSweeper implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('OrderSweeper');
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly orders: OrdersService,
    @Inject(ORDER_CONFIG) private readonly config: OrderConfig,
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
      await this.orders.sweepExpired();
      await this.orders.sweepAutoConfirm();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'sweep failed');
    } finally {
      this.running = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    while (this.running) await new Promise((r) => setTimeout(r, 20));
  }
}
