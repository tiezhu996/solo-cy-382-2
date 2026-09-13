import { Modal, Table, Tag, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { memberApi } from '../api';
import type { Trip, TripMember } from '../types';

interface MembersModalProps {
  trip: Pick<Trip, 'id' | 'destination' | 'companionCount'> | null;
  open: boolean;
  onClose: () => void;
}

export default function MembersModal({ trip, open, onClose }: MembersModalProps) {
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    if (!trip) return;
    setLoading(true);
    try {
      setMembers(await memberApi.list(trip.id));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '成员列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [trip]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  return (
    <Modal open={open} title={trip ? `${trip.destination} · 成员名单` : '成员名单'} footer={null} onCancel={onClose}>
      {contextHolder}
      <p style={{ color: '#666' }}>名额 {members.filter(m => m.role === 'COMPANION').length}/{trip?.companionCount ?? '-'}</p>
      <Table
        rowKey="userId"
        size="small"
        loading={loading}
        dataSource={members}
        pagination={false}
        columns={[
          { title: '用户', dataIndex: 'nickname' },
          {
            title: '身份', dataIndex: 'role',
            render: (role: TripMember['role']) => <Tag color={role === 'OWNER' ? 'blue' : 'green'}>{role === 'OWNER' ? '创建者' : '同行成员'}</Tag>
          },
          { title: '加入时间', dataIndex: 'joinedAt', render: (value: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '—' }
        ]}
      />
    </Modal>
  );
}
