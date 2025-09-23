import { z } from 'zod';

const ratingField = z.number().int().min(0).max(10);
const textField = z.string().max(2000).optional();

export const createSurveySchema = z.object({
  projectId: z.number().int().positive(),
  surveyDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const updateSurveySchema = z.object({
  projectRecommendation: ratingField.optional(),
  projectImprovement: textField,
  managerEffectiveness: ratingField.optional(),
  managerImprovement: textField,
  teamComfort: ratingField.optional(),
  teamImprovement: textField,
  processOrganization: ratingField.optional(),
  processObstacles: textField,
  contributionValued: z.enum(['yes', 'no', 'partial']).optional(),
  improvementIdeas: textField,
});
