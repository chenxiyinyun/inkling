import { Global, Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DeliveryScheduler } from './delivery.scheduler';

@Global()
@Module({
  providers: [DeliveryService, DeliveryScheduler],
  exports: [DeliveryService],
})
export class DeliveryModule {}
