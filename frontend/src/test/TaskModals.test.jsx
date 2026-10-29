import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { taskService } from '../services/taskService';
import { describe, it, expect, vi } from 'vitest';
import { TaskCreateModal } from '../components/tasks/TaskCreateModal';
import { TaskEditModal } from '../components/tasks/TaskEditModal';
import { TaskAssignModal } from '../components/tasks/TaskAssignModal';
import { TaskStatusModal } from '../components/tasks/TaskStatusModal';
import { TaskDeleteModal } from '../components/tasks/TaskDeleteModal';
import { TaskDetailsModal } from '../components/tasks/TaskDetailsModal';

describe('Task Modals', () => {
  const mockTask = {
    _id: 'task-100',
    title: 'Test Modal Task',
    description: 'Detailed description for testing modals',
    status: 'todo',
    priority: 'high',
    deadline: '2026-11-20T23:59:59.999Z',
    projectId: 'proj-1',
    createdById: 'leader-1',
    assigneeId: 'member-1',
    isOverdue: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z'
  };

  describe('TaskCreateModal', () => {
    it('validates required fields before submitting', () => {
      const handleSubmit = vi.fn();
      render(
        <TaskCreateModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={handleSubmit}
        />
      );

      fireEvent.click(screen.getByTestId('create-submit-btn'));
      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('Title is required.')).toBeInTheDocument();
      expect(screen.getByText('Deadline is required.')).toBeInTheDocument();
    });

    it('submits valid task payload with assignee', () => {
      const handleSubmit = vi.fn();
      render(
        <TaskCreateModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={handleSubmit}
          memberIds={['member-1']}
          memberNames={{ 'member-1': 'Member Bob' }}
        />
      );

      fireEvent.change(screen.getByTestId('create-title-input'), {
        target: { value: 'New Test Task' }
      });
      fireEvent.change(screen.getByTestId('create-desc-input'), {
        target: { value: 'Task details here' }
      });
      fireEvent.change(screen.getByTestId('create-deadline-input'), {
        target: { value: '2026-11-15' }
      });
      fireEvent.change(screen.getByTestId('create-priority-select'), {
        target: { value: 'high' }
      });
      fireEvent.change(screen.getByTestId('create-assignee-select'), {
        target: { value: 'member-1' }
      });

      fireEvent.click(screen.getByTestId('create-submit-btn'));
      expect(handleSubmit).toHaveBeenCalledWith({
        title: 'New Test Task',
        description: 'Task details here',
        priority: 'high',
        deadline: '2026-11-15',
        assigneeId: 'member-1'
      });
    });
  });

  describe('TaskEditModal', () => {
    it('populates existing task data and submits modified fields', () => {
      const handleSubmit = vi.fn();
      render(
        <TaskEditModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={handleSubmit}
          task={mockTask}
        />
      );

      expect(screen.getByTestId('edit-title-input')).toHaveValue('Test Modal Task');
      expect(screen.getByTestId('edit-desc-input')).toHaveValue(mockTask.description);

      fireEvent.change(screen.getByTestId('edit-title-input'), {
        target: { value: 'Updated Task Title' }
      });

      fireEvent.click(screen.getByTestId('edit-submit-btn'));
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Task Title',
          description: mockTask.description,
          priority: 'high'
        })
      );
    });
  });

  describe('TaskAssignModal', () => {
    it('supports reassigning to another member and unassigning', () => {
      const handleSubmit = vi.fn();
      render(
        <TaskAssignModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={handleSubmit}
          task={mockTask}
          memberIds={['member-1', 'member-2']}
          memberNames={{ 'member-1': 'Member Bob', 'member-2': 'Member Alice' }}
        />
      );

      // Change assignee to member-2
      fireEvent.change(screen.getByTestId('assign-select'), {
        target: { value: 'member-2' }
      });
      fireEvent.click(screen.getByTestId('assign-submit-btn'));
      expect(handleSubmit).toHaveBeenCalledWith('member-2');

      // Change assignee to unassigned (empty string sends null)
      fireEvent.change(screen.getByTestId('assign-select'), {
        target: { value: '' }
      });
      fireEvent.click(screen.getByTestId('assign-submit-btn'));
      expect(handleSubmit).toHaveBeenCalledWith(null);
    });
  });

  describe('TaskStatusModal', () => {
    it('restricts team member to forward progression only', () => {
      const handleSubmit = vi.fn();
      render(
        <TaskStatusModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={handleSubmit}
          task={{ ...mockTask, status: 'todo' }}
          isLeader={false}
          isAssignee={true}
        />
      );

      const select = screen.getByTestId('status-select');
      const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
      // Member on 'todo' can only stay 'todo' or advance to 'inProgress' (cannot skip to completed)
      expect(options).toEqual(['todo', 'inProgress']);

      fireEvent.change(select, { target: { value: 'inProgress' } });
      fireEvent.click(screen.getByTestId('status-submit-btn'));
      expect(handleSubmit).toHaveBeenCalledWith('inProgress');
    });

    it('gives team leader access to all valid statuses', () => {
      render(
        <TaskStatusModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          task={{ ...mockTask, status: 'completed' }}
          isLeader={true}
          isAssignee={false}
        />
      );

      const select = screen.getByTestId('status-select');
      const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
      expect(options).toEqual(['todo', 'inProgress', 'completed']);
    });
  });

  describe('TaskDeleteModal', () => {
    it('prompts confirmation with warning and calls onConfirm', () => {
      const handleConfirm = vi.fn();
      render(
        <TaskDeleteModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={handleConfirm}
          task={mockTask}
        />
      );

      expect(screen.getByText(/Are you sure you want to delete task/i)).toBeInTheDocument();
      expect(screen.getByText(/Warning:/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('delete-confirm-btn'));
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('TaskDetailsModal', () => {
    it('displays complete task information and triggers actions', async () => {
      vi.spyOn(taskService, 'getTaskComments').mockResolvedValue({ comments: [] });
      const handleOpenEdit = vi.fn();
      render(
        <TaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          isLeader={true}
          isAssignee={false}
          onOpenEdit={handleOpenEdit}
        />
      );

      expect(screen.getByTestId('task-detail-description')).toHaveTextContent(mockTask.description);
      expect(screen.getByTestId('task-detail-deadline')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('detail-edit-btn'));
      expect(handleOpenEdit).toHaveBeenCalledWith(mockTask);

      await waitFor(() => {
        expect(screen.getByTestId('no-comments-msg')).toBeInTheDocument();
      });
    });

    it('renders Comments section, loads and displays existing comments with author and timestamp', async () => {
      const mockComments = [
        {
          _id: 'comment-1',
          taskId: 'task-100',
          authorId: { _id: 'leader-1', name: 'Alice Leader' },
          text: 'Please review the initial implementation.',
          createdAt: '2026-10-29T10:00:00.000Z'
        },
        {
          _id: 'comment-2',
          taskId: 'task-100',
          authorId: { _id: 'member-1', name: 'Bob Member' },
          text: 'Tests are passing, ready for review.',
          createdAt: '2026-10-29T11:00:00.000Z'
        }
      ];

      vi.spyOn(taskService, 'getTaskComments').mockResolvedValue({ comments: mockComments });

      render(
        <TaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          isLeader={true}
          token="test-token"
        />
      );

      expect(screen.getByTestId('task-comments-section')).toBeInTheDocument();
      expect(taskService.getTaskComments).toHaveBeenCalledWith('task-100', 'test-token');

      await waitFor(() => {
        expect(screen.getByTestId('comment-item-comment-1')).toBeInTheDocument();
        expect(screen.getByTestId('comment-item-comment-2')).toBeInTheDocument();
      });

      expect(screen.getByText('Alice Leader')).toBeInTheDocument();
      expect(screen.getByText('Please review the initial implementation.')).toBeInTheDocument();
      expect(screen.getByText('Bob Member')).toBeInTheDocument();
      expect(screen.getByText('Tests are passing, ready for review.')).toBeInTheDocument();
    });

    it('displays empty state when no comments exist', async () => {
      vi.spyOn(taskService, 'getTaskComments').mockResolvedValue({ comments: [] });

      render(
        <TaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          isLeader={false}
          token="test-token"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('no-comments-msg')).toHaveTextContent('No comments yet.');
      });
    });

    it('displays error state when loading comments fails and allows retry', async () => {
      vi.spyOn(taskService, 'getTaskComments')
        .mockRejectedValueOnce(new Error('Network disconnected'))
        .mockResolvedValueOnce({ comments: [] });

      render(
        <TaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          token="test-token"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comments-load-error')).toHaveTextContent('Network disconnected');
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.queryByTestId('comments-load-error')).not.toBeInTheDocument();
        expect(screen.getByTestId('no-comments-msg')).toBeInTheDocument();
      });
    });

    it('rejects empty or whitespace-only comment submission', async () => {
      vi.spyOn(taskService, 'getTaskComments').mockResolvedValue({ comments: [] });
      const addCommentSpy = vi.spyOn(taskService, 'addComment');

      render(
        <TaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          token="test-token"
          currentUser={{ _id: 'member-1', role: 'teamMember', name: 'Bob' }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-input')).toBeInTheDocument();
      });

      // Attempt empty submission
      fireEvent.click(screen.getByTestId('add-comment-btn'));
      expect(addCommentSpy).not.toHaveBeenCalled();
      expect(screen.getByTestId('comment-submit-error')).toHaveTextContent('Comment cannot be empty.');

      // Attempt whitespace-only submission
      fireEvent.change(screen.getByTestId('comment-input'), { target: { value: '    \t\n  ' } });
      fireEvent.click(screen.getByTestId('add-comment-btn'));
      expect(addCommentSpy).not.toHaveBeenCalled();
      expect(screen.getByTestId('comment-submit-error')).toHaveTextContent('Comment cannot be empty.');
    });

    it('submits valid comment, persists it, and renders the new comment with success message', async () => {
      vi.spyOn(taskService, 'getTaskComments').mockResolvedValue({ comments: [] });
      const newComment = {
        _id: 'comment-999',
        taskId: 'task-100',
        authorId: { _id: 'member-1', name: 'Bob Member' },
        text: 'Newly posted test comment',
        createdAt: '2026-10-29T12:00:00.000Z'
      };
      vi.spyOn(taskService, 'addComment').mockResolvedValue({ comment: newComment });

      render(
        <TaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          token="test-token"
          currentUser={{ _id: 'member-1', role: 'teamMember', name: 'Bob Member' }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('comment-input'), {
        target: { value: 'Newly posted test comment' }
      });
      fireEvent.click(screen.getByTestId('add-comment-btn'));

      await waitFor(() => {
        expect(taskService.addComment).toHaveBeenCalledWith(
          'task-100',
          { text: 'Newly posted test comment' },
          'test-token'
        );
        expect(screen.getByTestId('comment-success-alert')).toHaveTextContent('Comment added successfully.');
        expect(screen.getByTestId('comment-item-comment-999')).toBeInTheDocument();
        expect(screen.getByText('Newly posted test comment')).toBeInTheDocument();
      });

      expect(screen.getByTestId('comment-input')).toHaveValue('');
    });

    it('displays error message when adding comment fails', async () => {
      vi.spyOn(taskService, 'getTaskComments').mockResolvedValue({ comments: [] });
      vi.spyOn(taskService, 'addComment').mockRejectedValue(new Error('Server error while saving comment'));

      render(
        <TaskDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          task={mockTask}
          token="test-token"
          currentUser={{ _id: 'member-1', role: 'teamMember', name: 'Bob Member' }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('comment-input'), {
        target: { value: 'Failing comment' }
      });
      fireEvent.click(screen.getByTestId('add-comment-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('comment-submit-error')).toHaveTextContent('Server error while saving comment');
      });
    });
  });
});
