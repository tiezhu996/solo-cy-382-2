import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthUser {
  userId: number;
  nickname: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  return context.switchToHttp().getRequest().user;
});
