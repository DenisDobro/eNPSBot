import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ProjectSummary } from '../types';

interface ProjectSelectorProps {
  projects: ProjectSummary[];
  selectedProjectId: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (project: ProjectSummary) => void;
  onAddProject?: (name: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export function ProjectSelector({
  projects,
  selectedProjectId,
  search,
  onSearchChange,
  onSelect,
  onAddProject,
  isLoading,
  error,
}: ProjectSelectorProps) {
  const [projectName, setProjectName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddProject = async (event: FormEvent) => {
    if (!onAddProject) {
      return;
    }

    event.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) {
      setAddError('Введите название проекта');
      return;
    }

    setAddError(null);
    setAdding(true);
    try {
      await onAddProject(trimmed);
      setProjectName('');
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>Проекты</h2>
          <p className="panel-subtitle">Выберите проект, чтобы увидеть историю ответов и заполнить анкету.</p>
        </div>
      </header>
      <div className="project-search">
        <input
          type="search"
          value={search}
          className="input"
          placeholder="Поиск по проектам"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="project-list">
        {isLoading && <div className="hint">Загружаем проекты…</div>}
        {error && <div className="error-message">{error}</div>}
        {!isLoading && !projects.length && !error && (
          <div className="hint">Проекты не найдены. Добавьте новый проект, чтобы начать.</div>
        )}
        {projects.map((project) => {
          const isSelected = project.id === selectedProjectId;
          return (
            <button
              key={project.id}
              type="button"
              className={`project-card ${isSelected ? 'project-card--active' : ''}`}
              onClick={() => onSelect(project)}
            >
              <span className="project-name">{project.name}</span>
              <span className="project-meta">
                {project.responsesCount > 0
                  ? `Ответов: ${project.responsesCount}`
                  : 'Пока нет ответов'}
              </span>
              {project.lastResponseAt && (
                <span className="project-meta">Последний ответ: {new Date(project.lastResponseAt).toLocaleDateString()}</span>
              )}
            </button>
          );
        })}
      </div>
      {onAddProject && (
        <form className="project-add" onSubmit={handleAddProject}>
          <label className="project-add__label" htmlFor="new-project">
            Добавить проект
          </label>
          <div className="project-add__controls">
            <input
              id="new-project"
              type="text"
              value={projectName}
              className="input"
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Название проекта"
              disabled={adding}
            />
            <button type="submit" className="button" disabled={adding}>
              {adding ? 'Сохраняем…' : 'Добавить'}
            </button>
          </div>
          {(addError || (!projects.length && !isLoading)) && (
            <p className={`form-hint ${addError ? 'error-message' : 'hint'}`}>
              {addError ?? 'Добавьте проект, чтобы начать собирать обратную связь.'}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
