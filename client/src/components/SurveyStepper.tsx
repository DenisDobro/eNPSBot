import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
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
  onAnswer: (key: QuestionKey, value: number | string) => void;
  onFinish: () => Promise<void>;
  isSubmitting: boolean;
  isSubmitted: boolean;
  onExit: () => void;
}

const SCALE_VALUES = Array.from({ length: 11 }, (_, index) => index);
const COMPLETION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function SurveyStepper({
  survey,
  questions,
  answers,
  activeStep,
  onStepChange,
  onAnswer,
  onFinish,
  isSubmitting,
  isSubmitted,
  onExit,
}: SurveyStepperProps): JSX.Element | null {
  const [currentValue, setCurrentValue] = useState<string | number | undefined>(undefined);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);

  const question = questions[activeStep];
  const isCompleted = activeStep >= questions.length;

  useEffect(() => {
    if (!question) {
      setCurrentValue(undefined);
      setFieldError(null);
      return;
    }

    const answerValue = answers[question.key];
    const preparedValue =
      typeof answerValue === 'number' || typeof answerValue === 'string'
        ? answerValue
        : question.type === 'text'
        ? ''
        : undefined;

    setCurrentValue(preparedValue);
    setFieldError(null);
  }, [answers, question]);

  useEffect(() => {
    if (!isCompleted) {
      setFinishError(null);
    }
  }, [isCompleted]);

  const completionDeadline = useMemo(() => {
    const createdAt = new Date(survey.createdAt);
    const deadline = new Date(createdAt.getTime() + COMPLETION_WINDOW_MS);
    return deadline.toLocaleString();
  }, [survey.createdAt]);

  const commitAnswer = useCallback(
    (value: number | string) => {
      if (!question || isSubmitting) {
        return;
      }

      setFieldError(null);
      setCurrentValue(value);
      onAnswer(question.key, value);
      onStepChange(activeStep + 1);
    },
    [activeStep, isSubmitting, onAnswer, onStepChange, question],
  );

  const handleTextSubmit = useCallback(() => {
    if (!question || question.type !== 'text' || isSubmitting) {
      return;
    }

    const value = typeof currentValue === 'string' ? currentValue.trim() : '';
    if (!value) {
      setFieldError('Напишите короткий комментарий — это поможет команде.');
      return;
    }

    commitAnswer(value);
  }, [commitAnswer, currentValue, isSubmitting, question]);

  const handleFinish = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setFinishError(null);
    try {
      await onFinish();
    } catch (error) {
      setFinishError((error as Error).message);
    }
  }, [isSubmitting, onFinish]);

  const progress = useMemo(() => {
    if (!questions.length) {
      return 0;
    }

    return Math.min((activeStep / questions.length) * 100, 100);
  }, [activeStep, questions.length]);

  if (isCompleted) {
    if (isSubmitted) {
      return (
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Спасибо! Анкета сохранена</h2>
              <p className="panel-subtitle">Вы можете отредактировать ответы до {completionDeadline} в разделе истории.</p>
            </div>
          </header>
          <div className="panel-body">
            <p className="success-message">
              Мы передали ответы проектному офису. Если заметите что-то, что стоит уточнить, просто отредактируйте запись в истории.
            </p>
            <button type="button" className="button" onClick={onExit}>
              Перейти к истории ответов
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Готово к отправке</h2>
            <p className="panel-subtitle">Проверьте ответы и отправьте анкету, чтобы сохранить результат.</p>
          </div>
        </header>
        <div className="panel-body">
          <p className="hint">Вы всегда сможете изменить ответы в течение суток после отправки.</p>
          {finishError && <p className="error-message">{finishError}</p>}
          <button type="button" className="button" onClick={handleFinish} disabled={isSubmitting}>
            {isSubmitting ? 'Отправляем…' : 'Отправить ответы'}
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
            Шаг {activeStep + 1} из {questions.length}. Ответы сохраняются локально до отправки анкеты.
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
              {SCALE_VALUES.map((score) => {
                const isActive = currentValue === score;
                return (
                  <button
                    key={score}
                    type="button"
                    className={`scale-selector__item ${isActive ? 'scale-selector__item--active' : ''}`}
                    onClick={() => commitAnswer(score)}
                    disabled={isSubmitting}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          )}

          {question.type === 'options' && question.options && (
            <div className="options-list">
              {question.options.map((option) => {
                const isActive = currentValue === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`option-chip ${isActive ? 'option-chip--active' : ''}`}
                    onClick={() => commitAnswer(option.value)}
                    disabled={isSubmitting}
                  >
                    {option.label}
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
                handleTextSubmit();
              }}
            >
              <textarea
                value={typeof currentValue === 'string' ? currentValue : ''}
                placeholder={question.placeholder ?? 'Введите ответ'}
                onChange={(event) => {
                  setCurrentValue(event.target.value);
                  setFieldError(null);
                }}
                disabled={isSubmitting}
              />
              {fieldError && <p className="error-message">{fieldError}</p>}
              <button type="submit" className="button" disabled={isSubmitting}>
                {isSubmitting ? 'Сохраняем…' : 'Продолжить'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
