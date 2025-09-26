import type { ProjectSummary } from '../types';

interface ProjectSelectorProps {
  projects: ProjectSummary[];
  selectedProjectId: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (project: ProjectSummary) => void;
  isLoading: boolean;
  error?: string | null;
}

export function ProjectSelector({
  projects,
  selectedProjectId,
  search,
  onSearchChange,
  onSelect,
  isLoading,
  error,
}: ProjectSelectorProps) {
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
          <div className="hint">Проекты не найдены. Попросите администратора добавить новый проект.</div>
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
      <p className="hint">
        Не нашли свой проект? Свяжитесь с проектным офисом, чтобы добавить его в список.
      </p>
    </section>
  );
}
