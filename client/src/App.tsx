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
type ThemePreference = 'system' | ThemeMode;

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

function useMetalampTheme(): {
  theme: ThemeMode;
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
} {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') {
      return 'system';
    }

    const stored = window.localStorage?.getItem('themePreference');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }

    return 'system';
  });

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

    if (preference === 'light' || preference === 'dark') {
      setTheme(preference);
      return undefined;
    }

    const resolveTheme = (): ThemeMode => {
      if (webApp?.colorScheme === 'dark' || webApp?.colorScheme === 'light') {
        return webApp.colorScheme;
      }

      return mediaQuery?.matches ? 'dark' : 'light';
    };

    setTheme(resolveTheme());

    const handleTelegramTheme = () => {
      setTheme(resolveTheme());
    };

    const handleSystemTheme = (event: MediaQueryListEvent) => {
      if (webApp?.colorScheme === 'dark' || webApp?.colorScheme === 'light') {
        return;
      }

      setTheme(event.matches ? 'dark' : 'light');
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
  }, [preference]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.theme = theme;
      document.documentElement.style.setProperty('color-scheme', theme);
    }

    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      const palette = TELEGRAM_THEME_COLORS[theme];
      webApp.setBackgroundColor?.(palette.background);
      webApp.setHeaderColor?.(palette.header);
    }
  }, [theme]);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem('themePreference', value);
    }

    if (value === 'light' || value === 'dark') {
      setTheme(value);
    }
  }, []);

  return { theme, preference, setPreference };
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
  const { theme, preference, setPreference } = useMetalampTheme();

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
  const [pendingStartFocus, setPendingStartFocus] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  const surveyStateRef = useRef({
    started: false,
    submitted: false,
    currentId: null as number | null,
  });
  const startButtonRef = useRef<HTMLButtonElement | null>(null);
  const themeButtonRef = useRef<HTMLButtonElement | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

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
    setPendingStartFocus(true);
    setView('dashboard');
    setMenuOpen(false);
  }, []);

  const handleToggleMenu = useCallback(() => {
    setMenuOpen((value) => !value);
  }, []);

  const toggleThemeMenu = useCallback(() => {
    setThemeMenuOpen((open) => !open);
  }, []);

  const closeThemeMenu = useCallback(() => {
    setThemeMenuOpen(false);
  }, []);

  const selectThemePreference = useCallback(
    (value: ThemePreference) => {
      setPreference(value);
      closeThemeMenu();
      themeButtonRef.current?.focus({ preventScroll: true });
    },
    [closeThemeMenu, setPreference],
  );

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
  }, [auth, currentSurvey, draftAnswers, mandatoryKeys, projectSearch, refreshProjects, refreshSurveys, showError]);

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

  useEffect(() => {
    if (!pendingStartFocus || surveyStarted || currentSurvey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const target = startButtonRef.current;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
      }
      setPendingStartFocus(false);
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [currentSurvey, pendingStartFocus, surveyStarted]);

  useEffect(() => {
    if (!themeMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (themeButtonRef.current?.contains(target) || themeMenuRef.current?.contains(target)) {
        return;
      }

      setThemeMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [themeMenuOpen]);

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
    [auth, projectSearch, refreshProjects, refreshSurveys, showError],
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

  const themeLabel = useMemo(() => {
    if (preference === 'system') {
      return theme === 'dark' ? 'Как в системе · Тёмная' : 'Как в системе · Светлая';
    }

    return preference === 'dark' ? 'Тёмная' : 'Светлая';
  }, [preference, theme]);

  const renderDashboard = () => {
    if (!selectedProject) {
      return (
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Выберите проект</h2>
              <p className="panel-subtitle">Выберите проект слева, чтобы начать новую анкету.</p>
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
            <button
              type="button"
              className="button"
              onClick={handleStartSurvey}
              disabled={creatingSurvey}
              ref={startButtonRef}
            >
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
            <div className="app-header__actions">
              <div className={`theme-toggle${themeMenuOpen ? ' theme-toggle--open' : ''}`}>
                <button
                  type="button"
                  className="theme-toggle__button"
                  onClick={toggleThemeMenu}
                  aria-haspopup="listbox"
                  aria-expanded={themeMenuOpen}
                  ref={themeButtonRef}
                >
                  <span className="theme-toggle__icon" aria-hidden="true">
                    🌓
                  </span>
                  <span>{themeLabel}</span>
                </button>
                {themeMenuOpen && (
                  <div className="theme-toggle__menu" role="listbox" ref={themeMenuRef}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={preference === 'light'}
                      className={
                        preference === 'light'
                          ? 'theme-toggle__option theme-toggle__option--active'
                          : 'theme-toggle__option'
                      }
                      onClick={() => selectThemePreference('light')}
                    >
                      Светлая
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={preference === 'dark'}
                      className={
                        preference === 'dark'
                          ? 'theme-toggle__option theme-toggle__option--active'
                          : 'theme-toggle__option'
                      }
                      onClick={() => selectThemePreference('dark')}
                    >
                      Тёмная
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={preference === 'system'}
                      className={
                        preference === 'system'
                          ? 'theme-toggle__option theme-toggle__option--active'
                          : 'theme-toggle__option'
                      }
                      onClick={() => selectThemePreference('system')}
                    >
                      Как в системе
                    </button>
                  </div>
                )}
              </div>
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
          <div className="app-header__actions">
            <div className={`theme-toggle${themeMenuOpen ? ' theme-toggle--open' : ''}`}>
              <button
                type="button"
                className="theme-toggle__button"
                onClick={toggleThemeMenu}
                aria-haspopup="listbox"
                aria-expanded={themeMenuOpen}
                ref={themeButtonRef}
              >
                <span className="theme-toggle__icon" aria-hidden="true">
                  🌓
                </span>
                <span>{themeLabel}</span>
              </button>
              {themeMenuOpen && (
                <div className="theme-toggle__menu" role="listbox" ref={themeMenuRef}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={preference === 'light'}
                    className={
                      preference === 'light'
                        ? 'theme-toggle__option theme-toggle__option--active'
                        : 'theme-toggle__option'
                    }
                    onClick={() => selectThemePreference('light')}
                  >
                    Светлая
                  </button>
                  <button
                    type="button"
                    role="option"
                    aria-selected={preference === 'dark'}
                    className={
                      preference === 'dark'
                        ? 'theme-toggle__option theme-toggle__option--active'
                        : 'theme-toggle__option'
                    }
                    onClick={() => selectThemePreference('dark')}
                  >
                    Тёмная
                  </button>
                  <button
                    type="button"
                    role="option"
                    aria-selected={preference === 'system'}
                    className={
                      preference === 'system'
                        ? 'theme-toggle__option theme-toggle__option--active'
                        : 'theme-toggle__option'
                    }
                    onClick={() => selectThemePreference('system')}
                  >
                    Как в системе
                  </button>
                </div>
              )}
            </div>
            {user && (
              <div className="user-card">
                <span className="user-card__hello">Привет, {user.first_name}!</span>
                <span className="user-card__hint">Ваши ответы видны только вам и проектному офису.</span>
              </div>
            )}
          </div>
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
