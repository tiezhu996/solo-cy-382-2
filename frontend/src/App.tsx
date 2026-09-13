import { Badge, Button, Layout, Space, Tabs, Typography } from 'antd';
import { useCallback, useState } from 'react';
import { AuthProvider, useAuth } from './auth/auth-context';
import LoginModal from './components/LoginModal';
import PublishPage from './pages/PublishPage';
import MatchPage from './pages/MatchPage';
import ApplicationsPage from './pages/ApplicationsPage';
import { BoardPage, ChatPage } from './pages/CollabPages';

function Shell() {
  const { user, isLoggedIn, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('match');
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // 申请/发布/审批等数据发生变化时，刷新相关列表
  const bump = useCallback(() => setRefreshKey(key => key + 1), []);

  return (
    <Layout className="shell">
      <Layout.Sider width={240} className="side">
        <h1>旅伴匹配</h1>
        <p>TripMatch</p>
        <div style={{ marginTop: 32 }}>
          {isLoggedIn ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text style={{ color: '#fff' }}>你好，{user?.nickname}</Typography.Text>
              <Button block onClick={logout}>退出登录</Button>
            </Space>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text style={{ color: 'rgba(255,255,255,0.65)' }}>登录后可发布行程与申请同行</Typography.Text>
              <Button type="primary" block onClick={() => setLoginOpen(true)}>登录 / 注册</Button>
            </Space>
          )}
        </div>
      </Layout.Sider>
      <Layout.Content className="content">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'match', label: '智能匹配', children: <MatchPage refreshKey={refreshKey} onRequireLogin={() => setLoginOpen(true)} notifyChange={bump} /> },
            {
              key: 'applications',
              label: isLoggedIn ? <Badge count={pendingCount} size="small" offset={[10, -2]}>申请管理</Badge> : '申请管理',
              children: isLoggedIn
                ? <ApplicationsPage refreshKey={refreshKey} notifyChange={bump} onPendingCountChange={setPendingCount} />
                : <Typography.Text type="secondary">登录后查看与审批旅伴申请</Typography.Text>
            },
            { key: 'publish', label: '发布行程', children: <PublishPage onPublished={() => { bump(); setActiveTab('match'); }} onRequireLogin={() => setLoginOpen(true)} /> },
            { key: 'board', label: '协作看板', children: <BoardPage /> },
            { key: 'chat', label: '即时沟通', children: <ChatPage /> }
          ]}
        />
      </Layout.Content>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
