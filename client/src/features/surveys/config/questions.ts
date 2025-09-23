import type { ContributionValue, SurveyAnswers } from '../../../shared/types/api';

export type QuestionKey = keyof SurveyAnswers;

export interface QuestionConfig {
  key: QuestionKey;
  title: string;
  description?: string;
  type: 'scale' | 'text' | 'options';
  placeholder?: string;
  options?: Array<{ label: string; value: ContributionValue }>;
}

export const QUESTION_CONFIG: QuestionConfig[] = [
  {
    key: 'projectRecommendation',
    title: 'Насколько вероятно, что вы порекомендовали бы участие в этом проекте коллеге?',
    description: 'Шкала 0–10.',
    type: 'scale',
  },
  {
    key: 'projectImprovement',
    title: 'Что могло бы повысить вашу оценку проекта?',
    description: 'Открытый ответ.',
    type: 'text',
    placeholder: 'Поделитесь идеями для улучшения проекта.',
  },
  {
    key: 'managerEffectiveness',
    title: 'Насколько эффективно менеджер помогает вам снимать блокеры и двигаться по задачам?',
    description: 'Шкала 0–10.',
    type: 'scale',
  },
  {
    key: 'managerImprovement',
    title: 'Что менеджер мог бы улучшить в следующем спринте?',
    description: 'Открытый ответ.',
    type: 'text',
    placeholder: 'Напишите конкретные ожидания или пожелания.',
  },
  {
    key: 'teamComfort',
    title: 'Насколько комфортно вам взаимодействовать с коллегами по команде?',
    description: 'Шкала 0–10.',
    type: 'scale',
  },
  {
    key: 'teamImprovement',
    title: 'Что можно улучшить в командной работе?',
    description: 'Открытый ответ.',
    type: 'text',
    placeholder: 'Опишите, что поможет команде работать лучше.',
  },
  {
    key: 'processOrganization',
    title: 'Насколько хорошо организованы процессы (созвоны, таски, коммуникация) для продуктивной работы?',
    description: 'Шкала 0–10.',
    type: 'scale',
  },
  {
    key: 'processObstacles',
    title: 'Что мешало в этом спринте/неделе работать эффективнее?',
    description: 'Открытый ответ.',
    type: 'text',
    placeholder: 'Опишите основные сложности.',
  },
  {
    key: 'contributionValued',
    title: 'Чувствуете ли вы, что ваш вклад в проект ценится?',
    description: 'Да / Нет / Частично.',
    type: 'options',
    options: [
      { label: 'Да', value: 'yes' },
      { label: 'Частично', value: 'partial' },
      { label: 'Нет', value: 'no' },
    ],
  },
  {
    key: 'improvementIdeas',
    title: 'Есть ли у вас идеи для улучшения проекта или процессов?',
    description: 'Открытый ответ.',
    type: 'text',
    placeholder: 'Предложите гипотезы или эксперименты.',
  },
];
