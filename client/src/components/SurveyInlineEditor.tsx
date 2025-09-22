import { useEffect, useMemo, useState } from 'react';
import type { QuestionConfig, QuestionKey } from './SurveyStepper';
import type { ContributionValue, SurveyAnswers, SurveyRecord } from '../types';

type DraftState = Map<QuestionKey, number | string | null>;

type SurveyInlineEditorProps = {
  survey: SurveyRecord;
  questions: QuestionConfig[];
  isSaving: boolean;
  onSubmit: (updates: SurveyAnswers) => Promise<void>;
  onClose: () => void;
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeScale(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeOption(value: unknown): ContributionValue | '' {
  return value === 'yes' || value === 'no' || value === 'partial' ? value : '';
}

const buildInitialDraft = (survey: SurveyRecord, questions: QuestionConfig[]): DraftState => {
  const draft = new Map<QuestionKey, number | string | null>();

  questions.forEach((question) => {
    const value = survey[question.key];

    if (question.type === 'text') {
      draft.set(question.key, normalizeText(value));
      return;
    }

    if (question.type === 'scale') {
      draft.set(question.key, normalizeScale(value));
      return;
    }

    if (question.type === 'options') {
      draft.set(question.key, normalizeOption(value) || null);
      return;
    }

    draft.set(question.key, null);
  });

  return draft;
};

const buildUpdates = (draft: DraftState, survey: SurveyRecord, questions: QuestionConfig[]): SurveyAnswers => {
  const updates: Record<string, number | string | ContributionValue> = {};

  questions.forEach((question) => {
    const draftValue = draft.get(question.key);
    const originalValue = survey[question.key];

    if (question.type === 'text') {
      const trimmed = normalizeText(draftValue).trim();
      const original = normalizeText(originalValue).trim();
      if (trimmed !== original) {
        updates[question.key] = trimmed;
      }
      return;
    }

    if (question.type === 'scale') {
      const next = normalizeScale(draftValue);
      const original = normalizeScale(originalValue);
      if (next !== null && next !== original) {
        updates[question.key] = next;
      }
      return;
    }

    if (question.type === 'options') {
      const next = normalizeOption(draftValue);
      const original = normalizeOption(originalValue);
      if (next && next !== original) {
        updates[question.key] = next;
      }
    }
  });

  return updates as SurveyAnswers;
};

function hasChanges(draft: DraftState, survey: SurveyRecord, questions: QuestionConfig[]): boolean {
  return Object.keys(buildUpdates(draft, survey, questions)).length > 0;
}

function SurveyInlineEditor({ survey, questions, isSaving, onSubmit, onClose }: SurveyInlineEditorProps) {
  const initialDraft = useMemo(() => buildInitialDraft(survey, questions), [survey, questions]);
  const [draft, setDraft] = useState<DraftState>(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const disabled = isSaving || !hasChanges(draft, survey, questions);

  const handleSave = async () => {
    const updates = buildUpdates(draft, survey, questions);
    await onSubmit(updates);
    onClose();
  };

  return (
    <div className="response-editor">
      <div className="response-editor__header">
        <h3>Редактирование ответов</h3>
        <button type="button" className="button button--ghost" onClick={onClose} disabled={isSaving}>
          Закрыть
        </button>
      </div>
      <div className="response-editor__content">
        {questions.map((question) => {
          const value = draft.get(question.key);

          if (question.type === 'scale') {
            const currentValue = normalizeScale(value);
            return (
              <section key={question.key} className="response-editor__section">
                <header className="response-editor__section-header">
                  <h4>{question.title}</h4>
                  {question.description && <p>{question.description}</p>}
                </header>
                <div className="scale-selector">
                  {Array.from({ length: 11 }, (_, index) => index).map((score) => {
                    const isActive = currentValue === score;
                    return (
                      <button
                        key={score}
                        type="button"
                        className={`scale-selector__item ${isActive ? 'scale-selector__item--active' : ''}`}
                        onClick={() =>
                          setDraft((prev) => {
                            const next = new Map(prev);
                            next.set(question.key, score);
                            return next;
                          })
                        }
                        disabled={isSaving}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          }

          if (question.type === 'options') {
            const currentValue = normalizeOption(value);
            return (
              <section key={question.key} className="response-editor__section">
                <header className="response-editor__section-header">
                  <h4>{question.title}</h4>
                  {question.description && <p>{question.description}</p>}
                </header>
                <div className="options-selector">
                  {question.options?.map((option) => {
                    const isActive = currentValue === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`option-chip ${isActive ? 'option-chip--active' : ''}`}
                        onClick={() =>
                          setDraft((prev) => {
                            const next = new Map(prev);
                            next.set(question.key, option.value);
                            return next;
                          })
                        }
                        disabled={isSaving}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          }

          return (
            <section key={question.key} className="response-editor__section">
              <header className="response-editor__section-header">
                <h4>{question.title}</h4>
                {question.description && <p>{question.description}</p>}
              </header>
              <textarea
                className="textarea response-editor__textarea"
                value={normalizeText(value)}
                placeholder={question.placeholder ?? 'Напишите короткий ответ'}
                onChange={(event) =>
                  setDraft((prev) => {
                    const next = new Map(prev);
                    next.set(question.key, event.target.value);
                    return next;
                  })
                }
                rows={4}
                disabled={isSaving}
              />
            </section>
          );
        })}
      </div>
      <div className="response-editor__actions">
        <button type="button" className="button" onClick={handleSave} disabled={disabled}>
          {isSaving ? 'Сохраняем…' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  );
}

export default SurveyInlineEditor;
