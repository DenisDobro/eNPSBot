import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
});
