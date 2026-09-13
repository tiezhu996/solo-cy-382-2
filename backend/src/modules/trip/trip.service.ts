import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { TripEntity } from './trip.entity';
import { TripMemberEntity } from '../companion/trip-member.entity';

@Injectable()
export class TripService {
  constructor(
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(TripMemberEntity) private readonly members: Repository<TripMemberEntity>
  ) {}

  create(input: Partial<TripEntity>) { return this.trips.save(this.trips.create(input)); }

  async list() {
    const trips = await this.trips.find({ order: { departDate: 'ASC' } });
    return Promise.all(trips.map(async trip => ({ ...trip, memberCount: await this.members.count({ where: { tripId: trip.id } }) })));
  }

  match(destination: string, date: string, budgetMax: number) {
    return this.trips.find({ where: { destination, departDate: Between(date, date), budgetMax } });
  }
}
