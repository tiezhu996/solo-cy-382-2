import { Form, Input, Modal, Tabs, message } from 'antd';
import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { ApiError } from '../api/client';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const handleLogin = async () => {
    const values = await loginForm.validateFields();
    setLoading(true);
    try {
      await login(values.email, values.password);
      messageApi.success('登录成功');
      loginForm.resetFields();
      onClose();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const values = await registerForm.validateFields();
    setLoading(true);
    try {
      await register(values.email, values.nickname, values.password);
      messageApi.success('注册成功，已自动登录');
      registerForm.resetFields();
      onClose();
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : '注册失败，邮箱可能已被使用');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={tab === 'login' ? '登录 TripMatch' : '注册新账号'}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={tab === 'login' ? handleLogin : handleRegister}
      okText={tab === 'login' ? '登录' : '注册并登录'}
      cancelText="取消"
      destroyOnClose
    >
      {contextHolder}
      <Tabs
        activeKey={tab}
        onChange={key => setTab(key as 'login' | 'register')}
        items={[
          {
            key: 'login',
            label: '登录',
            children: (
              <Form form={loginForm} layout="vertical" preserve={false}>
                <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                  <Input placeholder="you@example.com" />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                  <Input.Password placeholder="请输入密码" />
                </Form.Item>
              </Form>
            )
          },
          {
            key: 'register',
            label: '注册',
            children: (
              <Form form={registerForm} layout="vertical" preserve={false}>
                <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                  <Input placeholder="you@example.com" />
                </Form.Item>
                <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: '请输入昵称' }]}>
                  <Input placeholder="旅途中怎么称呼你" />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少 6 位' }]}>
                  <Input.Password placeholder="至少 6 位" />
                </Form.Item>
              </Form>
            )
          }
        ]}
      />
    </Modal>
  );
}
