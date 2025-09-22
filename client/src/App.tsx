import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { createProject, createSurveyRequest, fetchProjects, fetchSurveys, updateSurveyRequest } from './api';
import type { ApiAuthContext } from './api';
import { ProjectSelector } from './components/ProjectSelector';
import { ResponsesList } from './components/ResponsesList';
import { SurveyStepper } from './components/SurveyStepper';
import type { QuestionConfig, QuestionKey } from './components/SurveyStepper';
import type { ProjectSummary, SurveyAnswers, SurveyRecord, TelegramUser } from './types';

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

function createFallbackUser(): TelegramUser {
  return {
    id: 1,
    first_name: 'Metallamp',
    last_name: 'Team',
    username: 'metallamp',
  };
}

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

function buildAdminUrl(token: string): string {
  const url = new URL(window.location.href);
  url.pathname = '/admin';
  url.search = '';
  if (token) {
    url.searchParams.set('token', token);
  }
  return url.toString();
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
      const fallback = createFallbackUser();
      setAuth({ initDataRaw: null, debugUser: fallback });
      setUser(fallback);
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
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [editingSurveyId, setEditingSurveyId] = useState<number | null>(null);
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('adminToken') ?? '');

  useEffect(() => {
    if (adminToken) {
      sessionStorage.setItem('adminToken', adminToken);
    }
  }, [adminToken]);

  const isAuthProvided = useMemo(() => auth.initDataRaw !== null || auth.debugUser !== null, [auth]);

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

    return token;
  }, [adminToken]);

  const handleOpenAdmin = useCallback(() => {
    const token = ensureAdminToken();
    if (!token) {
      return;
    }

    const targetUrl = buildAdminUrl(token);
    const openLink = window.Telegram?.WebApp?.openLink;
    if (openLink) {
      openLink(targetUrl, { try_instant_view: false });
      return;
    }

    window.location.href = targetUrl;
  }, [ensureAdminToken]);

  const refreshProjects = useCallback(
    async (searchTerm?: string) => {
      if (!isAuthProvided) {
        return;
      }

      setProjectsLoading(true);
      setProjectsError(null);

      const normalized = searchTerm && searchTerm.trim().length ? searchTerm.trim() : undefined;

      try {
        const response = await fetchProjects(auth, normalized);
        setProjects(response.projects);
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
    [auth, isAuthProvided],
  );

  const refreshSurveys = useCallback(
    async (projectId: number) => {
      if (!isAuthProvided) {
        return;
      }

      setSurveysLoading(true);
      setBannerError(null);

      try {
        const response = await fetchSurveys(auth, projectId);
        setSurveys(response.surveys);
        setCurrentSurvey((previous) =>
          previous ? response.surveys.find((survey) => survey.id === previous.id) ?? previous : null,
        );
      } catch (error) {
        setBannerError(formatApiError(error));
      } finally {
        setSurveysLoading(false);
      }
    },
    [auth, isAuthProvided],
  );

  useEffect(() => {
    if (!ready || !isAuthProvided) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshProjects(projectSearch);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ready, isAuthProvided, projectSearch, refreshProjects]);

  useEffect(() => {
    if (!ready || !isAuthProvided) {
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
  }, [ready, isAuthProvided, selectedProjectId, refreshSurveys]);

  useEffect(() => {
    if (!isAuthProvided || !selectedProjectId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshProjects(projectSearch);
      void refreshSurveys(selectedProjectId);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [isAuthProvided, projectSearch, refreshProjects, refreshSurveys, selectedProjectId]);

  useEffect(() => {
    if (!currentSurvey) {
      return;
    }

    setActiveStep(findNextStep(currentSurvey));
  }, [currentSurvey]);

  const submitSurveyAnswer = useCallback(
    async (surveyId: number, key: QuestionKey, value: number | string) => {
      setSavingAnswer(true);
      setBannerError(null);

      try {
        const normalizedValue = typeof value === 'string' ? value.trim() : value;
        const payload = { [key]: normalizedValue } as SurveyAnswers;
        const response = await updateSurveyRequest(auth, surveyId, payload);

        setSurveys((prev) => prev.map((survey) => (survey.id === response.survey.id ? response.survey : survey)));
        setCurrentSurvey((prev) => (prev && prev.id === response.survey.id ? response.survey : prev));

        await refreshProjects(projectSearch);
        await refreshSurveys(response.survey.projectId);
      } catch (error) {
        setBannerError(formatApiError(error));
        throw error;
      } finally {
        setSavingAnswer(false);
      }
    },
    [auth, projectSearch, refreshProjects, refreshSurveys],
  );

  const handleSurveyAnswer = useCallback(
    async (key: QuestionKey, value: number | string) => {
      if (!currentSurvey) {
        throw new Error('Анкета не найдена');
      }

      await submitSurveyAnswer(currentSurvey.id, key, value);
    },
    [currentSurvey, submitSurveyAnswer],
  );

  const handleInlineSubmit = useCallback(
    (surveyId: number, key: QuestionKey, value: number | string) => submitSurveyAnswer(surveyId, key, value),
    [submitSurveyAnswer],
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
    setBannerError(null);

    try {
      const response = await createSurveyRequest(auth, { projectId: selectedProjectId });
      setCurrentSurvey(response.record);
      setEditingSurveyId(null);
      setActiveStep(findNextStep(response.record));
      await refreshSurveys(selectedProjectId);
      await refreshProjects(projectSearch);
    } catch (error) {
      setBannerError(formatApiError(error));
    } finally {
      setCreatingSurvey(false);
    }
  }, [auth, projectSearch, refreshProjects, refreshSurveys, selectedProjectId]);

  const handleEditSurvey = useCallback((survey: SurveyRecord) => {
    setCurrentSurvey(null);
    setActiveStep(0);
    setEditingSurveyId(survey.id);
    setBannerError(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingSurveyId(null);
  }, []);

  const handleCloseSurvey = useCallback(() => {
    setCurrentSurvey(null);
    setActiveStep(0);
    setEditingSurveyId(null);
  }, []);

  return (
    <div className="app">
      <div className="app-gradient" />
      <div className="app-container">
        <header className="app-header">
          <div>
            <h1 className="app-title">Метрика атмосферы</h1>
            <p className="app-subtitle">
              Сбор внутреннего NPS помогает проектному офису понимать настроение команды в каждом спринте.
            </p>
          </div>
          <div className="header-actions">
            <div className="role-toggle">
              <button type="button" className="role-toggle__button role-toggle__button--active">
                Пользователь
              </button>
              <button type="button" className="role-toggle__button" onClick={handleOpenAdmin}>
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
        {bannerError && <div className="banner banner--error">{bannerError}</div>}
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
                onSubmitField={handleInlineSubmit}
                isSaving={savingAnswer}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
