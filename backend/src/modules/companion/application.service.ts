import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AppException } from '../../common/errors/app.exception';
import { ERROR_CODES } from '../../constants/errors';
import { ApplicationStatus, TripMemberRole, TripStatus } from '../../constants/status';
import { UserEntity } from '../user/user.entity';
import { TripEntity } from '../trip/trip.entity';
import { ApplicationEntity } from './application.entity';
import { TripMemberEntity } from './trip-member.entity';
import { CreateApplicationDto } from './dto/create-application.dto';

interface ApplicationView {
  id: number;
  tripId: number;
  status: ApplicationStatus;
  message?: string | null;
  createdAt: Date;
  updatedAt: Date;
  applicant: { id: number; nickname: string };
  trip: { id: number; destination: string; departDate: string; status: string; companionCount: number };
}

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    @InjectRepository(ApplicationEntity) private readonly applications: Repository<ApplicationEntity>,
    @InjectRepository(TripMemberEntity) private readonly members: Repository<TripMemberEntity>,
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly dataSource: DataSource
  ) {}

  async apply(applicantId: number, dto: CreateApplicationDto): Promise<ApplicationView> {
    const tripId = Number(dto.tripId);
    const message = dto.message?.trim();
    if (!Number.isInteger(tripId) || tripId <= 0) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '行程 ID 不合法', 400);
    }
    if (message && message.length > 500) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '申请留言不能超过 500 字', 400);
    }

    const trip = await this.trips.findOneBy({ id: tripId });
    if (!trip) throw new AppException(ERROR_CODES.TRIP_NOT_FOUND, '行程不存在', 404);
    if (trip.ownerId === applicantId) {
      throw new AppException(ERROR_CODES.CANNOT_APPLY_OWN_TRIP, '不能申请自己发布的行程', 400);
    }

    const existing = await this.applications.findOneBy({ applicantId, tripId });
    if (existing) {
      if (existing.status === ApplicationStatus.Pending) {
        throw new AppException(ERROR_CODES.APPLICATION_DUPLICATE, '你对该行程已有一条待处理申请', 409);
      }
      if (existing.status === ApplicationStatus.Rejected) {
        throw new AppException(ERROR_CODES.APPLICATION_REJECTED, '申请已被拒绝，不能再次申请该行程', 409);
      }
      throw new AppException(ERROR_CODES.ALREADY_TRIP_MEMBER, '你已是该行程的成员', 409);
    }

    const isMember = await this.members.exists({ where: { tripId, userId: applicantId } });
    if (isMember) throw new AppException(ERROR_CODES.ALREADY_TRIP_MEMBER, '你已是该行程的成员', 409);

    if (trip.status !== TripStatus.Open || (await this.countCompanions(tripId)) >= trip.companionCount) {
      throw new AppException(ERROR_CODES.TRIP_FULL, '该行程已满员，不再接受申请', 409);
    }

    let created: ApplicationEntity;
    try {
      created = await this.applications.save(this.applications.create({ tripId, applicantId, message: message || undefined }));
    } catch (error) {
      // 唯一索引兜底并发提交
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new AppException(ERROR_CODES.APPLICATION_DUPLICATE, '你对该行程已有一条待处理申请', 409);
      }
      throw error;
    }
    this.logger.log(`用户 ${applicantId} 提交了行程 ${tripId} 的同行申请`);
    return this.toView(created);
  }

  async listReceived(ownerId: number): Promise<ApplicationView[]> {
    const ownedTrips = await this.trips.find({ where: { ownerId }, select: { id: true } });
    if (ownedTrips.length === 0) return [];
    const rows = await this.applications.find({
      where: { tripId: In(ownedTrips.map(trip => trip.id)) },
      order: { createdAt: 'DESC' }
    });
    // 待处理申请排在最前；find 已按创建时间倒序，Array.sort 保持稳定性
    rows.sort((a, b) => Number(b.status === ApplicationStatus.Pending) - Number(a.status === ApplicationStatus.Pending));
    return Promise.all(rows.map(row => this.toView(row)));
  }

  async listMine(applicantId: number): Promise<ApplicationView[]> {
    const rows = await this.applications.find({ where: { applicantId }, order: { createdAt: 'DESC' } });
    return Promise.all(rows.map(row => this.toView(row)));
  }

  async approve(ownerId: number, applicationId: number): Promise<ApplicationView> {
    return this.dataSource.transaction(async manager => {
      const requested = await manager.findOne(ApplicationEntity, { where: { id: applicationId } });
      if (!requested) throw new AppException(ERROR_CODES.APPLICATION_NOT_FOUND, '申请不存在', 404);

      // 先锁定行程行，串行化同一行程的并发审批，避免超额占用名额
      const trip = await manager.findOne(TripEntity, { where: { id: requested.tripId }, lock: { mode: 'pessimistic_write' } });
      if (!trip) throw new AppException(ERROR_CODES.TRIP_NOT_FOUND, '行程不存在', 404);
      if (trip.ownerId !== ownerId) throw new AppException(ERROR_CODES.NOT_TRIP_OWNER, '只有行程创建者可以审批申请', 403);

      // 加锁重读申请：InnoDB 锁定读读取最新已提交版本，并发重复审批会在此看到最新状态
      const application = await manager.findOne(ApplicationEntity, { where: { id: applicationId }, lock: { mode: 'pessimistic_write' } });
      if (!application) throw new AppException(ERROR_CODES.APPLICATION_NOT_FOUND, '申请不存在', 404);
      if (application.status !== ApplicationStatus.Pending) {
        throw new AppException(ERROR_CODES.APPLICATION_ALREADY_HANDLED, '该申请已处理', 409);
      }

      const taken = await manager.count(TripMemberEntity, { where: { tripId: trip.id } });
      if (taken >= trip.companionCount) {
        throw new AppException(ERROR_CODES.TRIP_FULL, '该行程已满员，无法同意申请', 409);
      }

      await manager.insert(TripMemberEntity, { tripId: trip.id, userId: application.applicantId, role: TripMemberRole.Companion });
      application.status = ApplicationStatus.Approved;
      await manager.save(application);

      const members = taken + 1;
      if (members >= trip.companionCount) {
        trip.status = TripStatus.Matched;
        await manager.save(trip);
        this.logger.log(`行程 ${trip.id} 名额已满，状态同步为 MATCHED`);
      }
      return this.toView(application);
    });
  }

  async reject(ownerId: number, applicationId: number): Promise<ApplicationView> {
    const application = await this.applications.findOneBy({ id: applicationId });
    if (!application) throw new AppException(ERROR_CODES.APPLICATION_NOT_FOUND, '申请不存在', 404);

    const trip = await this.trips.findOneBy({ id: application.tripId });
    if (!trip) throw new AppException(ERROR_CODES.TRIP_NOT_FOUND, '行程不存在', 404);
    if (trip.ownerId !== ownerId) throw new AppException(ERROR_CODES.NOT_TRIP_OWNER, '只有行程创建者可以审批申请', 403);
    if (application.status !== ApplicationStatus.Pending) {
      throw new AppException(ERROR_CODES.APPLICATION_ALREADY_HANDLED, '该申请已处理', 409);
    }

    application.status = ApplicationStatus.Rejected;
    await this.applications.save(application);
    this.logger.log(`行程 ${trip.id} 的申请 ${application.id} 已被拒绝`);
    return this.toView(application);
  }

  async listMembers(tripId: number) {
    const trip = await this.trips.findOneBy({ id: tripId });
    if (!trip) throw new AppException(ERROR_CODES.TRIP_NOT_FOUND, '行程不存在', 404);

    const members = await this.members.find({ where: { tripId }, order: { joinedAt: 'ASC' } });
    const userIds = [trip.ownerId, ...members.map(m => m.userId)];
    const users = await this.users.findBy({ id: In(userIds) });
    const nicknameOf = new Map(users.map(u => [u.id, u.nickname]));

    return [
      { userId: trip.ownerId, nickname: nicknameOf.get(trip.ownerId) ?? `用户${trip.ownerId}`, role: TripMemberRole.Owner, joinedAt: null },
      ...members.map(m => ({ userId: m.userId, nickname: nicknameOf.get(m.userId) ?? `用户${m.userId}`, role: m.role, joinedAt: m.joinedAt }))
    ];
  }

  private async countCompanions(tripId: number): Promise<number> {
    return this.members.count({ where: { tripId } });
  }

  private async toView(application: ApplicationEntity): Promise<ApplicationView> {
    const [applicant, trip] = await Promise.all([
      this.users.findOneBy({ id: application.applicantId }),
      this.trips.findOneBy({ id: application.tripId })
    ]);
    if (!trip) throw new AppException(ERROR_CODES.TRIP_NOT_FOUND, '行程不存在', 404);
    return {
      id: application.id,
      tripId: application.tripId,
      status: application.status,
      message: application.message ?? null,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      applicant: { id: application.applicantId, nickname: applicant?.nickname ?? `用户${application.applicantId}` },
      trip: { id: trip.id, destination: trip.destination, departDate: trip.departDate, status: trip.status, companionCount: trip.companionCount }
    };
  }
}
