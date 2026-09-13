/* eslint-disable */
// HTTP 层自测：真实 Nest 应用（JwtGuard + HttpExceptionFilter）+ 内存仓储，无需 MySQL。
// 运行：npm run build && node scripts/verify-http.js
process.env.JWT_SECRET = 'verify_secret';
const assert = require('assert');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { JwtModule, JwtService } = require('@nestjs/jwt');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { FindOperator, DataSource } = require('typeorm');
const { ApplicationController } = require('../dist/modules/companion/application.controller');
const { TripMemberController } = require('../dist/modules/companion/trip-member.controller');
const { CompanionController } = require('../dist/modules/companion/companion.controller');
const { ApplicationService } = require('../dist/modules/companion/application.service');
const { CompanionService } = require('../dist/modules/companion/companion.service');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { ApplicationEntity } = require('../dist/modules/companion/application.entity');
const { TripMemberEntity } = require('../dist/modules/companion/trip-member.entity');
const { TripEntity } = require('../dist/modules/trip/trip.entity');
const { UserEntity } = require('../dist/modules/user/user.entity');

function memoryRepo(seed = []) {
  let nextId = 1;
  const rows = seed.map(row => Object.assign({ id: nextId++ }, row));
  const match = (actual, expected) => {
    if (expected instanceof FindOperator) {
      const wanted = expected.value;
      return Array.isArray(wanted) ? wanted.includes(actual) : wanted === actual;
    }
    if (expected && typeof expected === 'object') return Object.entries(expected).every(([k, v]) => match(actual[k], v));
    return actual === expected;
  };
  return {
    rows,
    create: p => Object.assign({}, p),
    async save(entity) { if (entity.id) Object.assign(rows.find(r => r.id === entity.id), entity); else { entity.id = nextId++; rows.push(entity); } return entity; },
    async insert(_e, obj) { const row = Object.assign({ id: nextId++, joinedAt: new Date() }, obj); rows.push(row); return { identifiers: [{ id: row.id }] }; },
    async findOneBy(where) { return rows.find(r => match(r, where)) ?? null; },
    async find(o = {}) {
      let out = o.where ? rows.filter(r => match(r, o.where)) : [...rows];
      if (o.order) for (const [k, dir] of Object.entries(o.order)) out.sort((a, b) => (a[k] > b[k] ? 1 : -1) * (dir === 'DESC' ? -1 : 1));
      return out;
    },
    async findBy(where) { return rows.filter(r => match(r, where)); },
    async count(o = {}) { return o.where ? rows.filter(r => match(r, o.where)).length : rows.length; },
    async exists(o = {}) { return o.where ? rows.some(r => match(r, o.where)) : rows.length > 0; }
  };
}

(async () => {
  const users = memoryRepo([
    { id: 1, nickname: '队长' }, { id: 2, nickname: '爱丽丝' }, { id: 3, nickname: '鲍勃' }, { id: 4, nickname: '卡罗尔' }
  ]);
  const trips = memoryRepo([
    { id: 1, ownerId: 1, destination: '大理', departDate: '2026-07-12', days: 5, budgetMin: 3500, budgetMax: 5200, transport: '公共交通', companionCount: 2, genderPreference: null, status: 'OPEN' },
    { id: 2, ownerId: 1, destination: '青海湖', departDate: '2026-08-03', days: 7, budgetMin: 4800, budgetMax: 6800, transport: '自驾', companionCount: 1, genderPreference: null, status: 'OPEN' }
  ]);
  const applications = memoryRepo();
  applications.create = p => Object.assign({ status: 'PENDING', createdAt: new Date(), updatedAt: new Date() }, p);
  const members = memoryRepo();
  const manager = {
    findOne: (E, o) => (E === ApplicationEntity ? applications : E === TripEntity ? trips : members).findOneBy(o.where),
    count: (E, o) => (E === TripMemberEntity ? members : applications).count(o),
    insert: (E, obj) => (E === TripMemberEntity ? members : applications).insert(E, obj),
    save: async e => (e && 'ownerId' in e && !('applicantId' in e) ? trips.save(e) : applications.save(e))
  };

  const moduleRef = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'verify_secret' })],
    controllers: [ApplicationController, TripMemberController, CompanionController],
    providers: [
      ApplicationService, CompanionService,
      { provide: getRepositoryToken(ApplicationEntity), useValue: applications },
      { provide: getRepositoryToken(TripMemberEntity), useValue: members },
      { provide: getRepositoryToken(TripEntity), useValue: trips },
      { provide: getRepositoryToken(UserEntity), useValue: users },
      { provide: DataSource, useValue: { transaction: cb => cb(manager) } }
    ]
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  const jwt = app.get(JwtService);
  const token = userId => jwt.sign({ userId, nickname: `用户${userId}` });
  const http = () => request(app.getHttpServer());

  const checkError = (res, status, code) => {
    assert.strictEqual(res.status, status, `期望 HTTP ${status}，实际 ${res.status}：${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, code);
  };

  // 1. 未登录 → 401 标准错误体
  checkError(await http().post('/api/applications').send({ tripId: 1 }), 401, 'AUTH_REQUIRED');

  // 2. 创建者申请自己的行程 → 400
  checkError(await http().post('/api/applications').set('Authorization', `Bearer ${token(1)}`).send({ tripId: 1 }), 400, 'CANNOT_APPLY_OWN_TRIP');

  // 3. 爱丽丝申请 → 201
  const resApply = await http().post('/api/applications').set('Authorization', `Bearer ${token(2)}`).send({ tripId: 1, message: '我会开车' });
  assert.strictEqual(resApply.status, 201);
  assert.strictEqual(resApply.body.status, 'PENDING');
  const appId = resApply.body.id;
  assert.strictEqual(resApply.body.applicant.nickname, '爱丽丝');

  // 4. 重复待处理申请 → 409
  checkError(await http().post('/api/applications').set('Authorization', `Bearer ${token(2)}`).send({ tripId: 1 }), 409, 'APPLICATION_DUPLICATE');

  // 5. 非创建者审批 → 403
  checkError(await http().post(`/api/applications/${appId}/approve`).set('Authorization', `Bearer ${token(3)}`), 403, 'NOT_TRIP_OWNER');

  // 6. 创建者同意 → 201
  const resApprove = await http().post(`/api/applications/${appId}/approve`).set('Authorization', `Bearer ${token(1)}`);
  assert.strictEqual(resApprove.status, 201);
  assert.strictEqual(resApprove.body.status, 'APPROVED');

  // 7. 重复审批已处理申请 → 409
  checkError(await http().post(`/api/applications/${appId}/approve`).set('Authorization', `Bearer ${token(1)}`), 409, 'APPLICATION_ALREADY_HANDLED');

  // 8. 鲍勃申请并获批 → 名额占满，行程 MATCHED
  const bApply = await http().post('/api/applications').set('Authorization', `Bearer ${token(3)}`).send({ tripId: 1 });
  const bApprove = await http().post(`/api/applications/${bApply.body.id}/approve`).set('Authorization', `Bearer ${token(1)}`);
  assert.strictEqual(bApprove.body.trip.status, 'MATCHED');

  // 9. 满员后卡罗尔申请 → 409
  checkError(await http().post('/api/applications').set('Authorization', `Bearer ${token(4)}`).send({ tripId: 1 }), 409, 'TRIP_FULL');

  // 10. 拒绝流程：行程 2 拒掉鲍勃，再次申请 → 409
  const cApply = await http().post('/api/applications').set('Authorization', `Bearer ${token(3)}`).send({ tripId: 2 });
  assert.strictEqual((await http().post(`/api/applications/${cApply.body.id}/reject`).set('Authorization', `Bearer ${token(1)}`)).body.status, 'REJECTED');
  checkError(await http().post('/api/applications').set('Authorization', `Bearer ${token(3)}`).send({ tripId: 2 }), 409, 'APPLICATION_REJECTED');

  // 11. 申请不存在 → 404
  checkError(await http().post('/api/applications/9999/approve').set('Authorization', `Bearer ${token(1)}`), 404, 'APPLICATION_NOT_FOUND');

  // 12. 成员列表：创建者 + 两名同行成员
  const membersRes = await http().get('/api/trips/1/members');
  assert.strictEqual(membersRes.status, 200);
  assert.deepStrictEqual(membersRes.body.map(m => [m.userId, m.role]).sort(), [[1, 'OWNER'], [2, 'COMPANION'], [3, 'COMPANION']]);

  // 13. 收到的申请 / 我的申请
  const received = await http().get('/api/applications/received').set('Authorization', `Bearer ${token(1)}`);
  assert.strictEqual(received.body.length, 3);
  const mine = await http().get('/api/applications/mine').set('Authorization', `Bearer ${token(2)}`);
  assert.strictEqual(mine.body[0].trip.destination, '大理');

  // 14. 既有匹配评分接口保持不变
  const score = await http().post('/api/companions/score').send({ candidate: { destination: '大理', budgetMax: 5200 }, target: { destination: '大理', budgetMax: 5200 } });
  assert.strictEqual(score.body.score, 100);

  await app.close();
  console.log('HTTP 层自测全部通过 ✔ (14 组场景)');
})().catch(error => { console.error('HTTP 自测失败 ✘', error); process.exit(1); });
