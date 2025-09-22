import type { SurveyRecord } from '../types';
import type { QuestionConfig, QuestionKey } from './SurveyStepper';
import SurveyInlineEditor from './SurveyInlineEditor';

interface ResponsesListProps {
  surveys: SurveyRecord[];
  onEdit: (survey: SurveyRecord) => void;
  isLoading: boolean;
  questions: QuestionConfig[];
  editingSurveyId: number | null;
  onCancelEdit: () => void;
  onSubmitField: (surveyId: number, key: QuestionKey, value: number | string) => Promise<void>;
  isSaving: boolean;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

function RatingRow({ label, value }: { label: string; value?: number }) {
  if (value === undefined || value === null) {
    return null;
  }

  return (
    <div className="response-rating">
      <span className="response-rating__label">{label}</span>
      <span className="response-rating__value">{value}</span>
    </div>
  );
}

export function ResponsesList({
  surveys,
  onEdit,
  isLoading,
  questions,
  editingSurveyId,
  onCancelEdit,
  onSubmitField,
  isSaving,
}: ResponsesListProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>История ответов</h2>
          <p className="panel-subtitle">Видны только ваши ответы. Мы сохраняем каждую запись с датой.</p>
        </div>
      </header>
      <div className="panel-body responses-list">
        {isLoading && <div className="hint">Загружаем историю…</div>}
        {!isLoading && surveys.length === 0 && <div className="hint">Пока нет заполненных анкет.</div>}
        {surveys.map((survey) => {
          const updated = formatDate(survey.updatedAt);
          const isEditing = editingSurveyId === survey.id;

          return (
            <article key={survey.id} className="response-card">
              {isEditing ? (
                <SurveyInlineEditor
                  survey={survey}
                  questions={questions}
                  isSaving={isSaving}
                  onSubmit={(key, value) => onSubmitField(survey.id, key, value)}
                  onClose={onCancelEdit}
                />
              ) : (
                <>
                  <header className="response-card__header">
                    <h3>{new Date(survey.surveyDate).toLocaleDateString()}</h3>
                    <span className="response-card__meta">Обновлено: {updated}</span>
                  </header>
                  <div className="response-card__content">
                    <div className="response-card__ratings">
                      <RatingRow label="Проект" value={survey.projectRecommendation} />
                      <RatingRow label="Менеджер" value={survey.managerEffectiveness} />
                      <RatingRow label="Команда" value={survey.teamComfort} />
                      <RatingRow label="Процессы" value={survey.processOrganization} />
                    </div>
                    <dl className="response-card__details">
                      {survey.projectImprovement && (
                        <div>
                          <dt>Что улучшить в проекте</dt>
                          <dd>{survey.projectImprovement}</dd>
                        </div>
                      )}
                      {survey.managerImprovement && (
                        <div>
                          <dt>Фидбек менеджеру</dt>
                          <dd>{survey.managerImprovement}</dd>
                        </div>
                      )}
                      {survey.teamImprovement && (
                        <div>
                          <dt>Командная работа</dt>
                          <dd>{survey.teamImprovement}</dd>
                        </div>
                      )}
                      {survey.processObstacles && (
                        <div>
                          <dt>Что мешало работать</dt>
                          <dd>{survey.processObstacles}</dd>
                        </div>
                      )}
                      {survey.contributionValued && (
                        <div>
                          <dt>Вклад ценится</dt>
                          <dd>
                            {survey.contributionValued === 'yes'
                              ? 'Да'
                              : survey.contributionValued === 'partial'
                                ? 'Частично'
                                : 'Нет'}
                          </dd>
                        </div>
                      )}
                      {survey.improvementIdeas && (
                        <div>
                          <dt>Идеи по улучшению</dt>
                          <dd>{survey.improvementIdeas}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <footer className="response-card__footer">
                    <button type="button" className="button button--secondary" onClick={() => onEdit(survey)}>
                      Редактировать ответы
                    </button>
                  </footer>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
