import express from "express";
import { getOpinions } from "../controllers/topPageController.js";
const router = express.Router();
router.get("/", getOpinions);
export default router;
//# sourceMappingURL=opinionsRoutes.js.map