import { Router, type IRouter } from 'express';

import { env } from '../../env';

const router: IRouter = Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'gbedity-backend',
    env: env.NODE_ENV,
    time: new Date().toISOString(),
  });
});

export default router;
