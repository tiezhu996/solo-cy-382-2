import { Button, Card, Empty, List, Popconfirm, Space, Tabs, Tag, Typography, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { applicationApi } from '../api';
import { ApiError } from '../api/client';
import { APPLICATION_STATUS_META, TRIP_STATUS_META } from '../constants/labels';
import type { ApplicationView } from '../types';

interface ApplicationsPageProps {
  refreshKey: number;
  notifyChange: () => void;
  onPendingCountChange?: (count: number) => void;
}

export default function ApplicationsPage({ refreshKey, notifyChange, onPendingCountChange }: ApplicationsPageProps) {
  const [received, setReceived] = useState<ApplicationView[]>([]);
  const [mine, setMine] = useState<ApplicationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [receivedList, mineList] = await Promise.all([applicationApi.listReceived(), applicationApi.listMine()]);
      setReceived(receivedList);
      setMine(mineList);
      onPendingCountChange?.(receivedList.filter(item => item.status === 'PENDING').length);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '申请数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi, onPendingCountChange]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const handleDecision = async (application: ApplicationView, action: 'approve' | 'reject') => {
    setActingId(application.id);
    try {
      if (action === 'approve') {
        const updated = await applicationApi.approve(application.id);
        messageApi.success(updated.trip.status === 'MATCHED' ? `已同意，行程「${updated.trip.destination}」名额已满，状态同步为已匹配` : '已同意申请');
      } else {
        await applicationApi.reject(application.id);
        messageApi.success('已拒绝该申请');
      }
      notifyChange();
      await load();
    } catch (error) {
      const text = error instanceof ApiError ? error.message : '操作失败，请稍后重试';
      messageApi.error(text);
    } finally {
      setActingId(null);
    }
  };

  const renderReceivedItem = (item: ApplicationView) => {
    const statusMeta = APPLICATION_STATUS_META[item.status];
    return (
      <List.Item
        actions={item.status === 'PENDING' ? [
          <Popconfirm
            key="approve"
            title="确认同意该申请？"
            description="同意后申请人将进入成员列表并占用一个名额"
            onConfirm={() => handleDecision(item, 'approve')}
            okText="同意" cancelText="取消"
          >
            <Button type="primary" icon={<CheckOutlined />} loading={actingId === item.id}>同意</Button>
          </Popconfirm>,
          <Popconfirm
            key="reject"
            title="确认拒绝该申请？"
            description="拒绝后该用户将不能再次申请此行程"
            onConfirm={() => handleDecision(item, 'reject')}
            okText="拒绝" cancelText="取消" okButtonProps={{ danger: true }}
          >
            <Button danger icon={<CloseOutlined />} loading={actingId === item.id}>拒绝</Button>
          </Popconfirm>
        ] : undefined}
      >
        <List.Item.Meta
          title={
            <Space wrap>
              <span>{item.applicant.nickname}</span>
              <span style={{ color: '#999' }}>申请加入</span>
              <span>「{item.trip.destination}」</span>
              <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
            </Space>
          }
          description={
            <div>
              <Typography.Text type="secondary">{item.trip.departDate} 出发 · 名额 {item.trip.companionCount} 人</Typography.Text>
              {item.message && <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>留言：{item.message}</Typography.Paragraph>}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>提交时间 {new Date(item.createdAt).toLocaleString('zh-CN')}</Typography.Text>
            </div>
          }
        />
      </List.Item>
    );
  };

  const renderMineItem = (item: ApplicationView) => {
    const statusMeta = APPLICATION_STATUS_META[item.status];
    const tripStatusMeta = TRIP_STATUS_META[item.trip.status];
    return (
      <List.Item>
        <List.Item.Meta
          title={
            <Space wrap>
              <span>「{item.trip.destination}」</span>
              <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
              <Tag color={tripStatusMeta.color}>{tripStatusMeta.text}</Tag>
            </Space>
          }
          description={
            <div>
              <Typography.Text type="secondary">{item.trip.departDate} 出发 · 名额 {item.trip.companionCount} 人</Typography.Text>
              {item.message && <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>我的留言：{item.message}</Typography.Paragraph>}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                提交于 {new Date(item.createdAt).toLocaleString('zh-CN')}
                {item.status !== 'PENDING' ? ` · 更新于 ${new Date(item.updatedAt).toLocaleString('zh-CN')}` : ''}
              </Typography.Text>
            </div>
          }
        />
      </List.Item>
    );
  };

  return (
    <Card>
      {contextHolder}
      <Tabs
        items={[
          {
            key: 'received',
            label: '收到的申请',
            children: received.length === 0 && !loading ? (
              <Empty description="还没有收到同行申请" />
            ) : (
              <List dataSource={received} loading={loading} renderItem={renderReceivedItem} />
            )
          },
          {
            key: 'mine',
            label: '我的申请',
            children: mine.length === 0 && !loading ? (
              <Empty description="还没有提交过同行申请，去「智能匹配」看看吧" />
            ) : (
              <List dataSource={mine} loading={loading} renderItem={renderMineItem} />
            )
          }
        ]}
      />
    </Card>
  );
}
