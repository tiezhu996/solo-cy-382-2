import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TripMemberRole } from '../../constants/status';

@Entity('trip_members')
@Index('idx_member_trip_user', ['tripId', 'userId'], { unique: true })
export class TripMemberEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'user_id' }) userId!: number;
  @Column({ length: 20, default: TripMemberRole.Companion }) role!: TripMemberRole;
  @CreateDateColumn({ name: 'joined_at' }) joinedAt!: Date;
}
