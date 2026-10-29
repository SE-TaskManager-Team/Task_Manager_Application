import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import App from '../App';
import { authService } from '../services/authService';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { userService } from '../services/userService';

describe('App Project Membership Workflow', () => {
  const leaderUser = {
    _id: 'leader-1',
    name: 'Leader Alice',
    email: 'alice@example.com',
    role: 'teamLeader'
  };

  const initialProject = {
    _id: 'proj-1',
    name: 'Apollo Project',
    teamLeaderId: 'leader-1',
    memberIds: []
  };

  const registeredUsers = [
    {
      _id: 'member-10',
      name: 'Bob Member',
      email: 'bob@example.com',
      role: 'teamMember',
      isActive: true
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows Team Leader to open member management, add a team member, and updates task assignee list', async () => {
    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-leader-token',
      user: leaderUser
    });

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [initialProject],
      total: 1,
      page: 1,
      pages: 1
    });

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    vi.spyOn(userService, 'getUsers').mockResolvedValue({
      items: registeredUsers,
      total: 1,
      page: 1,
      pages: 1
    });

    const updatedProject = {
      ...initialProject,
      memberIds: ['member-10']
    };

    const addMemberSpy = vi.spyOn(projectService, 'addMember').mockResolvedValue({
      project: updatedProject
    });

    render(<App />);

    // Wait for project toolbar and task management to load
    expect(await screen.findByTestId('task-management')).toBeInTheDocument();

    // Verify "Manage Members" button is present with 0 members
    const manageMembersBtn = await screen.findByTestId('btn-manage-members');
    expect(manageMembersBtn).toHaveTextContent('Members (0)');

    // Click "Manage Members"
    fireEvent.click(manageMembersBtn);

    // Modal opens
    expect(await screen.findByTestId('project-members-modal')).toBeInTheDocument();

    // Bob Member is available in the dropdown
    const select = screen.getByTestId('select-member-to-add');
    expect(within(select).getByRole('option', { name: /Bob Member/ })).toBeInTheDocument();

    // Select Bob and click Add Member
    fireEvent.change(select, { target: { value: 'member-10' } });
    fireEvent.click(screen.getByTestId('btn-confirm-add-member'));

    await waitFor(() => {
      expect(addMemberSpy).toHaveBeenCalledWith('proj-1', 'member-10', 'jwt-leader-token');
    });

    // Success notice appears and member row is rendered
    expect(await screen.findByTestId('members-modal-success')).toHaveTextContent(
      'Member added to project successfully.'
    );
    expect(screen.getByTestId('member-row-member-10')).toHaveTextContent('Bob Member');

    // Close members modal
    fireEvent.click(screen.getByTestId('btn-close-members'));

    // Now open "New Task" modal
    fireEvent.click(screen.getByTestId('btn-create-task'));
    expect(await screen.findByTestId('task-create-modal')).toBeInTheDocument();

    // The Assignee dropdown now contains Bob Member!
    const assigneeSelect = screen.getByTestId('create-assignee-select');
    expect(assigneeSelect).toBeInTheDocument();
    expect(within(assigneeSelect).getByRole('option', { name: 'Bob Member' })).toBeInTheDocument();
  }, 15000);

  it('shows projects to a normal Team Member who has been assigned as a member', async () => {
    const memberUser = {
      _id: 'member-10',
      name: 'Bob Member',
      email: 'bob@example.com',
      role: 'teamMember'
    };

    vi.spyOn(authService, 'restoreSession').mockResolvedValue({
      token: 'jwt-member-token',
      user: memberUser
    });

    const projectWithBob = {
      _id: 'proj-1',
      name: 'Apollo Project',
      teamLeaderId: 'leader-1',
      memberIds: ['member-10']
    };

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [projectWithBob],
      total: 1,
      page: 1,
      pages: 1
    });

    vi.spyOn(taskService, 'getProjectTasks').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pages: 1
    });

    render(<App />);

    // Should load the project task management rather than "No projects available"
    expect(await screen.findByTestId('task-management')).toBeInTheDocument();
    expect(screen.getByText('Apollo Project – Tasks')).toBeInTheDocument();

    // Team Member should NOT see "Manage Members" button
    expect(screen.queryByTestId('btn-manage-members')).not.toBeInTheDocument();
  });
});
