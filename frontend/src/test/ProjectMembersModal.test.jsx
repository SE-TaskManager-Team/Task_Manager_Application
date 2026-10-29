import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectMembersModal } from '../components/projects/ProjectMembersModal';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';

describe('ProjectMembersModal', () => {
  const mockLeader = {
    _id: 'leader-1',
    name: 'Leader Alice',
    role: 'teamLeader'
  };

  const mockProject = {
    _id: 'proj-1',
    name: 'Membership Demo Project',
    teamLeaderId: 'leader-1',
    memberIds: ['member-1']
  };

  const mockUsers = [
    {
      _id: 'member-1',
      name: 'Bob Current',
      email: 'bob@example.com',
      role: 'teamMember',
      isActive: true
    },
    {
      _id: 'member-2',
      name: 'Charlie New',
      email: 'charlie@example.com',
      role: 'teamMember',
      isActive: true
    },
    {
      _id: 'leader-1',
      name: 'Leader Alice',
      email: 'alice@example.com',
      role: 'teamLeader',
      isActive: true
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ProjectMembersModal
        isOpen={false}
        onClose={vi.fn()}
        projectId={mockProject._id}
        project={mockProject}
        token="mock-token"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal and filters out current members from available dropdown', async () => {
    vi.spyOn(userService, 'getUsers').mockResolvedValue({ items: mockUsers });

    render(
      <ProjectMembersModal
        isOpen={true}
        onClose={vi.fn()}
        projectId={mockProject._id}
        project={mockProject}
        token="mock-token"
        currentUser={mockLeader}
        allUsers={mockUsers}
      />
    );

    expect(screen.getByText('Project Members – Membership Demo Project')).toBeInTheDocument();
    expect(screen.getByTestId('select-member-to-add')).toBeInTheDocument();

    // Bob is already a member, so he should not be in the add-member dropdown
    expect(screen.queryByRole('option', { name: /Bob Current/ })).not.toBeInTheDocument();

    // Charlie is not a member, so he should be available to add
    expect(screen.getByRole('option', { name: /Charlie New/ })).toBeInTheDocument();

    // Current members section displays Bob
    expect(screen.getByTestId('member-row-member-1')).toHaveTextContent('Bob Current');
  });

  it('denies access if currentUser is not the teamLeader', () => {
    render(
      <ProjectMembersModal
        isOpen={true}
        onClose={vi.fn()}
        projectId={mockProject._id}
        project={mockProject}
        token="mock-token"
        currentUser={{ _id: 'member-1', role: 'teamMember' }}
        allUsers={mockUsers}
      />
    );

    expect(screen.getByTestId('members-unauthorized')).toBeInTheDocument();
    expect(screen.queryByTestId('select-member-to-add')).not.toBeInTheDocument();
  });

  it('successfully adds an active team member and triggers onProjectUpdated', async () => {
    const updatedProject = {
      ...mockProject,
      memberIds: ['member-1', 'member-2']
    };

    const addMemberSpy = vi.spyOn(projectService, 'addMember').mockResolvedValue({
      project: updatedProject
    });

    const onProjectUpdated = vi.fn();

    render(
      <ProjectMembersModal
        isOpen={true}
        onClose={vi.fn()}
        projectId={mockProject._id}
        project={mockProject}
        token="mock-token"
        currentUser={mockLeader}
        allUsers={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    // Select Charlie
    fireEvent.change(screen.getByTestId('select-member-to-add'), {
      target: { value: 'member-2' }
    });

    // Click Add Member
    fireEvent.click(screen.getByTestId('btn-confirm-add-member'));

    await waitFor(() => {
      expect(addMemberSpy).toHaveBeenCalledWith('proj-1', 'member-2', 'mock-token');
      expect(onProjectUpdated).toHaveBeenCalledWith(updatedProject);
    });

    expect(await screen.findByTestId('members-modal-success')).toHaveTextContent(
      'Member added to project successfully.'
    );
  });

  it('displays error if adding member fails (e.g. duplicate or authorization)', async () => {
    vi.spyOn(projectService, 'addMember').mockRejectedValue(
      new Error('This user is already a project member.')
    );

    render(
      <ProjectMembersModal
        isOpen={true}
        onClose={vi.fn()}
        projectId={mockProject._id}
        project={mockProject}
        token="mock-token"
        currentUser={mockLeader}
        allUsers={mockUsers}
      />
    );

    fireEvent.change(screen.getByTestId('select-member-to-add'), {
      target: { value: 'member-2' }
    });
    fireEvent.click(screen.getByTestId('btn-confirm-add-member'));

    expect(await screen.findByTestId('members-modal-error')).toHaveTextContent(
      'This user is already a project member.'
    );
  });

  it('successfully removes a member and triggers onProjectUpdated', async () => {
    const updatedProject = {
      ...mockProject,
      memberIds: []
    };

    const removeMemberSpy = vi.spyOn(projectService, 'removeMember').mockResolvedValue({
      project: updatedProject
    });

    const onProjectUpdated = vi.fn();

    render(
      <ProjectMembersModal
        isOpen={true}
        onClose={vi.fn()}
        projectId={mockProject._id}
        project={mockProject}
        token="mock-token"
        currentUser={mockLeader}
        allUsers={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    fireEvent.click(screen.getByTestId('btn-remove-member-member-1'));

    await waitFor(() => {
      expect(removeMemberSpy).toHaveBeenCalledWith('proj-1', 'member-1', 'mock-token');
      expect(onProjectUpdated).toHaveBeenCalledWith(updatedProject);
    });

    expect(await screen.findByTestId('members-modal-success')).toHaveTextContent(
      'Member removed from project.'
    );
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ProjectMembersModal
        isOpen={true}
        onClose={handleClose}
        projectId={mockProject._id}
        project={mockProject}
        token="mock-token"
        currentUser={mockLeader}
        allUsers={mockUsers}
      />
    );

    fireEvent.click(screen.getByTestId('btn-close-members'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('btn-close-members-modal'));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
