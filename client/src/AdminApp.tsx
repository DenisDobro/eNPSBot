import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import './App.css';
import './AdminApp.css';
import {
  createAdminProject,
  deleteAdminProject,
  fetchAdminDebugToken,
  fetchAdminProjectResponses,
  fetchAdminProjects,
  sanitizeAdminToken,
  updateAdminProjectName,
  updateAdminSurvey,
  deleteAdminSurvey,
} from './api';
import type { AdminProjectStats, AdminSurveyRecord, SurveyAnswers } from './types';
import type { QuestionConfig } from './components/SurveyStepper';
import SurveyInlineEditor from './components/SurveyInlineEditor';
import ThemeToggle from './components/ThemeToggle';
import { ExternalLinkIcon, KeyIcon, ProfileIcon } from './components/icons';
import { useThemePreference, type ThemePreference } from './hooks/useThemePreference';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const ADMIN_QUESTION_CONFIG: QuestionConfig[] = [
  {
    key: 'projectRecommendation',
    title: 'Насколько вероятно, что вы порекомендуете участие в проекте коллеге?',
    description: '0 — точно нет, 10 — однозначно да.',
    type: 'scale',
  },
  {
    key: 'projectImprovement',
    title: 'Что могло бы повысить оценку проекта?',
    type: 'text',
  },
  {
    key: 'managerEffectiveness',
    title: 'Насколько эффективно менеджер помогает снимать блокеры?',
    description: '0 — никак не помогает, 10 — помогает всегда и быстро.',
    type: 'scale',
  },
  {
    key: 'managerImprovement',
    title: 'Что менеджер мог бы улучшить?',
    type: 'text',
  },
  {
    key: 'teamComfort',
    title: 'Насколько комфортно работать с командой?',
    type: 'scale',
  },
  {
    key: 'teamImprovement',
    title: 'Что можно улучшить в командной работе?',
    type: 'text',
  },
  {
    key: 'processOrganization',
    title: 'Насколько хорошо организованы процессы?',
    type: 'scale',
  },
  {
    key: 'processObstacles',
    title: 'Что мешало работать эффективнее?',
    type: 'text',
  },
  {
    key: 'contributionValued',
    title: 'Чувствует ли сотрудник, что его вклад ценится?',
    type: 'options',
    options: [
      { label: 'Да', value: 'yes' },
      { label: 'Частично', value: 'partial' },
      { label: 'Нет', value: 'no' },
    ],
  },
  {
    key: 'improvementIdeas',
    title: 'Какие есть идеи для улучшения?',
    type: 'text',
  },
];

interface ResponseGroup {
  id: string;
  label: string;
  startMs: number;
  isRecent: boolean;
  responses: AdminSurveyRecord[];
}

function getWeekStart(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const offset = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - offset);
  return result;
}

function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const formatOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long' };
  const startLabel = start.toLocaleDateString('ru-RU', formatOptions);
  const endLabel = end.toLocaleDateString('ru-RU', formatOptions);
  const yearLabel = end.toLocaleDateString('ru-RU', { year: 'numeric' });

  return `${startLabel} — ${endLabel} ${yearLabel}`;
}

const STORAGE_KEY = 'enps-admin-token';

function resolveInitialToken(storageEnabled: boolean): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get('token') ?? params.get('adminToken');

    if (queryToken) {
      const trimmed = queryToken.trim();
      if (trimmed) {
        if (storageEnabled) {
          localStorage.setItem(STORAGE_KEY, trimmed);
        }
        return trimmed;
      }
    }

    if (storageEnabled) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.trim()) {
        return saved.trim();
      }
    }

    const envToken = import.meta.env.VITE_ADMIN_TOKEN;
    if (envToken && envToken.trim()) {
      return envToken.trim();
    }
  } catch {
    // ignore storage errors
  }

  return null;
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  return value.toFixed(1);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatShortDateTime(value: string): string {
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  };

  return new Date(value).toLocaleString('ru-RU', options);
}

function formatUserName(record: AdminSurveyRecord): string {
  const { firstName, lastName, username } = record.user;
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ');
  }

  return username ? `@${username}` : `ID ${record.user.id}`;
}

function RatingRow({ label, value }: { label: string; value?: number | null }) {
  if (value === undefined || value === null) {
    return null;
  }

  return (
    <div className="admin-response-rating">
      <span className="admin-response-rating__label">{label}</span>
      <span className="admin-response-rating__value">{value}</span>
    </div>
  );
}

interface AdminAppProps {
  initialToken?: string | null;
  embedded?: boolean;
  onTokenChange?: (token: string | null) => void;
  onBackToUser?: () => void;
}

export default function AdminApp({ initialToken = null, embedded = false, onTokenChange, onBackToUser }: AdminAppProps) {
  const { theme, preference, setPreference } = useThemePreference();
  const handleThemePreferenceChange = useCallback(
    (value: ThemePreference) => {
      setPreference(value);
    },
    [setPreference],
  );
  const storageEnabled = !embedded;
  const [token, setToken] = useState<string | null>(() => {
    if (initialToken && initialToken.trim()) {
      return initialToken.trim();
    }

    return resolveInitialToken(storageEnabled);
  });
  const [tokenInput, setTokenInput] = useState(token ?? '');
  const [projects, setProjects] = useState<AdminProjectStats[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [responses, setResponses] = useState<AdminSurveyRecord[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [projectActionId, setProjectActionId] = useState<number | null>(null);
  const [editingResponseId, setEditingResponseId] = useState<number | null>(null);
  const [responseActionId, setResponseActionId] = useState<number | null>(null);
  const debugTokenAttemptedRef = useRef(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const totalResponses = useMemo(
    () => projects.reduce((acc, project) => acc + project.responsesCount, 0),
    [projects],
  );

  const totalRespondents = useMemo(
    () => projects.reduce((acc, project) => acc + project.uniqueRespondents, 0),
    [projects],
  );

  const refreshProjectsList = useCallback(
    async (preserveSelection: boolean) => {
      if (!token) {
        return;
      }

      try {
        const data = await fetchAdminProjects(token);
        setProjects(data.projects);
        setSelectedProjectId((current) => {
          if (preserveSelection && current && data.projects.some((project) => project.id === current)) {
            return current;
          }

          return data.projects[0]?.id ?? null;
        });
      } catch (error) {
        setProjectsError(error instanceof Error ? error.message : String(error));
      }
    },
    [token],
  );

  const loadProjectResponses = useCallback(
    async (projectId: number) => {
      if (!token) {
        return;
      }

      setResponsesLoading(true);
      setResponsesError(null);

      try {
        const data = await fetchAdminProjectResponses(token, projectId);
        setResponses(data.surveys);
      } catch (error) {
        setResponsesError(error instanceof Error ? error.message : String(error));
      } finally {
        setResponsesLoading(false);
      }
    },
    [token],
  );

  const handleTokenSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      try {
        const sanitized = sanitizeAdminToken(tokenInput);
        setToken(sanitized);
        setProjectsError(null);
      } catch (error) {
        setProjectsError(error instanceof Error ? error.message : String(error));
      }
    },
    [tokenInput],
  );

  useEffect(() => {
    onTokenChange?.(token);

    if (!storageEnabled) {
      return;
    }

    try {
      if (token) {
        localStorage.setItem(STORAGE_KEY, token);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [onTokenChange, storageEnabled, token]);

  useEffect(() => {
    setTokenInput(token ?? '');
  }, [token]);

  const overallProjectScore = useMemo(() => {
    let weightedSum = 0;
    let weight = 0;

    projects.forEach((project) => {
      if (project.responsesCount > 0 && project.averages.projectRecommendation !== null) {
        weightedSum += project.averages.projectRecommendation * project.responsesCount;
        weight += project.responsesCount;
      }
    });

    if (weight === 0) {
      return null;
    }

    return weightedSum / weight;
  }, [projects]);

  const selectedProjectScore = selectedProject?.averages.projectRecommendation ?? null;

  const overviewCards = useMemo(
    () => [
      {
        label: 'Всего ответов',
        value: totalResponses,
        hint: 'По всем проектам',
      },
      {
        label: 'Уникальных сотрудников',
        value: totalRespondents,
        hint: 'С учётом всех проектов',
      },
      {
        label: 'Средняя оценка портфеля',
        value: formatScore(overallProjectScore),
        hint: 'NPS внутри проектов',
      },
      {
        label: selectedProject ? `Средняя оценка «${selectedProject.name}»` : 'Нет выбранного проекта',
        value: formatScore(selectedProjectScore),
        hint: selectedProject ? `Ответов: ${selectedProject.responsesCount}` : 'Выберите проект слева',
      },
    ],
    [overallProjectScore, selectedProject, selectedProjectScore, totalRespondents, totalResponses],
  );

  useEffect(() => {
    if (!token) {
      setProjects([]);
      setSelectedProjectId(null);
      setProjectsError(null);
      return;
    }

    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError(null);

    fetchAdminProjects(token)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setProjects(data.projects);
        if (data.projects.length > 0) {
          setSelectedProjectId((current) => {
            if (current && data.projects.some((project) => project.id === current)) {
              return current;
            }

            return data.projects[0].id;
          });
        } else {
          setSelectedProjectId(null);
        }

      })
      .catch((error: Error & { status?: number }) => {
        if (cancelled) {
          return;
        }

        const message = error.message || 'Не удалось загрузить статистику проектов';
        setProjectsError(message);

        if (error.status === 401) {
          debugTokenAttemptedRef.current = false;
          setToken(null);
          setTokenInput('');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedProjectId || !token) {
      setResponses([]);
      setResponsesError(null);
      return;
    }

    void loadProjectResponses(selectedProjectId);
  }, [loadProjectResponses, selectedProjectId, token]);

  useEffect(() => {
    if (embedded || token || debugTokenAttemptedRef.current) {
      return;
    }

      debugTokenAttemptedRef.current = true;
      let cancelled = false;

      fetchAdminDebugToken()
      .then((data) => {
        if (cancelled) {
          return;
        }

        try {
          const sanitized = sanitizeAdminToken(data.token);
          setToken(sanitized);
        } catch (error) {
          setProjectsError(error instanceof Error ? error.message : String(error));
        }
      })
      .catch((error: Error & { status?: number }) => {
        if (cancelled || error.status === 404) {
          return;
        }

        setProjectsError((prev) => prev ?? (error.message || 'Не удалось получить токен администратора'));
      });

    return () => {
      cancelled = true;
    };
  }, [embedded, token]);

  const handleCreateProjectSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!token) {
        return;
      }

      const trimmed = newProjectName.trim();
      if (!trimmed) {
        setCreateProjectError('Введите название проекта');
        return;
      }

      setCreateProjectError(null);
      setCreatingProject(true);

      try {
        const response = await createAdminProject(token, trimmed);
        setProjects((prev) => {
          const filtered = prev.filter((project) => project.id !== response.project.id);
          return [response.project, ...filtered];
        });
        setResponses([]);
        setSelectedProjectId(response.project.id);
        setNewProjectName('');
      } catch (error) {
        setCreateProjectError(error instanceof Error ? error.message : String(error));
      } finally {
        setCreatingProject(false);
      }
    },
    [
      newProjectName,
      token,
      setProjects,
      setResponses,
      setSelectedProjectId,
      setNewProjectName,
      setCreateProjectError,
      setCreatingProject,
    ],
  );

  const handleRenameSelectedProject = useCallback(async () => {
    if (!selectedProject || !token) {
      return;
    }

    const proposed = window.prompt('Новое название проекта', selectedProject.name);
    if (!proposed) {
      return;
    }

    const trimmed = proposed.trim();
    if (!trimmed || trimmed === selectedProject.name) {
      return;
    }

    setProjectActionId(selectedProject.id);
    setProjectsError(null);

    try {
      await updateAdminProjectName(token, selectedProject.id, trimmed);
      await refreshProjectsList(true);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : String(error));
    } finally {
      setProjectActionId(null);
    }
  }, [refreshProjectsList, selectedProject, token]);

  const handleDeleteSelectedProject = useCallback(async () => {
    if (!selectedProject || !token) {
      return;
    }

    const confirmed = window.confirm('Удалить проект и все ответы? Эту операцию нельзя отменить.');
    if (!confirmed) {
      return;
    }

    setProjectActionId(selectedProject.id);
    setProjectsError(null);

    try {
      await deleteAdminProject(token, selectedProject.id);
      setResponses([]);
      await refreshProjectsList(false);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : String(error));
    } finally {
      setProjectActionId(null);
    }
  }, [refreshProjectsList, selectedProject, token]);

  const handleBackToUser = useCallback(() => {
    if (onBackToUser) {
      onBackToUser();
      return;
    }

    window.location.href = '/';
  }, [onBackToUser]);

  const handleOpenInBrowser = useCallback(() => {
    if (!token) {
      return;
    }

    const url = `${window.location.origin}/admin?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [token]);

  const contributionData = useMemo(() => {
    if (!selectedProject) {
      return [];
    }

    const total =
      selectedProject.contributionBreakdown.yes +
      selectedProject.contributionBreakdown.partial +
      selectedProject.contributionBreakdown.no;

    const entries: Array<{ label: string; count: number; variant: 'yes' | 'partial' | 'no' }> = [
      { label: 'Вклад ценится', count: selectedProject.contributionBreakdown.yes, variant: 'yes' },
      { label: 'Частично', count: selectedProject.contributionBreakdown.partial, variant: 'partial' },
      { label: 'Нет', count: selectedProject.contributionBreakdown.no, variant: 'no' },
    ];

    return entries.map((entry) => ({
      ...entry,
      percent: total > 0 ? Math.round((entry.count / total) * 100) : 0,
    }));
  }, [selectedProject]);

  const averageRows = useMemo(() => {
    if (!selectedProject) {
      return [];
    }

    return [
      { label: 'Проект', value: selectedProject.averages.projectRecommendation },
      { label: 'Менеджер', value: selectedProject.averages.managerEffectiveness },
      { label: 'Команда', value: selectedProject.averages.teamComfort },
      { label: 'Процессы', value: selectedProject.averages.processOrganization },
    ];
  }, [selectedProject]);

  const formatAverage = (value: number | null): string => {
    if (value === null || Number.isNaN(value)) {
      return '—';
    }

    return value.toFixed(1);
  };

  const groupedResponses = useMemo<ResponseGroup[]>(() => {
    if (!responses.length) {
      return [];
    }

    const groups = new Map<string, ResponseGroup>();

    responses.forEach((response) => {
      const createdAt = new Date(response.createdAt);
      const start = getWeekStart(createdAt);
      const key = start.toISOString();

      let group = groups.get(key);
      if (!group) {
        const label = formatWeekRange(start);
        const isRecent = Date.now() - start.getTime() <= FOURTEEN_DAYS_MS;
        group = {
          id: key,
          label,
          startMs: start.getTime(),
          isRecent,
          responses: [],
        };
        groups.set(key, group);
      }

      group.responses.push(response);
    });

    return Array.from(groups.values())
      .sort((a, b) => b.startMs - a.startMs)
      .map((group) => ({
        ...group,
        responses: group.responses.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      }));
  }, [responses]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = {};
      groupedResponses.forEach((group) => {
        next[group.id] = prev[group.id] ?? group.isRecent;
      });
      return next;
    });
  }, [groupedResponses]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdateResponse = useCallback(
    async (surveyId: number, updates: SurveyAnswers) => {
      if (!token || !selectedProjectId) {
        return;
      }

      setResponseActionId(surveyId);
      setResponsesError(null);

      try {
        await updateAdminSurvey(token, surveyId, updates);
        setEditingResponseId(null);
        await refreshProjectsList(true);
        await loadProjectResponses(selectedProjectId);
      } catch (error) {
        setResponsesError(error instanceof Error ? error.message : String(error));
      } finally {
        setResponseActionId(null);
      }
    },
    [loadProjectResponses, refreshProjectsList, selectedProjectId, token],
  );

  const handleDeleteResponse = useCallback(
    async (surveyId: number) => {
      if (!token || !selectedProjectId) {
        return;
      }

      const confirmed = window.confirm('Удалить ответ пользователя?');
      if (!confirmed) {
        return;
      }

      setResponseActionId(surveyId);
      setResponsesError(null);

      try {
        await deleteAdminSurvey(token, surveyId);
        setEditingResponseId(null);
        await refreshProjectsList(true);
        await loadProjectResponses(selectedProjectId);
      } catch (error) {
        setResponsesError(error instanceof Error ? error.message : String(error));
      } finally {
        setResponseActionId(null);
      }
    },
    [loadProjectResponses, refreshProjectsList, selectedProjectId, token],
  );

  if (!token) {
    return (
      <div className="app admin-app">
        <div className="app-gradient" />
        <div className="app-container admin-container">
          <section className="panel">
            <header className="panel-header">
              <div>
                <h2>Доступ в админку</h2>
                <p className="panel-subtitle">Введите токен, чтобы посмотреть статистику проектного офиса.</p>
              </div>
            </header>
            <form className="panel-body admin-token-form" onSubmit={handleTokenSubmit}>
              <input
                className="input"
                type="password"
                placeholder="Токен администратора"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
              />
              {projectsError && <div className="error-message">{projectsError}</div>}
              <button type="submit" className="button" disabled={!tokenInput.trim()}>
                Войти
              </button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app admin-app">
      <div className="app-gradient" />
      <div className="app-container admin-container">
        <header className="admin-header">
          <div className="admin-header__title">
            <h1 className="app-title">Проектный офис</h1>
            <p className="app-subtitle">Аналитика по проектам и обратной связи команды в реальном времени.</p>
          </div>
          <div className="admin-header__toolbar" role="group" aria-label="Управление админкой">
            <button
              type="button"
              className="icon-button"
              onClick={handleBackToUser}
              aria-label="Перейти в режим пользователя"
              title="Перейти в режим пользователя"
            >
              <span className="icon-button__glyph" aria-hidden="true">
                <ProfileIcon />
              </span>
            </button>
            <ThemeToggle
              theme={theme}
              preference={preference}
              onPreferenceChange={handleThemePreferenceChange}
            />
            <button
              type="button"
              className="icon-button"
              onClick={handleOpenInBrowser}
              disabled={!token}
              aria-label={
                token
                  ? 'Открыть админку в браузере'
                  : 'Открытие в браузере доступно после ввода токена'
              }
              title={
                token
                  ? 'Открыть админку в браузере'
                  : 'Открытие в браузере доступно после ввода токена'
              }
            >
              <span className="icon-button__glyph" aria-hidden="true">
                <ExternalLinkIcon />
              </span>
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                debugTokenAttemptedRef.current = false;
                setToken(null);
                setTokenInput('');
              }}
              aria-label="Сменить токен доступа"
              title="Сменить токен доступа"
            >
              <span className="icon-button__glyph" aria-hidden="true">
                <KeyIcon />
              </span>
            </button>
          </div>
        </header>
        {projectsError && <div className="banner banner--error">{projectsError}</div>}
        <section className="admin-overview">
          {overviewCards.map((card) => (
            <div key={card.label} className="admin-overview__card">
              <span className="admin-overview__value">{card.value}</span>
              <span className="admin-overview__label">{card.label}</span>
              <span className="admin-overview__hint">{card.hint}</span>
            </div>
          ))}
        </section>
        <div className="admin-layout">
          <aside className="panel admin-panel admin-panel--projects">
            <header className="admin-panel__header">
              <div>
                <h2>Проекты</h2>
                <p className="panel-subtitle">Выберите проект, чтобы увидеть ответы команды.</p>
              </div>
            </header>
            <div className="admin-panel__body admin-projects">
              {projectsLoading && <div className="hint">Загружаем проекты…</div>}
              {!projectsLoading && projects.length === 0 && <div className="hint">Пока нет активных проектов.</div>}
              {!projectsLoading && projects.length > 0 && (
                <div className="admin-projects__list">
                  {projects.map((project) => {
                    const isActive = project.id === selectedProjectId;
                    const { averages } = project;
                    const lastResponseLabel = project.lastResponseAt
                      ? `Последний ответ: ${formatShortDateTime(project.lastResponseAt)}`
                      : 'Ответов пока нет';

                    return (
                      <button
                        type="button"
                        key={project.id}
                        className={`admin-project-card ${isActive ? 'admin-project-card--active' : ''}`}
                        onClick={() => setSelectedProjectId(project.id)}
                      >
                        <div className="admin-project-card__header">
                          <h3 className="admin-project-card__name">{project.name}</h3>
                          <span className="admin-project-card__badge">{project.responsesCount}</span>
                        </div>
                        <p className="admin-project-card__meta">{lastResponseLabel}</p>
                        <div className="admin-project-card__stats">
                          <div>
                            <span className="admin-project-card__stat-label">NPS</span>
                            <span className="admin-project-card__stat-value">{formatScore(averages.projectRecommendation)}</span>
                          </div>
                          <div>
                            <span className="admin-project-card__stat-label">Сотрудники</span>
                            <span className="admin-project-card__stat-value">{project.uniqueRespondents}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <form className="admin-project-add" onSubmit={handleCreateProjectSubmit}>
                <label className="admin-project-add__label" htmlFor="admin-new-project">
                  Добавить проект
                </label>
                <div className="admin-project-add__controls">
                  <input
                    id="admin-new-project"
                    type="text"
                    className="input"
                    placeholder="Название проекта"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    disabled={creatingProject}
                  />
                  <button type="submit" className="button" disabled={creatingProject || !newProjectName.trim()}>
                    {creatingProject ? 'Сохраняем…' : 'Добавить'}
                  </button>
                </div>
                <p className={`admin-project-add__hint ${createProjectError ? 'admin-project-add__hint--error' : ''}`}>
                  {createProjectError ?? 'Проект появится в списке и станет доступен команде для анкет.'}
                </p>
              </form>
            </div>
          </aside>
          <section className="panel admin-panel admin-panel--details">
            {selectedProject ? (
              <>
                <header className="admin-panel__header admin-details__header">
                  <div>
                    <h2>{selectedProject.name}</h2>
                    <p className="panel-subtitle">
                      Ответов: {responses.length}
                      {selectedProject.lastResponseAt ? ` · Последний: ${formatShortDateTime(selectedProject.lastResponseAt)}` : ''}
                    </p>
                  </div>
                  <div className="admin-details__actions">
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={handleRenameSelectedProject}
                      disabled={projectActionId === selectedProject.id}
                    >
                      Переименовать
                    </button>
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={handleDeleteSelectedProject}
                      disabled={projectActionId === selectedProject.id}
                    >
                      Удалить проект
                    </button>
                  </div>
                </header>
                <div className="admin-metrics">
                  {averageRows.map((row) => (
                    <div key={row.label} className="admin-metric">
                      <div className="admin-metric__label">
                        <span>{row.label}</span>
                        <span>{formatAverage(row.value)}</span>
                      </div>
                      <div className="admin-metric__bar">
                        <div
                          className="admin-metric__fill"
                          style={{ width: `${row.value ? (Math.min(row.value, 10) / 10) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {contributionData.length > 0 && (
                  <div className="admin-contribution-grid">
                    {contributionData.map((item) => (
                      <div key={item.label} className="admin-contribution-card">
                        <span className="admin-contribution-card__label">{item.label}</span>
                        <span className="admin-contribution-card__value">
                          {item.count} • {item.percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="admin-responses-panel">
                  {responsesLoading && <div className="hint">Загружаем ответы…</div>}
                  {responsesError && <div className="error-message">{responsesError}</div>}
                  {!responsesLoading && responses.length === 0 && !responsesError && (
                    <div className="hint">Ответов для выбранного проекта пока нет.</div>
                  )}
                  {!responsesLoading && responses.length > 0 && (
                    <div className="admin-responses__groups">
                      {groupedResponses.map((group) => {
                        const isOpen = expandedGroups[group.id] ?? group.isRecent;
                        return (
                          <div key={group.id} className={`admin-response-group ${isOpen ? 'admin-response-group--open' : ''}`}>
                            <button
                              type="button"
                              className="admin-response-group__header"
                              onClick={() => toggleGroup(group.id)}
                            >
                              <div className="admin-response-group__title">
                                <span>{group.label}</span>
                                {group.isRecent && <span className="admin-response-group__badge">Последние 14 дней</span>}
                              </div>
                              <span className="admin-response-group__count">{group.responses.length}</span>
                            </button>
                            {isOpen && (
                              <div className="admin-response-group__body">
                                {group.responses.map((response) => {
                                  const isEditing = editingResponseId === response.id;
                                  const isBusy = responseActionId === response.id;
                                  const adminResponseClass = [
                                    'admin-response-card',
                                    isEditing ? 'admin-response-card--editing' : '',
                                    response.isComplete ? '' : 'admin-response-card--incomplete',
                                  ]
                                    .filter(Boolean)
                                    .join(' ');
                                  return (
                                    <article
                                      key={response.id}
                                      className={adminResponseClass}
                                    >
                                      {isEditing ? (
                                        <SurveyInlineEditor
                                          survey={response}
                                          questions={ADMIN_QUESTION_CONFIG}
                                          isSaving={isBusy}
                                          onSubmit={(draft) => handleUpdateResponse(response.id, draft)}
                                          onClose={() => setEditingResponseId(null)}
                                        />
                                      ) : (
                                        <>
                                          <header className="admin-response-card__header">
                                            <div>
                                              <h3>{formatUserName(response)}</h3>
                                              <span className="admin-response-card__meta">
                                                {formatDateTime(response.createdAt)} · Оценка: {formatScore(response.projectRecommendation)}
                                              </span>
                                            </div>
                                            <div className="admin-response-card__actions">
                                              <button
                                                type="button"
                                                className="button button--ghost"
                                                onClick={() => setEditingResponseId(response.id)}
                                              >
                                                Редактировать
                                              </button>
                                              <button
                                                type="button"
                                                className="button button--danger"
                                                onClick={() => handleDeleteResponse(response.id)}
                                                disabled={isBusy}
                                              >
                                                Удалить
                                              </button>
                                            </div>
                                          </header>
                                          {!response.isComplete && (
                                            <div className="response-card__status" role="note">
                                              <span className="response-card__status-icon" aria-hidden="true">
                                                ⚠️
                                              </span>
                                              <span>Анкета заполнена не полностью — ответы не учитываются в статистике.</span>
                                            </div>
                                          )}
                                          <div className="admin-response-card__ratings">
                                            <RatingRow label="Проект" value={response.projectRecommendation} />
                                            <RatingRow label="Менеджер" value={response.managerEffectiveness} />
                                            <RatingRow label="Команда" value={response.teamComfort} />
                                            <RatingRow label="Процессы" value={response.processOrganization} />
                                          </div>
                                          <dl>
                                            {response.projectImprovement && (
                                              <div>
                                                <dt>Проект</dt>
                                                <dd>{response.projectImprovement}</dd>
                                              </div>
                                            )}
                                            {response.managerImprovement && (
                                              <div>
                                                <dt>Менеджер</dt>
                                                <dd>{response.managerImprovement}</dd>
                                              </div>
                                            )}
                                            {response.teamImprovement && (
                                              <div>
                                                <dt>Команда</dt>
                                                <dd>{response.teamImprovement}</dd>
                                              </div>
                                            )}
                                            {response.processObstacles && (
                                              <div>
                                                <dt>Процессы</dt>
                                                <dd>{response.processObstacles}</dd>
                                              </div>
                                            )}
                                            {response.improvementIdeas && (
                                              <div>
                                                <dt>Идеи</dt>
                                                <dd>{response.improvementIdeas}</dd>
                                              </div>
                                            )}
                                          </dl>
                                        </>
                                      )}
                                    </article>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="panel-body admin-no-selection">Выберите проект в списке слева, чтобы увидеть подробности.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
