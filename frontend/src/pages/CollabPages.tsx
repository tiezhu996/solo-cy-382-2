import { Button, Card, List } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const BOARD_DAYS = ['Day 1 抵达与集合', 'Day 2 环洱海', 'Day 3 沙溪古镇'];

export function BoardPage() {
  return (
    <Card title="每日安排">
      <List dataSource={BOARD_DAYS} renderItem={item => <List.Item>{item}</List.Item>} />
    </Card>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<string[]>(['系统：已进入大理行程协作空间']);
  const socket = useMemo(() => io('/', { path: '/socket.io' }), []);
  const send = () => {
    socket.emit('trip-message', { tripId: 1, sender: '我', content: '今晚确认民宿地址', type: 'text' });
    setMessages(items => [...items, '我：今晚确认民宿地址']);
  };
  return (
    <Card title={<><MessageOutlined /> 行程群聊</>}>
      <List dataSource={messages} renderItem={item => <List.Item>{item}</List.Item>} />
      <Button onClick={send}>发送示例消息</Button>
    </Card>
  );
}
