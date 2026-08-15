import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import farmsRouter from "./farms";
import batchesRouter from "./batches";
import listingsRouter from "./listings";
import inquiriesRouter from "./inquiries";
import adminRouter from "./admin";
import statsRouter from "./stats";
import reviewsRouter from "./reviews";
import paymentsRouter from "./payments";
import deliveryRouter from "./delivery";
import referralsRouter from "./referrals";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(farmsRouter);
router.use(batchesRouter);
router.use(listingsRouter);
router.use(inquiriesRouter);
router.use(adminRouter);
router.use(statsRouter);
router.use(reviewsRouter);
router.use(paymentsRouter);
router.use(deliveryRouter);
router.use(referralsRouter);
router.use(ordersRouter);

export default router;
