import React, { useState } from 'react';
import { TaskManagement } from './components/tasks/TaskManagement';
import './styles/tasks.css';

// Default project setup for development/demo harness
const DEMO_PROJECT = {
  _id: '670c56781234567890abcdef',
  name: 'Core System Platform',
  description: 'Main software engineering platform project',
  teamLeaderId: '670c11111111111111111111',
  memberIds: [
    '670c22222222222222222222',
    '670c33333333333333333333'
  ]
};

const DEMO_USERS = {
  leader: {
    _id: '670c11111111111111111111',
    name: 'Sarah Connor (Team Leader)',
    email: 'leader@example.com',
    role: 'teamLeader'
  },
  member1: {
    _id: '670c22222222222222222222',
    name: 'John Connor (Team Member)',
    email: 'member1@example.com',
    role: 'teamMember'
  },
  member2: {
    _id: '670c33333333333333333333',
    name: 'Kyle Reese (Team Member)',
    email: 'member2@example.com',
    role: 'teamMember'
  }
};

const MEMBER_NAMES = {
  '670c11111111111111111111': 'Sarah Connor (Leader)',
  '670c22222222222222222222': 'John Connor (Member)',
  '670c33333333333333333333': 'Kyle Reese (Member)'
};

export function App() {
  const [currentUserRole, setCurrentUserRole] = useState('leader');
  const [authToken, setAuthToken] = useState('demo-token-for-dev');

  const currentUser = DEMO_USERS[currentUserRole];

  return (
    <div className="app-container">
      {/* Dev Role Switcher Bar */}
      <header className="dev-harness-bar" style={{
        background: '#1e293b',
        color: '#f8fafc',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        fontSize: '0.875rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <strong>🚀 Task Manager Application</strong>
          <span style={{ color: '#94a3b8' }}>| Task Management Module</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Active Role:</span>
            <select
              value={currentUserRole}
              onChange={(e) => setCurrentUserRole(e.target.value)}
              style={{
                background: '#334155',
                color: '#ffffff',
                border: '1px solid #475569',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px'
              }}
              data-testid="role-switcher"
            >
              <option value="leader">Team Leader ({DEMO_USERS.leader.name})</option>
              <option value="member1">Assigned Member ({DEMO_USERS.member1.name})</option>
              <option value="member2">Other Member ({DEMO_USERS.member2.name})</option>
            </select>
          </label>
        </div>
      </header>

      {/* Main Task Management UI */}
      <main>
        <TaskManagement
          projectId={DEMO_PROJECT._id}
          project={DEMO_PROJECT}
          currentUser={currentUser}
          token={authToken}
          memberNames={MEMBER_NAMES}
        />
      </main>
    </div>
  );
}

export default App;
