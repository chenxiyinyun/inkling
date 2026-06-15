import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pickDeliveryTier } from '@inkling/shared';

/**
 * 递送计算助手。
 * MVP 简化：投递后固定短延时入池；笔友往来固定短延时送达（仍保留"在途"的慢质感）。
 * 生产期：按真实距离精算 + RabbitMQ 延时队列，详见 docs/产品设计文档.md §2.6 / §6.3。
 */
@Injectable()
export class DeliveryService {
  constructor(private readonly config: ConfigService) {}

  /** 信件审核通过后、入池前的"在途"到达时刻。 */
  poolVisibleAt(): Date {
    const seconds = this.config.get<number>('letterPoolDelaySeconds') ?? 30;
    return new Date(Date.now() + seconds * 1000);
  }

  /** 信件漂流到期归档时刻。 */
  expireAt(): Date {
    const days = this.config.get<number>('letterMaxDriftDays') ?? 30;
    return new Date(Date.now() + days * 86400000);
  }

  /** 笔友往来书信的递送到达时刻 + 递送工具文案。 */
  correspondenceDelivery(distanceKm: number | null): { deliverAt: Date; vehicleLabel: string } {
    const seconds = this.config.get<number>('correspondenceDeliverSeconds') ?? 60;
    return { deliverAt: new Date(Date.now() + seconds * 1000), vehicleLabel: pickDeliveryTier(distanceKm ?? 0).labelZh };
  }

  vehicleLabel(distanceKm: number | null): string {
    return pickDeliveryTier(distanceKm ?? 0).labelZh;
  }
}
