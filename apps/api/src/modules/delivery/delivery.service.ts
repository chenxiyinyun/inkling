import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { deliveryDelayMs, deliveryVehicleLabel } from './delivery.timing';

/**
 * 递送计算助手。
 * - 信件入海：无收件人、距离未知，用固定短延时演示"漂入海面"。
 * - 笔友往来：按真实距离 baseHours 精算在途时长（缩放因子见 deliveryHoursScale）。
 * 生产期再叠加 RabbitMQ 延时队列做秒级叫醒，详见 docs/产品设计文档.md §2.6 / §6.3。
 */
@Injectable()
export class DeliveryService {
  constructor(private readonly config: ConfigService) {}

  /** 信件审核通过后、入池前的"在途"到达时刻（距离未知，固定短延时）。 */
  poolVisibleAt(): Date {
    const seconds = this.config.get<number>('letterPoolDelaySeconds') ?? 30;
    return new Date(Date.now() + seconds * 1000);
  }

  /** 信件漂流到期归档时刻。 */
  expireAt(): Date {
    const days = this.config.get<number>('letterMaxDriftDays') ?? 30;
    return new Date(Date.now() + days * 86400000);
  }

  /** 笔友往来书信按真实距离精算的递送到达时刻 + 递送工具文案。 */
  correspondenceDelivery(distanceKm: number | null): { deliverAt: Date; vehicleLabel: string } {
    const scale = this.config.get<number>('deliveryHoursScale') ?? 1;
    return {
      deliverAt: new Date(Date.now() + deliveryDelayMs(distanceKm, scale)),
      vehicleLabel: deliveryVehicleLabel(distanceKm),
    };
  }

  vehicleLabel(distanceKm: number | null): string {
    return deliveryVehicleLabel(distanceKm);
  }
}
