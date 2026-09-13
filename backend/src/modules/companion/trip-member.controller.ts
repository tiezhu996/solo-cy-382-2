import { Controller, Get, Param } from '@nestjs/common';
import { ApplicationService } from './application.service';

@Controller('api/trips/:tripId/members')
export class TripMemberController {
  constructor(private readonly service: ApplicationService) {}

  @Get()
  list(@Param('tripId') tripId: string) {
    return this.service.listMembers(Number(tripId));
  }
}
