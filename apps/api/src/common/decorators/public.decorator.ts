import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** 标记端点为公开（跳过全局 JWT 守卫）。 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
