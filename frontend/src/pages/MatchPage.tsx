import { Button, Card, Col, Empty, Form, Input, InputNumber, Row, Statistic, Tag, message } from 'antd';
import { EnvironmentOutlined, TeamOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { applicationApi, matchApi, tripApi } from '../api';
import { useAuth } from '../auth/auth-context';
import { TRIP_STATUS_META } from '../constants/labels';
import type { ApplicationView, Trip } from '../types';
import ApplyModal from '../components/ApplyModal';
import MembersModal from '../components/MembersModal';

interface MatchProfile {
  destination: string;
  budgetMax?: number | null;
}

interface MatchPageProps {
  refreshKey: number;
  onRequireLogin: () => void;
  notifyChange: () => void;
}

export default function MatchPage({ refreshKey, onRequireLogin, notifyChange }: MatchPageProps) {
  const { isLoggedIn, user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [mine, setMine] = useState<ApplicationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<MatchProfile>({ destination: '', budgetMax: null });
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [membersTrip, setMembersTrip] = useState<Trip | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<MatchProfile>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tripList = await tripApi.list();
      setTrips(tripList);
      setMine(isLoggedIn ? await applicationApi.listMine() : []);
      const scoreEntries = await Promise.all(tripList.map(async trip => {
        const result = await matchApi.score(
          { destination: profile.destination || '', budgetMax: profile.budgetMax ?? Number(trip.budgetMax ?? 0) },
          { destination: trip.destination, budgetMax: Number(trip.budgetMax ?? 0) }
        );
        return [trip.id, result.score] as const;
      }));
      setScores(Object.fromEntries(scoreEntries));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '行程加载失败');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, profile, messageApi]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const orderedTrips = profile.destination || profile.budgetMax != null
    ? [...trips].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
    : trips;

  const myApplicationOf = (tripId: number) => mine.find(item => item.tripId === tripId);

  const handleApplyClick = (trip: Trip) => {
    if (!isLoggedIn) { onRequireLogin(); return; }
    setActiveTrip(trip);
  };

  const renderApplyButton = (trip: Trip) => {
    if (trip.ownerId === user?.id) return <Button disabled>我发布的行程</Button>;
    const full = trip.status === 'MATCHED' || (trip.memberCount ?? 0) >= trip.companionCount;
    if (full) return <Button disabled>已满员</Button>;
    const application = myApplicationOf(trip.id);
    if (application?.status === 'PENDING') return <Button disabled>申请待处理</Button>;
    if (application?.status === 'APPROVED') return <Button disabled type="primary" ghost>已同意 · 已成行</Button>;
    if (application?.status === 'REJECTED') return <Button danger disabled>申请被拒绝</Button>;
    return <Button type="primary" onClick={() => handleApplyClick(trip)}>申请同行</Button>;
  };

  return (
    <div>
      {contextHolder}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={values => setProfile({ destination: values.destination?.trim() ?? '', budgetMax: values.budgetMax ?? null })}
        >
          <Form.Item name="destination" label="期望目的地"><Input allowClear placeholder="如：大理" style={{ width: 160 }} /></Form.Item>
          <Form.Item name="budgetMax" label="预算上限"><InputNumber min={0} placeholder="元" style={{ width: 140 }} /></Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ marginRight: 8 }}>智能排序</Button>
            <Button onClick={() => { form.resetFields(); setProfile({ destination: '', budgetMax: null }); }}>重置</Button>
          </Form.Item>
        </Form>
      </Card>

      {orderedTrips.length === 0 && !loading ? (
        <Empty description="暂无可匹配的行程，去「发布行程」发起一个吧" />
      ) : (
        <Row gutter={[16, 16]}>
          {orderedTrips.map(trip => {
            const statusMeta = TRIP_STATUS_META[trip.status];
            return (
              <Col xs={24} sm={12} xl={8} key={trip.id}>
                <Card
                  loading={loading}
                  title={<><EnvironmentOutlined /> {trip.destination} <Tag color={statusMeta.color}>{statusMeta.text}</Tag></>}
                  actions={[
                    <span key="members" onClick={() => setMembersTrip(trip)}><TeamOutlined /> 成员 {trip.memberCount ?? 0}/{trip.companionCount}</span>
                  ]}
                >
                  <p style={{ marginBottom: 4 }}>{trip.departDate} 出发 · {trip.days} 天 · {trip.transport}</p>
                  <p style={{ marginBottom: 8, color: '#666' }}>
                    预算 {trip.budgetMin ?? '?'} - {trip.budgetMax ?? '?'} 元
                    {trip.genderPreference ? ` · 性别偏好：${trip.genderPreference}` : ''}
                  </p>
                  <Row align="middle" justify="space-between">
                    <Col><Statistic title="匹配度" value={scores[trip.id] ?? '—'} suffix="%" /></Col>
                    <Col>{renderApplyButton(trip)}</Col>
                  </Row>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <ApplyModal
        trip={activeTrip}
        open={!!activeTrip}
        onClose={() => setActiveTrip(null)}
        onApplied={() => { notifyChange(); void load(); }}
      />
      <MembersModal trip={membersTrip} open={!!membersTrip} onClose={() => setMembersTrip(null)} />
    </div>
  );
}
