import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModerationService } from './moderation.service';
import {
  LocalRulesProvider,
  MODERATION_PROVIDER,
  ModerationProvider,
  RemoteApiProvider,
} from './moderation.provider';

@Global()
@Module({
  providers: [
    {
      provide: MODERATION_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ModerationProvider => {
        const which = config.get<string>('moderation.provider') ?? 'local';
        if (which === 'remote') {
          return new RemoteApiProvider(
            config.get<string>('moderation.remoteApiUrl'),
            config.get<string>('moderation.remoteApiKey'),
          );
        }
        return new LocalRulesProvider();
      },
    },
    ModerationService,
  ],
  exports: [ModerationService],
})
export class ModerationModule {}
