import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Controller('api/applications')
@UseGuards(JwtGuard)
export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  @Post()
  apply(@CurrentUser() user: AuthUser, @Body() body: CreateApplicationDto) {
    return this.service.apply(user.userId, body);
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.service.listMine(user.userId);
  }

  @Get('received')
  listReceived(@CurrentUser() user: AuthUser) {
    return this.service.listReceived(user.userId);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.approve(user.userId, Number(id));
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.reject(user.userId, Number(id));
  }
}
