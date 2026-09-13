import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { tripApi } from '../api';
import { GENDER_PREFERENCES, TRANSPORT_OPTIONS } from '../constants/labels';
import { useAuth } from '../auth/auth-context';

interface PublishFormValues {
  destination: string;
  departDate: Dayjs;
  days: number;
  budgetMin?: number;
  budgetMax?: number;
  transport: string;
  companionCount: number;
  genderPreference: string;
}

interface PublishPageProps {
  onPublished: () => void;
  onRequireLogin: () => void;
}

export default function PublishPage({ onPublished, onRequireLogin }: PublishPageProps) {
  const { isLoggedIn } = useAuth();
  const [form] = Form.useForm<PublishFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleSubmit = async () => {
    if (!isLoggedIn) { onRequireLogin(); return; }
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await tripApi.create({
        destination: values.destination.trim(),
        departDate: values.departDate.format('YYYY-MM-DD'),
        days: values.days,
        budgetMin: values.budgetMin ?? null,
        budgetMax: values.budgetMax ?? null,
        transport: values.transport,
        companionCount: values.companionCount,
        genderPreference: values.genderPreference === '不限' ? null : values.genderPreference
      });
      messageApi.success('行程发布成功');
      form.resetFields();
      onPublished();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '发布失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      {contextHolder}
      <Form
        form={form}
        layout="vertical"
        className="form"
        initialValues={{ transport: '公共交通', companionCount: 2, genderPreference: '不限', days: 3 }}
      >
        <Form.Item label="目的地" name="destination" rules={[{ required: true, message: '请输入目的地' }]}>
          <Input placeholder="例如：大理" maxLength={120} />
        </Form.Item>
        <Form.Item label="出发时间" name="departDate" rules={[{ required: true, message: '请选择出发时间' }]}>
          <DatePicker style={{ width: '100%' }} disabledDate={current => current.isBefore(dayjs().startOf('day'))} />
        </Form.Item>
        <Form.Item label="行程天数" name="days" rules={[{ required: true, message: '请输入行程天数' }]}>
          <InputNumber min={1} max={365} style={{ width: '100%' }} addonAfter="天" />
        </Form.Item>
        <Form.Item label="预算范围（元）">
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="budgetMin" noStyle><InputNumber min={0} placeholder="最低预算" style={{ width: '50%' }} /></Form.Item>
            <Form.Item name="budgetMax" noStyle><InputNumber min={0} placeholder="最高预算" style={{ width: '50%' }} /></Form.Item>
          </Space.Compact>
        </Form.Item>
        <Form.Item label="出行方式" name="transport" rules={[{ required: true }]}>
          <Select options={TRANSPORT_OPTIONS.map(value => ({ value, label: value }))} />
        </Form.Item>
        <Form.Item label="期望旅伴人数（含自己之外的名额）" name="companionCount" rules={[{ required: true, message: '请输入期望旅伴人数' }]}>
          <InputNumber min={1} max={20} style={{ width: '100%' }} addonAfter="人" />
        </Form.Item>
        <Form.Item label="性别偏好" name="genderPreference">
          <Select options={GENDER_PREFERENCES.map(value => ({ value, label: value }))} />
        </Form.Item>
        <Button type="primary" loading={submitting} onClick={handleSubmit}>发布计划</Button>
      </Form>
    </Card>
  );
}
