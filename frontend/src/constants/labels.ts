import type { ApplicationStatusValue, TripStatusValue } from '../types';

export const TRIP_STATUS_META: Record<TripStatusValue, { text: string; color: string }> = {
  OPEN: { text: '招募中', color: 'green' },
  MATCHED: { text: '已匹配', color: 'blue' },
  FINISHED: { text: '已结束', color: 'default' }
};

export const APPLICATION_STATUS_META: Record<ApplicationStatusValue, { text: string; color: string }> = {
  PENDING: { text: '待处理', color: 'gold' },
  APPROVED: { text: '已同意', color: 'green' },
  REJECTED: { text: '已拒绝', color: 'red' }
};

export const GENDER_PREFERENCES = ['不限', '男', '女'];
export const TRANSPORT_OPTIONS = ['自驾', '公共交通', '徒步'];
