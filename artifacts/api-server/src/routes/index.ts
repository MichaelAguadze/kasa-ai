import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import callsRouter from "./calls.js";
import twilioRouter from "./twilio.js";
import translationRouter from "./translation.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(callsRouter);
router.use(twilioRouter);
router.use(translationRouter);

export default router;
