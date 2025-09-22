import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  createProject,
  createSurveyRequest,
  fetchProjects,
  fetchSurveys,
  sanitizeAdminToken,
  updateSurveyRequest,
} from './api';
import type { ApiAuthContext } from './api';
import { ProjectSelector } from './components/ProjectSelector';
import { ResponsesList } from './components/ResponsesList';
import { SurveyStepper } from './components/SurveyStepper';
import AdminApp from './AdminApp';
import type { QuestionConfig, QuestionKey } from './components/SurveyStepper';
import type { ProjectSummary, SurveyAnswers, SurveyRecord, TelegramUser } from './types';

type AppMode = 'user' | 'admin';

function getInitialMode(): AppMode {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') ? 'admin' : 'user';
  } catch {
    return 'user';
  }
}

const METALAMP_COLORS = {
  accent: '#6C38FF',
  dark: '#321D73',
  background: '#130835',
};

const QUESTION_CONFIG: QuestionConfig[] = [
  {
    key: 'projectRecommendation',
    title: 'Насколько вероятно, что вы порекомендуете участие в проекте коллеге?',
    description: '0 — точно нет, 10 — однозначно да.',
    type: 'scale',
  },
  {
    key: 'projectImprovement',
    title: 'Что могло бы повысить вашу оценку проекта?',
    type: 'text',
    placeholder: 'Поделитесь идеями для улучшения проекта.',
  },
  {
    key: 'managerEffectiveness',
    title: 'Насколько эффективно менеджер помогает снимать блокеры?',
    description: '0 — никак не помогает, 10 — помогает всегда и быстро.',
    type: 'scale',
  },
  {
    key: 'managerImprovement',
    title: 'Что менеджер мог бы улучшить в следующем спринте?',
    type: 'text',
    placeholder: 'Напишите конкретные ожидания или пожелания.',
  },
  {
    key: 'teamComfort',
    title: 'Насколько комфортно вам взаимодействовать с командой?',
    type: 'scale',
  },
  {
    key: 'teamImprovement',
    title: 'Что можно улучшить в командной работе?',
    type: 'text',
    placeholder: 'Опишите, что поможет команде работать лучше.',
  },
  {
    key: 'processOrganization',
    title: 'Насколько хорошо организованы процессы (созвоны, таски, коммуникация)?',
    type: 'scale',
  },
  {
    key: 'processObstacles',
    title: 'Что мешало в этом спринте/неделе работать эффективнее?',
    type: 'text',
    placeholder: 'Опишите основные сложности.',
  },
  {
    key: 'contributionValued',
    title: 'Чувствуете ли вы, что ваш вклад в проект ценится?',
    type: 'options',
    options: [
      { label: 'Да', value: 'yes' },
      { label: 'Частично', value: 'partial' },
      { label: 'Нет', value: 'no' },
    ],
  },
  {
    key: 'improvementIdeas',
    title: 'Есть ли идеи для улучшения проекта или процессов?',
    type: 'text',
    placeholder: 'Предложите гипотезы или эксперименты.',
  },
];

function formatApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Неизвестная ошибка';

  if (message.includes('Missing Telegram init data header')) {
    return 'Откройте мини-приложение внутри Telegram — без init data запросы блокируются.';
  }

  if (message.includes('Missing debug user header')) {
    return 'В браузере нужно включить режим отладки (ALLOW_INSECURE_INIT_DATA=true).';
  }

  return message;
}

function findNextStep(survey: SurveyRecord): number {
  for (let index = 0; index < QUESTION_CONFIG.length; index += 1) {
    const question = QUESTION_CONFIG[index];
    const value = survey[question.key as QuestionKey];

    if (value === undefined || value === null) {
      return index;
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      return index;
    }
  }

  return QUESTION_CONFIG.length;
}

function useTelegramUser(): { auth: ApiAuthContext; user: TelegramUser | null; ready: boolean } {
  const [auth, setAuth] = useState<ApiAuthContext>({ initDataRaw: null, debugUser: null });
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      webApp.ready();
      webApp.expand?.();
      webApp.setHeaderColor?.(METALAMP_COLORS.dark);
      webApp.setBackgroundColor?.(METALAMP_COLORS.background);

      const initData = webApp.initData && webApp.initData.length > 0 ? webApp.initData : null;
      setAuth({ initDataRaw: initData, debugUser: null });
      setUser(webApp.initDataUnsafe?.user ?? null);
    } else {
      setAuth({ initDataRaw: null, debugUser: null });
      setUser(null);
    }

    setReady(true);
  }, []);

  return { auth, user, ready };
}

export default function App() {
  const { auth, user, ready } = useTelegramUser();
  const [projectSearch, setProjectSearch] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [currentSurvey, setCurrentSurvey] = useState<SurveyRecord | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [creatingSurvey, setCreatingSurvey] = useState(false);
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [editingSurveyId, setEditingSurveyId] = useState<number | null>(null);
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('adminToken') ?? '');
  const [mode, setMode] = useState<AppMode>(getInitialMode);

  useEffect(() => {
    if (adminToken) {
      sessionStorage.setItem('adminToken', adminToken);
    }
  }, [adminToken]);

  const isAuthProvided = useMemo(() => auth.initDataRaw !== null || auth.debugUser !== null, [auth]);

  const showError = useCallback((error: unknown) => {
    setBanner({ type: 'error', message: formatApiError(error) });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setBanner({ type: 'success', message });
  }, []);

  useEffect(() => {
    if (banner?.type === 'success') {
      const timeoutId = window.setTimeout(() => setBanner(null), 3000);
      return () => window.clearTimeout(timeoutId);
    }
  }, [banner]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const ensureAdminToken = useCallback(() => {
    let token = adminToken.trim();
    if (!token) {
      const input = window.prompt('Введите токен администратора', adminToken) ?? '';
      token = input.trim();
      if (!token) {
        return '';
      }
      setAdminToken(token);
    }

    try {
      const sanitized = sanitizeAdminToken(token);
      if (sanitized !== adminToken) {
        setAdminToken(sanitized);
      }
      return sanitized;
    } catch (error) {
      showError(error);
      return '';
    }
  }, [adminToken, showError]);

  const switchToUser = useCallback(() => {
    setMode('user');
    setEditingSurveyId(null);
    setCurrentSurvey(null);
    setActiveStep(0);
    setBanner(null);
  }, []);

  const switchToAdmin = useCallback(() => {
    const token = ensureAdminToken();
    if (!token) {
      return;
    }

    setMode('admin');
    setBanner(null);
  }, [ensureAdminToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (mode === 'admin') {
      params.set('admin', '1');
    } else {
      params.delete('admin');
    }

    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'admin') {
      return;
    }

    if (!ensureAdminToken()) {
      setMode('user');
    }
  }, [ensureAdminToken, mode]);

  const refreshProjects = useCallback(
    async (searchTerm?: string) => {
      if (!isAuthProvided || mode !== 'user') {
        return;
      }

      setProjectsLoading(true);
      setProjectsError(null);

      const normalized = searchTerm && searchTerm.trim().length ? searchTerm.trim() : undefined;

      try {
        const response = await fetchProjects(auth, normalized);
        setProjects((prev) => {
          const sameSize = prev.length === response.projects.length;
          const sameIds = sameSize && prev.every((project, index) => project.id === response.projects[index]?.id);
          return sameIds ? prev : response.projects;
        });

        setSelectedProjectId((currentId) => {
          if (!response.projects.length) {
            return null;
          }

          return currentId && response.projects.some((project) => project.id === currentId)
            ? currentId
            : response.projects[0].id;
        });
      } catch (error) {
        setProjectsError(formatApiError(error));
      } finally {
        setProjectsLoading(false);
      }
    },
    [auth, isAuthProvided, mode],
  );

  const refreshSurveys = useCallback(
    async (projectId: number) => {
      if (!isAuthProvided || mode !== 'user') {
        return;
      }

      setSurveysLoading(true);
      setBanner(null);

      try {
        const response = await fetchSurveys(auth, projectId);
        setSurveys((prev) => {
          if (prev.length === response.surveys.length) {
            const same = prev.every((survey, index) => survey.id === response.surveys[index]?.id);
            if (same) {
              return prev.map((survey, index) => {
                const updated = response.surveys[index];
                return survey.updatedAt === updated.updatedAt ? survey : updated;
              });
            }
          }
          return response.surveys;
        });
        setCurrentSurvey((previous) =>
          previous ? response.surveys.find((survey) => survey.id === previous.id) ?? previous : null,
        );
      } catch (error) {
        showError(error);
      } finally {
        setSurveysLoading(false);
      }
    },
    [auth, isAuthProvided, mode, showError],
  );

  useEffect(() => {
    if (!ready || !isAuthProvided || mode !== 'user') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshProjects(projectSearch);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ready, isAuthProvided, mode, projectSearch, refreshProjects]);

  useEffect(() => {
    if (!ready || !isAuthProvided || mode !== 'user') {
      return;
    }

    if (!selectedProjectId) {
      setSurveys([]);
      setCurrentSurvey(null);
      setActiveStep(0);
      setEditingSurveyId(null);
      return;
    }

    void refreshSurveys(selectedProjectId);
  }, [ready, isAuthProvided, mode, selectedProjectId, refreshSurveys]);

  useEffect(() => {
    if (!isAuthProvided || !selectedProjectId || mode !== 'user') {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshProjects(projectSearch);
      void refreshSurveys(selectedProjectId);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [isAuthProvided, mode, projectSearch, refreshProjects, refreshSurveys, selectedProjectId]);

  useEffect(() => {
    if (!currentSurvey) {
      return;
    }

    setActiveStep(findNextStep(currentSurvey));
  }, [currentSurvey]);

  const submitSurveyDraft = useCallback(
    async (surveyId: number, updates: SurveyAnswers, options?: { notify?: boolean }) => {
      if (mode !== 'user') {
        return;
      }

      if (!Object.keys(updates).length) {
        if (options?.notify) {
          showSuccess('Изменений не обнаружено');
        }
        return;
      }

      setSavingAnswer(true);
      setBanner(null);

      try {
        const response = await updateSurveyRequest(auth, surveyId, updates);

        setSurveys((prev) => prev.map((survey) => (survey.id === response.survey.id ? response.survey : survey)));
        setCurrentSurvey((prev) => (prev && prev.id === response.survey.id ? response.survey : prev));

        await refreshProjects(projectSearch);
        await refreshSurveys(response.survey.projectId);

        if (options?.notify) {
          showSuccess('Изменения сохранены');
        }
      } catch (error) {
        showError(error);
        throw error;
      } finally {
        setSavingAnswer(false);
      }
    },
    [auth, mode, projectSearch, refreshProjects, refreshSurveys, showError, showSuccess],
  );

  const handleSurveyAnswer = useCallback(
    async (key: QuestionKey, value: number | string) => {
      if (!currentSurvey) {
        throw new Error('Анкета не найдена');
      }

      const normalizedValue = typeof value === 'string' ? value.trim() : value;
      await submitSurveyDraft(currentSurvey.id, { [key]: normalizedValue });
    },
    [currentSurvey, submitSurveyDraft],
  );

  const handleInlineSubmit = useCallback(
    async (surveyId: number, updates: SurveyAnswers) => {
      await submitSurveyDraft(surveyId, updates, { notify: true });
      setEditingSurveyId(null);
    },
    [submitSurveyDraft],
  );

  const handleAddProject = useCallback(
    async (name: string) => {
      await createProject(auth, name);
      await refreshProjects(projectSearch);
    },
    [auth, projectSearch, refreshProjects],
  );

  const handleCreateSurvey = useCallback(async () => {
    if (!selectedProjectId) {
      return;
    }

    setCreatingSurvey(true);
    setBanner(null);

    try {
      const response = await createSurveyRequest(auth, { projectId: selectedProjectId });
      setCurrentSurvey(response.record);
      setEditingSurveyId(null);
      setActiveStep(findNextStep(response.record));
      await refreshSurveys(selectedProjectId);
      await refreshProjects(projectSearch);
    } catch (error) {
      showError(error);
    } finally {
      setCreatingSurvey(false);
    }
  }, [auth, projectSearch, refreshProjects, refreshSurveys, selectedProjectId, showError]);

  const handleEditSurvey = useCallback((survey: SurveyRecord) => {
    setCurrentSurvey(null);
    setActiveStep(0);
    setEditingSurveyId(survey.id);
    setBanner(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingSurveyId(null);
  }, []);

  const handleCloseSurvey = useCallback(() => {
    setCurrentSurvey(null);
    setActiveStep(0);
    setEditingSurveyId(null);
  }, []);

  const bannerMarkup =
    banner && (
      <div className={`banner ${banner.type === 'error' ? 'banner--error' : 'banner--success'}`}>{banner.message}</div>
    );

  const renderHeader = (activeMode: AppMode) => (
    <header className="app-header">
      <div>
        <h1 className="app-title">Метрика атмосферы</h1>
        <p className="app-subtitle">
          Сбор внутреннего NPS помогает проектному офису понимать настроение команды в каждом спринте.
        </p>
      </div>
      <div className="header-actions">
        <div className="role-toggle">
          <button
            type="button"
            className={`role-toggle__button ${activeMode === 'user' ? 'role-toggle__button--active' : ''}`}
            onClick={switchToUser}
            disabled={activeMode === 'user'}
          >
            Пользователь
          </button>
          <button
            type="button"
            className={`role-toggle__button ${activeMode === 'admin' ? 'role-toggle__button--active' : ''}`}
            onClick={switchToAdmin}
            disabled={activeMode === 'admin'}
          >
            Администратор
          </button>
        </div>
        {user && (
          <div className="user-card">
            <span className="user-card__hello">Привет, {user.first_name}!</span>
            <span className="user-card__hint">Ответы видны только вам и проектному офису Металампа.</span>
          </div>
        )}
      </div>
    </header>
  );

  if (mode === 'admin') {
    return (
      <div className="app">
        <div className="app-gradient" />
        <div className="app-container">
          {renderHeader('admin')}
          {bannerMarkup}
          <AdminApp
            embedded
            initialToken={adminToken || undefined}
            onTokenChange={(value) => setAdminToken(value ?? '')}
            onBackToUser={switchToUser}
          />
        </div>
      </div>
    );
  }

  if (ready && !isAuthProvided) {
    return (
      <div className="app">
        <div className="app-gradient" />
        <div className="app-container">
          {renderHeader('user')}
          {bannerMarkup}
          <section className="panel">
            <header className="panel-header">
              <div>
                <h2>Откройте приложение в Telegram</h2>
                <p className="panel-subtitle">
                  Для заполнения анкет необходимо запускать мини-приложение через Telegram Web App или переключиться в режим администратора.
                </p>
              </div>
            </header>
            <div className="panel-body">
              <p className="hint">
                Если вы хотите посмотреть данные как администратор, переключитесь в режим «Администратор» и введите токен.
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-gradient" />
      <div className="app-container">
        {renderHeader('user')}
        {bannerMarkup}
        <main className="app-grid">
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            search={projectSearch}
            onSearchChange={setProjectSearch}
            onSelect={(project) => setSelectedProjectId(project.id)}
            onAddProject={handleAddProject}
            isLoading={projectsLoading}
            error={projectsError}
          />
          <div className="content-column">
            {!selectedProject && (
              <section className="panel">
                <header className="panel-header">
                  <div>
                    <h2>Выберите проект</h2>
                    <p className="panel-subtitle">Для начала заполнения анкеты выберите проект слева.</p>
                  </div>
                </header>
              </section>
            )}
            {selectedProject && !currentSurvey && (
              <section className="panel">
                <header className="panel-header">
                  <div>
                    <h2>{selectedProject.name}</h2>
                    <p className="panel-subtitle">
                      Ответьте на 10 вопросов, чтобы мы понимали климат команды и могли реагировать на изменения.
                    </p>
                  </div>
                </header>
                <div className="panel-body">
                  <p className="hint">
                    Анкета занимает 3–4 минуты. После каждого ответа данные сразу сохраняются в базе Металампа.
                  </p>
                  <button type="button" className="button" onClick={handleCreateSurvey} disabled={creatingSurvey}>
                    {creatingSurvey ? 'Создаем анкету…' : 'Заполнить анкету'}
                  </button>
                </div>
              </section>
            )}
            {currentSurvey && selectedProject && (
              <SurveyStepper
                survey={currentSurvey}
                questions={QUESTION_CONFIG}
                answers={currentSurvey}
                activeStep={activeStep}
                onStepChange={setActiveStep}
                onSubmitAnswer={handleSurveyAnswer}
                isSaving={savingAnswer}
                onExit={handleCloseSurvey}
              />
            )}
            {selectedProject && (
              <ResponsesList
                surveys={surveys}
                questions={QUESTION_CONFIG}
                onEdit={handleEditSurvey}
                isLoading={surveysLoading}
                editingSurveyId={editingSurveyId}
                onCancelEdit={handleCancelEdit}
                onSubmitDraft={handleInlineSubmit}
                isSaving={savingAnswer}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
