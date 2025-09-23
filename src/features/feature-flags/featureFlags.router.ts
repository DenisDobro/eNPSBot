import { Router } from 'express';
import { featureFlags } from '../../config';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ featureFlags });
});

export default router;
