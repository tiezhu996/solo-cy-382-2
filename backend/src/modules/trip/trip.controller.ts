import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { TripService } from './trip.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@Controller('api/trips')
export class TripController {
  constructor(private readonly service: TripService) {}

  @Get()
  list() { return this.service.list(); }

  @Post()
  @UseGuards(JwtGuard)
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    const { ownerId, ...payload } = body ?? {};
    void ownerId;
    return this.service.create({ ...payload, ownerId: user.userId });
  }

  @Get('match')
  match(@Query('destination') destination: string, @Query('date') date: string, @Query('budgetMax') budgetMax: string) {
    return this.service.match(destination, date, Number(budgetMax));
  }
}
