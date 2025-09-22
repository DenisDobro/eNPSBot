import { useEffect, useMemo, useState } from 'react';
import type { QuestionConfig, QuestionKey } from './SurveyStepper';
import type { ContributionValue, SurveyRecord } from '../types';

interface SurveyInlineEditorProps {
  survey: SurveyRecord;
  questions: QuestionConfig[];
  isSaving: boolean;
  onSubmit: (key: QuestionKey, value: number | string) => Promise<void>;
  onClose: () => void;
}

type TextState = Record<QuestionKey, string>;

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function SurveyInlineEditor({ survey, questions, isSaving, onSubmit, onClose }: SurveyInlineEditorProps) {
  const initialTextState = useMemo<TextState>(() => {
    return questions.reduce<TextState>((acc, question) => {
      if (question.type === 'text') {
        acc[question.key] = normalizeText(survey[question.key]);
      }

      return acc;
    }, {} as TextState);
  }, [questions, survey]);

  const [textValues, setTextValues] = useState<TextState>(initialTextState);

  useEffect(() => {
    setTextValues(initialTextState);
  }, [initialTextState]);

  const handleScaleSelect = async (key: QuestionKey, value: number) => {
    await onSubmit(key, value);
  };

  const handleOptionSelect = async (key: QuestionKey, value: ContributionValue) => {
    await onSubmit(key, value);
  };

  const handleTextSubmit = async (key: QuestionKey) => {
    const trimmed = textValues[key]?.trim() ?? '';
    await onSubmit(key, trimmed);
  };

  return (
    <div className="response-editor">
      <div className="response-editor__header">
        <h3>Редактирование ответов</h3>
        <button type="button" className="button button--ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
      <div className="response-editor__content">
        {questions.map((question) => {
          if (question.type === 'scale') {
            const currentValue = survey[question.key];
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
                        onClick={() => handleScaleSelect(question.key, score)}
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
            const currentValue = survey[question.key];
            return (
              <section key={question.key} className="response-editor__section">
                <header className="response-editor__section-header">
                  <h4>{question.title}</h4>
                </header>
                <div className="options-selector">
                  {question.options?.map((option) => {
                    const isActive = currentValue === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`option-chip ${isActive ? 'option-chip--active' : ''}`}
                        onClick={() => handleOptionSelect(question.key, option.value)}
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

          const textValue = textValues[question.key] ?? '';

          return (
            <section key={question.key} className="response-editor__section">
              <header className="response-editor__section-header">
                <h4>{question.title}</h4>
                {question.description && <p>{question.description}</p>}
              </header>
              <textarea
                className="textarea response-editor__textarea"
                value={textValue}
                placeholder={question.placeholder ?? 'Напишите короткий ответ'}
                onChange={(event) =>
                  setTextValues((prev) => ({
                    ...prev,
                    [question.key]: event.target.value,
                  }))
                }
                rows={4}
                disabled={isSaving}
              />
              <div className="response-editor__actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => handleTextSubmit(question.key)}
                  disabled={isSaving}
                >
                  Сохранить
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default SurveyInlineEditor;
