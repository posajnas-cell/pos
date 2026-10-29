import { Router, type IRouter } from "express";
import healthRouter from "./health";
import billflowRouter from "./billflow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(billflowRouter);

export default router;
