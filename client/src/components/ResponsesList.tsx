import type { SurveyAnswers, SurveyRecord } from '../types';
import type { QuestionConfig } from './SurveyStepper';
import SurveyInlineEditor from './SurveyInlineEditor';

interface ResponsesListProps {
  surveys: SurveyRecord[];
  onEdit: (survey: SurveyRecord) => void;
  isLoading: boolean;
  questions: QuestionConfig[];
  editingSurveyId: number | null;
  onCancelEdit: () => void;
  onSubmitDraft: (surveyId: number, updates: SurveyAnswers) => Promise<void>;
  isSaving: boolean;
  projectName?: string;
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

type RatingKey = 'projectRecommendation' | 'managerEffectiveness' | 'teamComfort' | 'processOrganization';

type RatingField = { key: RatingKey; label: string };

const RATING_FIELDS: RatingField[] = [
  { key: 'projectRecommendation', label: 'Проект' },
  { key: 'managerEffectiveness', label: 'Менеджер' },
  { key: 'teamComfort', label: 'Команда' },
  { key: 'processOrganization', label: 'Процессы' },
];

function calculateAverage(values: Array<number | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number');
  if (!filtered.length) {
    return null;
  }

  const total = filtered.reduce((sum, value) => sum + value, 0);
  return total / filtered.length;
}

export function ResponsesList({
  surveys,
  onEdit,
  isLoading,
  questions,
  editingSurveyId,
  onCancelEdit,
  onSubmitDraft,
  isSaving,
  projectName,
}: ResponsesListProps) {
  const ratingStats = RATING_FIELDS.map((field) => ({
    ...field,
    average: calculateAverage(surveys.map((survey) => survey[field.key])),
  })).filter((stat): stat is RatingField & { average: number } => stat.average !== null);

  const contributionStats = surveys.reduce(
    (acc, survey) => {
      if (survey.contributionValued) {
        acc[survey.contributionValued] += 1;
      }
      return acc;
    },
    { yes: 0, partial: 0, no: 0 },
  );

  const totalContributionResponses = contributionStats.yes + contributionStats.partial + contributionStats.no;

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>История ответов</h2>
          <p className="panel-subtitle">
            Вы видите только свои ответы. Каждый ответ вы можете отредактировать в течение 1 дня.
          </p>
          {projectName && <p className="panel-meta">Проект: {projectName}</p>}
        </div>
      </header>
      <div className="panel-body responses-list">
        {surveys.length > 0 && (
          <div className="responses-insights">
            <div className="responses-insights__section">
              <h3>Средние оценки</h3>
              {ratingStats.length > 0 ? (
                <div className="responses-insights__grid">
                  {ratingStats.map((stat) => (
                    <div key={stat.key} className="responses-insights__card">
                      <span className="responses-insights__label">{stat.label}</span>
                      <span className="responses-insights__value">{stat.average.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hint">Пока нет оценок по шкале.</p>
              )}
            </div>
            <div className="responses-insights__section">
              <h3>Оценка ценности вклада</h3>
              {totalContributionResponses > 0 ? (
                <ul className="responses-insights__distribution">
                  <li>
                    <span className="responses-insights__chip">Да</span>
                    <span className="responses-insights__count">{contributionStats.yes}</span>
                  </li>
                  <li>
                    <span className="responses-insights__chip">Частично</span>
                    <span className="responses-insights__count">{contributionStats.partial}</span>
                  </li>
                  <li>
                    <span className="responses-insights__chip">Нет</span>
                    <span className="responses-insights__count">{contributionStats.no}</span>
                  </li>
                </ul>
              ) : (
                <p className="hint">Ответов на вопрос про вклад пока нет.</p>
              )}
            </div>
          </div>
        )}
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
                  onSubmit={(draft) => onSubmitDraft(survey.id, draft)}
                  onClose={onCancelEdit}
                />
              ) : (
                <>
                  <header className="response-card__header">
                    <h3>{new Date(survey.surveyDate).toLocaleDateString()}</h3>
                    <span className="response-card__meta">Обновлено: {updated}</span>
                  </header>
                  <div className="response-card__content">
                    <span className="response-card__project">{survey.projectName}</span>
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
