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
