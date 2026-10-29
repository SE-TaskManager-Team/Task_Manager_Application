import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectCreateModal, ProjectCreateForm, isValidDeadline } from '../components/projects/ProjectCreateModal';

describe('ProjectCreateModal & ProjectCreateForm', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ProjectCreateModal
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all form fields when open for teamLeader', () => {
    render(
      <ProjectCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        currentUser={{ role: 'teamLeader', name: 'Leader Alice' }}
      />
    );

    expect(screen.getByText('Create New Project')).toBeInTheDocument();
    expect(screen.getByTestId('project-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('project-description-input')).toBeInTheDocument();
    expect(screen.getByTestId('project-deadline-input')).toBeInTheDocument();
    expect(screen.getByTestId('project-submit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('project-cancel-btn')).toBeInTheDocument();
  });

  it('denies access when currentUser role is not teamLeader', () => {
    render(
      <ProjectCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        currentUser={{ role: 'teamMember', name: 'Member Bob' }}
      />
    );

    expect(screen.getByTestId('project-create-unauthorized')).toBeInTheDocument();
    expect(
      screen.getByText('Only team leaders are authorized to create projects.')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('project-name-input')).not.toBeInTheDocument();
  });

  it('validates required fields: empty name and empty deadline', () => {
    const handleSubmit = vi.fn();
    render(
      <ProjectCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.click(screen.getByTestId('project-submit-btn'));
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Project name is required.')).toBeInTheDocument();
    expect(screen.getByText('Deadline is required.')).toBeInTheDocument();
  });

  it('validates project name minimum length of 2 characters', () => {
    const handleSubmit = vi.fn();
    render(
      <ProjectCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.change(screen.getByTestId('project-name-input'), {
      target: { value: 'A' }
    });
    fireEvent.change(screen.getByTestId('project-deadline-input'), {
      target: { value: '2026-12-31' }
    });

    fireEvent.click(screen.getByTestId('project-submit-btn'));
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Project name must be between 2 and 120 characters.')
    ).toBeInTheDocument();
  });

  it('validates required deadline when name is provided', () => {
    const handleSubmit = vi.fn();
    render(
      <ProjectCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.change(screen.getByTestId('project-name-input'), {
      target: { value: 'Valid Project' }
    });

    fireEvent.click(screen.getByTestId('project-submit-btn'));
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Deadline is required.')).toBeInTheDocument();
  });

  it('submits valid project payload with optional description', () => {
    const handleSubmit = vi.fn();
    render(
      <ProjectCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.change(screen.getByTestId('project-name-input'), {
      target: { value: 'Project Phoenix' }
    });
    fireEvent.change(screen.getByTestId('project-description-input'), {
      target: { value: 'A resilient next-generation platform' }
    });
    fireEvent.change(screen.getByTestId('project-deadline-input'), {
      target: { value: '2026-11-30' }
    });

    fireEvent.click(screen.getByTestId('project-submit-btn'));
    expect(handleSubmit).toHaveBeenCalledWith({
      name: 'Project Phoenix',
      description: 'A resilient next-generation platform',
      deadline: '2026-11-30'
    });
  });

  it('submits valid project payload when description is omitted', () => {
    const handleSubmit = vi.fn();
    render(
      <ProjectCreateForm
        onSubmit={handleSubmit}
        onCancel={vi.fn()}
      />
    );

    fireEvent.change(screen.getByTestId('project-name-input'), {
      target: { value: 'Quick Initiative' }
    });
    fireEvent.change(screen.getByTestId('project-deadline-input'), {
      target: { value: '2026-12-15' }
    });

    fireEvent.click(screen.getByTestId('project-submit-btn'));
    expect(handleSubmit).toHaveBeenCalledWith({
      name: 'Quick Initiative',
      description: '',
      deadline: '2026-12-15'
    });
  });

  it('displays API error banner when error prop is provided', () => {
    render(
      <ProjectCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        error="Server error: duplicate project name"
      />
    );

    expect(screen.getByTestId('project-create-error')).toBeInTheDocument();
    expect(
      screen.getByText('Server error: duplicate project name')
    ).toBeInTheDocument();
  });

  it('disables submit button and shows loading state during isSubmitting', () => {
    render(
      <ProjectCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={true}
      />
    );

    const submitBtn = screen.getByTestId('project-submit-btn');
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('Creating...');
    expect(screen.getByTestId('project-cancel-btn')).toBeDisabled();
  });

  it('triggers onClose when cancel or close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ProjectCreateModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('project-cancel-btn'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('project-modal-close-btn'));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  describe('isValidDeadline validation logic', () => {
    it('accepts valid YYYY-MM-DD dates', () => {
      expect(isValidDeadline('2026-12-31')).toBe(true);
      expect(isValidDeadline('2026-02-28')).toBe(true);
    });

    it('rejects invalid or impossible dates', () => {
      expect(isValidDeadline('2026-02-31')).toBe(false);
      expect(isValidDeadline('invalid-date')).toBe(false);
      expect(isValidDeadline('25-12-2026')).toBe(false);
      expect(isValidDeadline('2026/12/31')).toBe(false);
      expect(isValidDeadline('')).toBe(false);
      expect(isValidDeadline(null)).toBe(false);
      expect(isValidDeadline(undefined)).toBe(false);
      expect(isValidDeadline(20261231)).toBe(false);
    });
  });
});
