import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanionController } from './companion.controller';
import { CompanionService } from './companion.service';
import { ApplicationController } from './application.controller';
import { TripMemberController } from './trip-member.controller';
import { ApplicationService } from './application.service';
import { ApplicationEntity } from './application.entity';
import { TripMemberEntity } from './trip-member.entity';
import { TripEntity } from '../trip/trip.entity';
import { UserEntity } from '../user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApplicationEntity, TripMemberEntity, TripEntity, UserEntity])],
  controllers: [CompanionController, ApplicationController, TripMemberController],
  providers: [CompanionService, ApplicationService]
})
export class CompanionModule {}
