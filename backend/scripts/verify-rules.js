/* eslint-disable */
// 业务规则自测：用内存假仓储驱动编译后的 ApplicationService（无需 MySQL）。
// 运行：npm run build && node scripts/verify-rules.js
const assert = require('assert');
const { FindOperator } = require('typeorm');
const { ApplicationService } = require('../dist/modules/companion/application.service');
const { ApplicationEntity } = require('../dist/modules/companion/application.entity');
const { TripMemberEntity } = require('../dist/modules/companion/trip-member.entity');
const { TripEntity } = require('../dist/modules/trip/trip.entity');
const { ERROR_CODES } = require('../dist/constants/errors');

const OWNER = 1, ALICE = 2, BOB = 3, CAROL = 4;

function createMemoryRepo(seedRows = []) {
  let nextId = 1;
  const rows = seedRows.map(row => Object.assign({ id: nextId++ }, row));
  const matchValue = (actual, expected) => {
    if (expected instanceof FindOperator) {
      const wanted = expected.value;
      return Array.isArray(wanted) ? wanted.includes(actual) : wanted === actual;
    }
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) return matchWhere(actual, expected);
    return actual === expected;
  };
  const matchWhere = (row, where) => Object.entries(where).every(([key, value]) => matchValue(row[key], value));
  return {
    rows,
    create: partial => Object.assign(new (rows.length ? rows[0].constructor : Object)(), partial),
    async save(entity) {
      if (entity.id) Object.assign(rows.find(r => r.id === entity.id), entity);
      else {
        entity.id = nextId++;
        entity.createdAt = entity.createdAt ?? new Date();
        entity.updatedAt = entity.updatedAt ?? new Date();
        rows.push(entity);
      }
      return entity;
    },
    async insert(_entity, obj) { rows.push(Object.assign({ id: nextId++, joinedAt: new Date() }, obj)); return { identifiers: [{ id: nextId - 1 }] }; },
    async findOneBy(where) { return rows.find(row => matchWhere(row, where)) ?? null; },
    async find(options = {}) {
      let result = options.where ? rows.filter(row => matchWhere(row, options.where)) : [...rows];
      if (options.select) result = result.map(row => Object.fromEntries(Object.keys(options.select).map(k => [k, row[k]])));
      if (options.order) {
        const entries = Object.entries(options.order);
        result.sort((a, b) => entries.reduce((acc, [key, dir]) => acc || ((a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (dir === 'DESC' ? -1 : 1)), 0));
      }
      return result;
    },
    async findBy(where) { return rows.filter(row => matchWhere(row, where)); },
    async count(options = {}) { return options.where ? rows.filter(row => matchWhere(row, options.where)).length : rows.length; },
    async exists(options = {}) { return options.where ? rows.some(row => matchWhere(row, options.where)) : rows.length > 0; }
  };
}

const users = createMemoryRepo([
  { id: OWNER, nickname: '队长' }, { id: ALICE, nickname: '爱丽丝' }, { id: BOB, nickname: '鲍勃' }, { id: CAROL, nickname: '卡罗尔' }
]);
users.rows.forEach(row => Object.setPrototypeOf(row, Object.prototype));

const trips = createMemoryRepo([
  Object.assign(new TripEntity(), { id: 1, ownerId: OWNER, destination: '大理', departDate: '2026-07-12', days: 5, budgetMax: 5200, transport: '公共交通', companionCount: 2, genderPreference: null, status: 'OPEN' }),
  Object.assign(new TripEntity(), { id: 2, ownerId: OWNER, destination: '青海湖', departDate: '2026-08-03', days: 7, budgetMax: 6800, transport: '自驾', companionCount: 1, genderPreference: null, status: 'OPEN' })
]);
const applications = createMemoryRepo();
applications.rows.forEach; // noop
const members = createMemoryRepo();

// create() 需要产生正确类型的实例
applications.create = partial => Object.assign(new ApplicationEntity(), { status: 'PENDING', message: undefined }, partial);
members.create = partial => Object.assign(new TripMemberEntity(), { role: 'COMPANION' }, partial);

const manager = {
  findOne: (Entity, options) => {
    const repo = Entity === ApplicationEntity ? applications : Entity === TripEntity ? trips : members;
    return repo.findOneBy(options.where);
  },
  count: (Entity, options) => {
    const repo = Entity === TripMemberEntity ? members : Entity === TripEntity ? trips : applications;
    return repo.count(options);
  },
  insert: (Entity, obj) => {
    const repo = Entity === TripMemberEntity ? members : applications;
    return repo.insert(Entity, obj);
  },
  save: entity => {
    const repo = entity instanceof TripEntity ? trips : applications;
    entity.updatedAt = new Date();
    return repo.save(entity);
  }
};
const dataSource = { transaction: async cb => cb(manager) };

const service = new ApplicationService(applications, members, trips, users, dataSource);

const expectError = (code, fn) => async () => {
  try { await fn(); } catch (error) { assert.strictEqual(error.code, code, `期望错误码 ${code}，实际 ${error.code}`); return; }
  throw new Error(`应当抛出 ${code} 但没有`);
};

(async () => {
  // 1. 创建者不能申请自己的行程
  await expectError(ERROR_CODES.CANNOT_APPLY_OWN_TRIP, () => service.apply(OWNER, { tripId: 1 }))();

  // 2. 不存在的行程
  await expectError(ERROR_CODES.TRIP_NOT_FOUND, () => service.apply(ALICE, { tripId: 999 }))();

  // 3. 爱丽丝申请成功
  const app1 = await service.apply(ALICE, { tripId: 1, message: '我会开车' });
  assert.strictEqual(app1.status, 'PENDING');

  // 4. 同一人对同一行程只能有一条待处理申请
  await expectError(ERROR_CODES.APPLICATION_DUPLICATE, () => service.apply(ALICE, { tripId: 1 }))();

  // 5. 非创建者不能审批
  await expectError(ERROR_CODES.NOT_TRIP_OWNER, () => service.approve(BOB, app1.id))();

  // 6. 创建者同意爱丽丝：进入成员列表，占用 1/2 名额，行程仍 OPEN
  const approved1 = await service.approve(OWNER, app1.id);
  assert.strictEqual(approved1.status, 'APPROVED');
  assert.strictEqual(await members.count({ where: { tripId: 1 } }), 1);
  assert.strictEqual(trips.rows.find(t => t.id === 1).status, 'OPEN');

  // 7. 已处理的申请不能再次审批
  await expectError(ERROR_CODES.APPLICATION_ALREADY_HANDLED, () => service.approve(OWNER, app1.id))();

  // 8. 鲍勃申请 → 同意后占满 2/2，行程状态同步为 MATCHED
  const app2 = await service.apply(BOB, { tripId: 1 });
  const approved2 = await service.approve(OWNER, app2.id);
  assert.strictEqual(approved2.trip.status, 'MATCHED');
  assert.strictEqual(await members.count({ where: { tripId: 1 } }), 2);

  // 9. 满员后不再接受申请
  await expectError(ERROR_CODES.TRIP_FULL, () => service.apply(CAROL, { tripId: 1 }))();

  // 10. 成员列表包含创建者与同行成员
  const memberList = await service.listMembers(1);
  assert.deepStrictEqual(memberList.map(m => [m.userId, m.role]).sort(), [[OWNER, 'OWNER'], [ALICE, 'COMPANION'], [BOB, 'COMPANION']]);

  // 11. 行程2：拒绝鲍勃后不能再次申请
  const app3 = await service.apply(BOB, { tripId: 2 });
  const rejected = await service.reject(OWNER, app3.id);
  assert.strictEqual(rejected.status, 'REJECTED');
  await expectError(ERROR_CODES.APPLICATION_REJECTED, () => service.apply(BOB, { tripId: 2 }))();

  // 12. 非创建者不能拒绝
  await expectError(ERROR_CODES.NOT_TRIP_OWNER, () => service.reject(ALICE, app3.id))();

  // 13. 收到的申请：待处理优先（即使创建时间更早），其余按创建时间倒序
  applications.rows.push(
    Object.assign(new ApplicationEntity(), { id: 100, tripId: 2, applicantId: CAROL, message: null, status: 'PENDING', createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z') }),
    Object.assign(new ApplicationEntity(), { id: 101, tripId: 2, applicantId: 5, message: null, status: 'APPROVED', createdAt: new Date('2027-02-01T00:00:00Z'), updatedAt: new Date('2027-02-02T00:00:00Z') })
  );
  const received = await service.listReceived(OWNER);
  assert.strictEqual(received[0].id, 100, '较旧的待处理申请必须排在最前');
  assert.strictEqual(received[1].id, 101, '已处理申请按创建时间倒序');
  assert.strictEqual(received[0].applicant.nickname, '卡罗尔');
  const mineAlice = await service.listMine(ALICE);
  assert.strictEqual(mineAlice[0].id, app1.id);

  console.log('全部业务规则自测通过 ✔ (13 组场景)');
})().catch(error => { console.error('自测失败 ✘', error); process.exit(1); });
