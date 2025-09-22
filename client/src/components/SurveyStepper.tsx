import { useEffect, useState } from 'react';
import type { ContributionValue, SurveyAnswers, SurveyRecord } from '../types';

export type QuestionKey = keyof SurveyAnswers;

export type QuestionConfig = {
  key: QuestionKey;
  title: string;
  description?: string;
  type: 'scale' | 'text' | 'options';
  placeholder?: string;
  options?: Array<{ label: string; value: ContributionValue }>;
};

interface SurveyStepperProps {
  survey: SurveyRecord;
  questions: QuestionConfig[];
  answers: SurveyAnswers;
  activeStep: number;
  onStepChange: (next: number) => void;
  onSubmitAnswer: (key: QuestionKey, value: number | string) => Promise<void>;
  isSaving: boolean;
  onExit: () => void;
}

export function SurveyStepper({
  survey,
  questions,
  answers,
  activeStep,
  onStepChange,
  onSubmitAnswer,
  isSaving,
  onExit,
}: SurveyStepperProps) {
  const [currentValue, setCurrentValue] = useState<string | number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const question = questions[activeStep];
  const isCompleted = activeStep >= questions.length;

  useEffect(() => {
    if (!question) {
      return;
    }

    const answerValue = answers[question.key];

    if (question.type === 'text') {
      setCurrentValue(typeof answerValue === 'string' ? answerValue : '');
    } else {
      setCurrentValue(typeof answerValue === 'number' ? answerValue : answerValue);
    }

    setError(null);
  }, [question, answers]);

  const handleScaleSelect = async (value: number) => {
    if (!question || question.type !== 'scale') {
      return;
    }

    setError(null);
    setCurrentValue(value);
    try {
      await onSubmitAnswer(question.key, value);
      onStepChange(activeStep + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleOptionSelect = async (value: ContributionValue) => {
    if (!question || question.type !== 'options') {
      return;
    }

    setError(null);
    setCurrentValue(value);
    try {
      await onSubmitAnswer(question.key, value);
      onStepChange(activeStep + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleTextSubmit = async () => {
    if (!question || question.type !== 'text') {
      return;
    }

    const value = typeof currentValue === 'string' ? currentValue.trim() : '';
    if (!value) {
      setError('Напишите короткий комментарий — это поможет команде.');
      return;
    }

    setError(null);
    try {
      await onSubmitAnswer(question.key, value);
      onStepChange(activeStep + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const progress = Math.min((activeStep / questions.length) * 100, 100);

  if (isCompleted) {
    return (
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Спасибо! Анкета сохранена</h2>
            <p className="panel-subtitle">
              Вы всегда можете вернуться и обновить ответы в любое время.
            </p>
          </div>
        </header>
        <div className="panel-body">
          <p className="success-message">
            Мы уже передали ответы команде проектного офиса. Спасибо за честность и внимание к деталям!
          </p>
          <button type="button" className="button button--secondary" onClick={onExit}>
            Вернуться к проектам
          </button>
        </div>
      </section>
    );
  }

  if (!question) {
    return null;
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>{survey.projectName}</h2>
          <p className="panel-subtitle">
            Шаг {activeStep + 1} из {questions.length}. Ответы сохраняются сразу после отправки.
          </p>
        </div>
        <div className="progress">
          <div className="progress__bar" style={{ width: `${progress}%` }} />
        </div>
      </header>
      <div className="panel-body">
        <div className="question-block">
          <h3 className="question-title">{question.title}</h3>
          {question.description && <p className="question-description">{question.description}</p>}
          {question.type === 'scale' && (
            <div className="scale-selector">
              {Array.from({ length: 11 }, (_, index) => index).map((score) => {
                const isActive = currentValue === score;
                return (
                  <button
                    key={score}
                    type="button"
                    className={`scale-selector__item ${isActive ? 'scale-selector__item--active' : ''}`}
                    onClick={() => handleScaleSelect(score)}
                    disabled={isSaving}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          )}
          {question.type === 'text' && (
            <form
              className="text-answer"
              onSubmit={(event) => {
                event.preventDefault();
                void handleTextSubmit();
              }}
            >
              <textarea
                value={typeof currentValue === 'string' ? currentValue : ''}
                onChange={(event) => setCurrentValue(event.target.value)}
                className="textarea"
                placeholder={question.placeholder ?? 'Напишите короткий ответ'}
                rows={4}
                disabled={isSaving}
              />
              <div className="question-actions">
                <button type="submit" className="button" disabled={isSaving}>
                  {isSaving ? 'Сохраняем…' : 'Сохранить ответ'}
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => onStepChange(Math.max(0, activeStep - 1))}
                  disabled={isSaving || activeStep === 0}
                >
                  Назад
                </button>
              </div>
            </form>
          )}
          {question.type === 'options' && (
            <div className="options-selector">
              {question.options?.map((option) => {
                const isActive = currentValue === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`option-chip ${isActive ? 'option-chip--active' : ''}`}
                    onClick={() => handleOptionSelect(option.value)}
                    disabled={isSaving}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {error && <div className="error-message question-error">{error}</div>}
        {question.type !== 'text' && (
          <div className="question-footer">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => onStepChange(Math.max(0, activeStep - 1))}
              disabled={isSaving || activeStep === 0}
            >
              Назад
            </button>
            <span className="hint">Выберите ответ, чтобы перейти далее.</span>
          </div>
        )}
        <p className="deadline-hint">Ответы можно редактировать в любой момент — изменения сохранятся сразу.</p>
      </div>
    </section>
  );
}
