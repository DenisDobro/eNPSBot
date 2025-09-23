import { useMemo } from 'react';
import './App.css';
import { useFeatureFlags } from './hooks/useFeatureFlags';
import { ProjectSelector } from '../features/projects/components/ProjectSelector';
import { useProjects } from '../features/projects/hooks/useProjects';
import { ResponsesList } from '../features/history/components/ResponsesList';
import { SurveyStepper } from '../features/surveys/components/SurveyStepper';
import { QUESTION_CONFIG } from '../features/surveys/config/questions';
import { useSurveyWorkflow } from '../features/surveys/hooks/useSurveyWorkflow';
import { createHttpClient } from '../shared/api/httpClient';
import { useMetalampTheme } from '../shared/hooks/useMetalampTheme';
import { useTelegramAuth } from '../shared/telegram/useTelegramAuth';

export default function App() {
  useMetalampTheme();
  const { auth, user, ready } = useTelegramAuth();
  const httpClient = useMemo(() => (ready ? createHttpClient(auth) : null), [auth, ready]);

  const { flags, loading: featureFlagsLoading, error: featureFlagsError } = useFeatureFlags(httpClient, ready);

  const projectsState = useProjects({
    client: httpClient,
    enabled: ready,
    allowCreate: flags.projectCreation,
  });

  const surveyWorkflow = useSurveyWorkflow({
    client: httpClient,
    enabled: ready,
    project: projectsState.selectedProject,
    featureFlags: flags,
  });

  const showProjectPanel = Boolean(projectsState.selectedProject);

  return (
    <div className="app">
      <div className="app-gradient" />
      <div className="app-container">
        <header className="app-header">
          <div>
            <h1 className="app-title">Метрика атмосферы</h1>
            <p className="app-subtitle">Сбор внутреннего NPS помогает нам понимать настроение команды в каждом спринте.</p>
          </div>
          {user && (
            <div className="user-card">
              <span className="user-card__hello">Привет, {user.first_name}!</span>
              <span className="user-card__hint">
                Вы видите только свои ответы. Каждый ответ вы можете отредактировать в течение 1 дня.
              </span>
            </div>
          )}
        </header>
        {featureFlagsError && <div className="banner banner--warning">{featureFlagsError}</div>}
        {surveyWorkflow.bannerError && <div className="banner banner--error">{surveyWorkflow.bannerError}</div>}
        {surveyWorkflow.error && <div className="banner banner--error">{surveyWorkflow.error}</div>}
        <main className="app-grid">
          <ProjectSelector
            projects={projectsState.projects}
            selectedProjectId={projectsState.selectedProject?.id ?? null}
            search={projectsState.search}
            onSearchChange={projectsState.setSearch}
            onSelect={projectsState.selectProject}
            onAddProject={projectsState.createProject}
            isLoading={projectsState.isLoading || featureFlagsLoading}
            error={projectsState.error}
            allowCreate={flags.projectCreation && !featureFlagsLoading}
          />
          <div className="content-column">
            {!showProjectPanel && (
              <section className="panel">
                <header className="panel-header">
                  <div>
                    <h2>Выберите проект</h2>
                    <p className="panel-subtitle">Выберите, пожалуйста, проект и начните заполнять анкету.</p>
                  </div>
                </header>
              </section>
            )}
            {showProjectPanel && !surveyWorkflow.currentSurvey && (
              <section className="panel">
                <header className="panel-header">
                  <div>
                    <h2>{projectsState.selectedProject?.name}</h2>
                    <p className="panel-subtitle">
                      Ответьте на 10 вопросов, чтобы мы понимали климат команды и могли реагировать на изменения.
                    </p>
                  </div>
                </header>
                <div className="panel-body">
                  <p className="hint">Анкета занимает 3–4 минуты. После каждого ответа данные сразу сохраняются.</p>
                  <button
                    type="button"
                    className="button"
                    onClick={surveyWorkflow.startSurvey}
                    disabled={
                      surveyWorkflow.creating || featureFlagsLoading || !flags.responseEditing
                    }
                  >
                    {featureFlagsLoading
                      ? 'Загружаем настройки…'
                      : surveyWorkflow.creating
                        ? 'Создаем анкету…'
                        : flags.responseEditing
                          ? 'Заполнить анкету'
                          : 'Редактирование отключено'}
                  </button>
                </div>
              </section>
            )}
            {surveyWorkflow.currentSurvey && projectsState.selectedProject && (
              <SurveyStepper
                survey={surveyWorkflow.currentSurvey}
                questions={QUESTION_CONFIG}
                answers={surveyWorkflow.currentSurvey}
                activeStep={surveyWorkflow.activeStep}
                onStepChange={surveyWorkflow.setActiveStep}
                onSubmitAnswer={surveyWorkflow.submitAnswer}
                isSaving={surveyWorkflow.saving}
                onExit={surveyWorkflow.closeSurvey}
              />
            )}
            {projectsState.selectedProject && (
              <ResponsesList
                surveys={surveyWorkflow.surveys}
                onEdit={surveyWorkflow.editSurvey}
                isLoading={surveyWorkflow.isLoading}
                projectName={projectsState.selectedProject.name}
                allowEditing={flags.responseEditing}
                showInsights={flags.analyticsDashboard}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
