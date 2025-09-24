import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import './App.css';
import { createSurveyRequest, fetchProjects, fetchSurveys, updateSurveyRequest } from './api';
import type { ApiAuthContext } from './api';
import { ProjectSelector } from './components/ProjectSelector';
import { ResponsesList } from './components/ResponsesList';
import { SurveyStepper, type QuestionConfig, type QuestionKey } from './components/SurveyStepper';
import type { ProjectSummary, SurveyAnswers, SurveyRecord, TelegramUser } from './types';

type ThemeMode = 'light' | 'dark';

type AppView = 'dashboard' | 'history';

const TELEGRAM_THEME_COLORS: Record<ThemeMode, { background: string; header: string }> = {
  dark: { background: '#080F2B', header: '#101940' },
  light: { background: '#F6F7FB', header: '#FFFFFF' },
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

function useMetalampTheme(): ThemeMode {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

    const resolveTheme = (): ThemeMode => {
      if (webApp?.colorScheme === 'dark' || webApp?.colorScheme === 'light') {
        return webApp.colorScheme;
      }

      return mediaQuery?.matches ? 'dark' : 'light';
    };

    const applyTheme = (mode: ThemeMode) => {
      setTheme(mode);
      if (typeof document !== 'undefined') {
        document.body.dataset.theme = mode;
        document.documentElement.style.setProperty('color-scheme', mode);
      }
    };

    applyTheme(resolveTheme());

    const handleTelegramTheme = () => {
      applyTheme(resolveTheme());
    };

    const handleSystemTheme = (event: MediaQueryListEvent) => {
      if (webApp?.colorScheme === 'dark' || webApp?.colorScheme === 'light') {
        return;
      }

      applyTheme(event.matches ? 'dark' : 'light');
    };

    if (webApp?.onEvent) {
      webApp.onEvent('themeChanged', handleTelegramTheme);
    }

    if (mediaQuery) {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemTheme);
      } else {
        mediaQuery.addListener(handleSystemTheme);
      }
    }

    return () => {
      if (webApp?.offEvent) {
        webApp.offEvent('themeChanged', handleTelegramTheme);
      }

      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleSystemTheme);
        } else {
          mediaQuery.removeListener(handleSystemTheme);
        }
      }
    };
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) {
      return;
    }

    const palette = TELEGRAM_THEME_COLORS[theme];
    webApp.setBackgroundColor?.(palette.background);
    webApp.setHeaderColor?.(palette.header);
  }, [theme]);

  return theme;
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

function normalizeAnswersFromSurvey(survey: SurveyRecord): SurveyAnswers {
  return QUESTION_CONFIG.reduce<SurveyAnswers>((acc, question) => {
    const value = survey[question.key];
    if (value !== undefined && value !== null) {
      acc[question.key] = value as never;
    }
    return acc;
  }, {} as SurveyAnswers);
}

export default function App(): JSX.Element {
  useMetalampTheme();

  const { auth, user, ready } = useTelegramUser();

  const [projectSearch, setProjectSearch] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [surveysError, setSurveysError] = useState<string | null>(null);

  const [view, setView] = useState<AppView>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);

  const [currentSurvey, setCurrentSurvey] = useState<SurveyRecord | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<SurveyAnswers>({});
  const [activeStep, setActiveStep] = useState(0);
  const [surveyStarted, setSurveyStarted] = useState(false);
  const [surveySubmitted, setSurveySubmitted] = useState(false);

  const surveyStateRef = useRef({
    started: false,
    submitted: false,
    currentId: null as number | null,
  });

  useEffect(() => {
    surveyStateRef.current = {
      started: surveyStarted,
      submitted: surveySubmitted,
      currentId: currentSurvey?.id ?? null,
    };
  }, [surveyStarted, surveySubmitted, currentSurvey]);

  const [creatingSurvey, setCreatingSurvey] = useState(false);
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [editingSurveyId, setEditingSurveyId] = useState<number | null>(null);

  const isAuthProvided = useMemo(() => auth.initDataRaw !== null || auth.debugUser !== null, [auth]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

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

    return undefined;
  }, [banner]);

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

        setSelectedProjectId((current) => {
          if (current && response.projects.some((project) => project.id === current)) {
            return current;
          }

          return response.projects[0]?.id ?? null;
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

      const { started, submitted, currentId } = surveyStateRef.current;
      if (started && !submitted && currentId !== null && currentSurvey?.projectId === projectId) {
        return;
      }

      setSurveysLoading(true);
      setSurveysError(null);

      try {
        const response = await fetchSurveys(auth, projectId);
        setSurveys(response.surveys);
      } catch (error) {
        setSurveysError(formatApiError(error));
      } finally {
        setSurveysLoading(false);
      }
    },
    [auth, currentSurvey, isAuthProvided],
  );

  useEffect(() => {
    if (!ready || !isAuthProvided) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshProjects(projectSearch);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [isAuthProvided, projectSearch, ready, refreshProjects]);

  useEffect(() => {
    if (!selectedProjectId || !isAuthProvided) {
      setSurveys([]);
      return;
    }

    void refreshSurveys(selectedProjectId);
  }, [isAuthProvided, refreshSurveys, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !isAuthProvided) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshSurveys(selectedProjectId);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [isAuthProvided, refreshSurveys, selectedProjectId]);

  useEffect(() => {
    if (view === 'history' && selectedProjectId) {
      void refreshSurveys(selectedProjectId);
    }
  }, [refreshSurveys, selectedProjectId, view]);

  const handleProjectSelect = useCallback((project: ProjectSummary) => {
    setSelectedProjectId(project.id);
    setCurrentSurvey(null);
    setDraftAnswers({});
    setActiveStep(0);
    setSurveyStarted(false);
    setSurveySubmitted(false);
    setEditingSurveyId(null);
    setBanner(null);
  }, []);

  const handleToggleMenu = useCallback(() => {
    setMenuOpen((value) => !value);
  }, []);

  const handleStartSurvey = useCallback(async () => {
    if (!selectedProject) {
      return;
    }

    setCreatingSurvey(true);
    setBanner(null);

    try {
      const response = await createSurveyRequest(auth, { projectId: selectedProject.id });
      setCurrentSurvey(response.record);
      setDraftAnswers(normalizeAnswersFromSurvey(response.record));
      setActiveStep(0);
      setSurveyStarted(true);
      setSurveySubmitted(false);
      setEditingSurveyId(null);
      surveyStateRef.current = {
        started: true,
        submitted: false,
        currentId: response.record.id,
      };
    } catch (error) {
      showError(error);
    } finally {
      setCreatingSurvey(false);
    }
  }, [auth, selectedProject, showError]);

  const handleAnswer = useCallback((key: QuestionKey, value: number | string) => {
    const normalized = typeof value === 'string' ? value.trim() : value;
    setDraftAnswers((prev) => ({ ...prev, [key]: normalized as never }));
  }, []);

  const mandatoryKeys = useMemo(
    () => QUESTION_CONFIG.filter((question) => question.type !== 'text').map((question) => question.key),
    [],
  );

  const handleCompleteSurvey = useCallback(async () => {
    if (!currentSurvey) {
      return;
    }

    const payload: SurveyAnswers = {};
    QUESTION_CONFIG.forEach((question) => {
      const value = draftAnswers[question.key];
      if (value !== undefined && value !== null && !(typeof value === 'string' && value.trim().length === 0)) {
        payload[question.key] = value as never;
      }
    });

    const missingMandatory = mandatoryKeys.filter((key) => payload[key] === undefined);
    if (missingMandatory.length > 0) {
      setBanner({ type: 'error', message: 'Ответьте на все обязательные вопросы перед отправкой.' });
      return;
    }

    setSavingSurvey(true);
    setBanner(null);

    try {
      const response = await updateSurveyRequest(auth, currentSurvey.id, payload);
      setSurveySubmitted(true);
      surveyStateRef.current.submitted = true;
      surveyStateRef.current.currentId = response.survey.id;
      setCurrentSurvey(response.survey);
      setDraftAnswers(normalizeAnswersFromSurvey(response.survey));

      await refreshProjects(projectSearch);
      await refreshSurveys(response.survey.projectId);

      showSuccess('Спасибо! Анкета сохранена.');
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setSavingSurvey(false);
    }
  }, [
    auth,
    currentSurvey,
    draftAnswers,
    mandatoryKeys,
    projectSearch,
    refreshProjects,
    refreshSurveys,
    showError,
    showSuccess,
  ]);

  const handleExitSurvey = useCallback(() => {
    setCurrentSurvey(null);
    setDraftAnswers({});
    setActiveStep(0);
    setSurveyStarted(false);
    setSurveySubmitted(false);
    setEditingSurveyId(null);
    setMenuOpen(false);
    setView('history');
    surveyStateRef.current = { started: false, submitted: false, currentId: null };
  }, []);

  const submitSurveyDraft = useCallback(
    async (surveyId: number, updates: SurveyAnswers, options?: { notify?: boolean }) => {
      if (!Object.keys(updates).length) {
        if (options?.notify) {
          showSuccess('Изменений не обнаружено');
        }
        return;
      }

      setSavingSurvey(true);
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
        setSavingSurvey(false);
      }
    },
    [auth, projectSearch, refreshProjects, refreshSurveys, showError, showSuccess],
  );

  const handleInlineSubmit = useCallback(
    async (surveyId: number, updates: SurveyAnswers) => {
      await submitSurveyDraft(surveyId, updates, { notify: true });
      setEditingSurveyId(null);
    },
    [submitSurveyDraft],
  );

  const handleEditSurvey = useCallback((survey: SurveyRecord) => {
    setEditingSurveyId(survey.id);
    setBanner(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingSurveyId(null);
  }, []);

  const openDashboard = useCallback(() => {
    setView('dashboard');
    setMenuOpen(false);
  }, []);

  const openHistory = useCallback(() => {
    setView('history');
    setMenuOpen(false);
    if (selectedProjectId) {
      void refreshSurveys(selectedProjectId);
    }
  }, [refreshSurveys, selectedProjectId]);

  const goToAdmin = useCallback(() => {
    window.location.href = '/admin';
  }, []);

  const focusMode = surveyStarted && currentSurvey;

  const renderDashboard = () => {
    if (!selectedProject) {
      return (
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Выберите проект</h2>
              <p className="panel-subtitle">Выберите проект, чтобы начать новую анкету.</p>
            </div>
          </header>
        </section>
      );
    }

    if (!surveyStarted || !currentSurvey) {
      return (
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>{selectedProject.name}</h2>
              <p className="panel-subtitle">
                Ответьте на 10 вопросов, чтобы помочь проектному офису отслеживать настроение команды.
              </p>
            </div>
          </header>
          <div className="panel-body">
            <p className="hint">
              Анкета займёт около 4 минут. Ответы сохранятся только после завершения анкеты.
            </p>
            <button type="button" className="button" onClick={handleStartSurvey} disabled={creatingSurvey}>
              {creatingSurvey ? 'Готовим анкету…' : 'Начать тест'}
            </button>
          </div>
        </section>
      );
    }

    return (
      <SurveyStepper
        survey={currentSurvey}
        questions={QUESTION_CONFIG}
        answers={draftAnswers}
        activeStep={activeStep}
        onStepChange={setActiveStep}
        onAnswer={handleAnswer}
        onFinish={handleCompleteSurvey}
        isSubmitting={savingSurvey}
        isSubmitted={surveySubmitted}
        onExit={handleExitSurvey}
      />
    );
  };

  const renderHistory = () => (
    <>
      <section className="panel history-header">
        <div>
          <h2>Мои ответы</h2>
          <p className="panel-subtitle">История заполненных анкет по выбранному проекту.</p>
        </div>
        <button type="button" className="button button--ghost" onClick={openDashboard}>
          ← Вернуться к проектам
        </button>
      </section>
      <ResponsesList
        surveys={surveys}
        questions={QUESTION_CONFIG}
        isLoading={surveysLoading}
        onEdit={handleEditSurvey}
        editingSurveyId={editingSurveyId}
        onCancelEdit={handleCancelEdit}
        onSubmitDraft={handleInlineSubmit}
        isSaving={savingSurvey}
        projectName={selectedProject?.name}
      />
    </>
  );

  if (ready && !isAuthProvided) {
    return (
      <div className="app">
        <div className="app-gradient" />
        <div className="app-container">
          <header className="app-header">
            <div>
              <h1 className="app-title">Метрика атмосферы</h1>
              <p className="app-subtitle">
                Откройте мини-приложение внутри Telegram, чтобы заполнить анкету или посмотреть историю ответов.
              </p>
            </div>
          </header>
        </div>
      </div>
    );
  }

  if (focusMode && currentSurvey) {
    return (
      <div className="app app--survey-active">
        <div className="app-gradient" />
        <div className="app-container app-container--narrow">
          <header className="survey-focus-header">
            <button type="button" className="survey-focus-header__back" onClick={handleExitSurvey}>
              ← К проектам
            </button>
            <div className="survey-focus-header__title">
              <h1>{currentSurvey.projectName}</h1>
              <p>Заполните все вопросы, чтобы сохранить результат.</p>
            </div>
          </header>
          {banner && (
            <div className={`banner ${banner.type === 'error' ? 'banner--error' : 'banner--success'}`}>
              {banner.message}
            </div>
          )}
          <SurveyStepper
            survey={currentSurvey}
            questions={QUESTION_CONFIG}
            answers={draftAnswers}
            activeStep={activeStep}
            onStepChange={setActiveStep}
            onAnswer={handleAnswer}
            onFinish={handleCompleteSurvey}
            isSubmitting={savingSurvey}
            isSubmitted={surveySubmitted}
            onExit={handleExitSurvey}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-gradient" />
      <div className="app-container">
        <header className="app-header">
          <button type="button" className="burger-button" onClick={handleToggleMenu} aria-label="Открыть меню">
            <span />
            <span />
            <span />
          </button>
          <div className="app-header__titles">
            <h1 className="app-title">Метрика атмосферы</h1>
            <p className="app-subtitle">
              Следите за настроением команды, отвечайте честно и помогайте проектному офису принимать решения.
            </p>
          </div>
          {user && (
            <div className="user-card">
              <span className="user-card__hello">Привет, {user.first_name}!</span>
              <span className="user-card__hint">Ваши ответы видны только вам и проектному офису.</span>
            </div>
          )}
        </header>

        {banner && (
          <div className={`banner ${banner.type === 'error' ? 'banner--error' : 'banner--success'}`}>{banner.message}</div>
        )}

        {projectsError && <div className="banner banner--error">{projectsError}</div>}
        {surveysError && view === 'history' && <div className="banner banner--error">{surveysError}</div>}

        <main className="app-grid">
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            search={projectSearch}
            onSearchChange={setProjectSearch}
            onSelect={handleProjectSelect}
            isLoading={projectsLoading}
            error={projectsError}
          />
          <div className="content-column">
            {view === 'dashboard' ? renderDashboard() : renderHistory()}
          </div>
        </main>
      </div>

      {menuOpen && (
        <div className="menu-overlay" onClick={handleToggleMenu}>
          <nav className="menu-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="menu-panel__close" onClick={handleToggleMenu} aria-label="Закрыть меню">
              X
            </button>
            <ul className="menu-panel__list">
              <li>
                <button type="button" onClick={openDashboard} className={view === 'dashboard' ? 'menu-panel__item menu-panel__item--active' : 'menu-panel__item'}>
                  Главная
                </button>
              </li>
              <li>
                <button type="button" onClick={openHistory} className={view === 'history' ? 'menu-panel__item menu-panel__item--active' : 'menu-panel__item'}>
                  История ответов
                </button>
              </li>
              <li>
                <button type="button" onClick={goToAdmin} className="menu-panel__item">
                  Админка
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
