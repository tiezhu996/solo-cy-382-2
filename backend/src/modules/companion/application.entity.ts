import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ApplicationStatus } from '../../constants/status';

@Entity('trip_applications')
@Index('idx_application_user_trip', ['applicantId', 'tripId'], { unique: true })
export class ApplicationEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'applicant_id' }) applicantId!: number;
  @Column({ length: 500, nullable: true }) message?: string;
  @Column({ length: 20, default: ApplicationStatus.Pending }) status!: ApplicationStatus;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
