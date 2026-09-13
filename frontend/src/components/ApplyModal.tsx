import { Form, Input, Modal, message } from 'antd';
import { useState } from 'react';
import { applicationApi } from '../api';
import type { Trip } from '../types';

interface ApplyModalProps {
  trip: Trip | null;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export default function ApplyModal({ trip, open, onClose, onApplied }: ApplyModalProps) {
  const [form] = Form.useForm<{ message: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleOk = async () => {
    if (!trip) return;
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await applicationApi.apply(trip.id, values.message?.trim() ?? '');
      messageApi.success('同行申请已提交，等待行程创建者审批');
      form.resetFields();
      onApplied();
      onClose();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '申请提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={trip ? `申请同行 · ${trip.destination}` : '申请同行'}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={submitting}
      okText="提交申请"
      cancelText="取消"
      destroyOnClose
    >
      {contextHolder}
      <p style={{ color: '#666' }}>
        {trip ? `${trip.departDate} 出发 · ${trip.days} 天 · ${trip.transport}` : ''}
      </p>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="message"
          label="给行程创建者留言"
          rules={[{ max: 500, message: '留言不能超过 500 字' }]}
        >
          <Input.TextArea rows={4} maxLength={500} showCount placeholder="简单介绍一下自己，例如出行经验、兴趣爱好等（选填）" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
