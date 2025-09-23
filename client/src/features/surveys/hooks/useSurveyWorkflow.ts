import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HttpClient } from '../../../shared/api/httpClient';
import { createSurvey, fetchSurveys, updateSurvey } from '../../../shared/api/surveys';
import type { FeatureFlags } from '../../../shared/config/featureFlags';
import type { ProjectSummary, SurveyAnswers, SurveyRecord } from '../../../shared/types/api';
import { QUESTION_CONFIG, type QuestionKey } from '../config/questions';

interface UseSurveyWorkflowParams {
  client: HttpClient | null;
  enabled: boolean;
  project: ProjectSummary | null;
  featureFlags: FeatureFlags;
}

interface UseSurveyWorkflowResult {
  surveys: SurveyRecord[];
  isLoading: boolean;
  error: string | null;
  currentSurvey: SurveyRecord | null;
  activeStep: number;
  setActiveStep: (step: number) => void;
  startSurvey: () => Promise<void>;
  submitAnswer: (key: QuestionKey, value: number | string) => Promise<void>;
  saving: boolean;
  creating: boolean;
  editSurvey: (survey: SurveyRecord) => void;
  closeSurvey: () => void;
  bannerError: string | null;
  setBannerError: (value: string | null) => void;
  refresh: () => void;
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

export function useSurveyWorkflow({
  client,
  enabled,
  project,
  featureFlags,
}: UseSurveyWorkflowParams): UseSurveyWorkflowResult {
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSurvey, setCurrentSurvey] = useState<SurveyRecord | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    if (!enabled || !client || !project) {
      setSurveys([]);
      setCurrentSurvey(null);
      setActiveStep(0);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchSurveys(client, project.id)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setSurveys(response.surveys);
        setCurrentSurvey(null);
        setActiveStep(0);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить ответы');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, enabled, project, requestId]);

  const startSurvey = useCallback(async () => {
    if (!client || !project) {
      return;
    }

    setCreating(true);
    setBannerError(null);

    try {
      const response = await createSurvey(client, { projectId: project.id });
      if (!response.record.canEdit || !featureFlags.responseEditing) {
        setBannerError('Анкета за выбранную дату уже закрыта для редактирования.');
        setSurveys((prev) => {
          const filtered = prev.filter((survey) => survey.id !== response.record.id);
          return [response.record, ...filtered];
        });
        return;
      }

      setCurrentSurvey(response.record);
      setActiveStep(findNextStep(response.record));
      setSurveys((prev) => {
        const filtered = prev.filter((survey) => survey.id !== response.record.id);
        return [response.record, ...filtered];
      });
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Не удалось создать анкету');
    } finally {
      setCreating(false);
    }
  }, [client, featureFlags.responseEditing, project]);

  const submitAnswer = useCallback(
    async (key: QuestionKey, value: number | string) => {
      if (!client || !currentSurvey) {
        throw new Error('Анкета не найдена');
      }

      setSaving(true);
      setBannerError(null);

      try {
        const payload = { [key]: value } as SurveyAnswers;
        const response = await updateSurvey(client, currentSurvey.id, payload);
        setCurrentSurvey(response.survey);
        setSurveys((prev) => prev.map((survey) => (survey.id === response.survey.id ? response.survey : survey)));
      } finally {
        setSaving(false);
      }
    },
    [client, currentSurvey],
  );

  const editSurvey = useCallback(
    (survey: SurveyRecord) => {
      if (!featureFlags.responseEditing) {
        setBannerError('Редактирование ответов отключено администратором.');
        return;
      }

      if (!survey.canEdit) {
        setBannerError('Редактирование больше недоступно.');
        return;
      }

      setCurrentSurvey(survey);
      setActiveStep(findNextStep(survey));
    },
    [featureFlags.responseEditing],
  );

  const closeSurvey = useCallback(() => {
    setCurrentSurvey(null);
    setActiveStep(0);
  }, []);

  const refresh = useCallback(() => {
    setRequestId((id) => id + 1);
  }, []);

  const value: UseSurveyWorkflowResult = useMemo(
    () => ({
      surveys,
      isLoading,
      error,
      currentSurvey,
      activeStep,
      setActiveStep,
      startSurvey,
      submitAnswer,
      saving,
      creating,
      editSurvey,
      closeSurvey,
      bannerError,
      setBannerError,
      refresh,
    }),
    [
      surveys,
      isLoading,
      error,
      currentSurvey,
      activeStep,
      startSurvey,
      submitAnswer,
      saving,
      creating,
      editSurvey,
      closeSurvey,
      bannerError,
      refresh,
    ],
  );

  return value;
}
