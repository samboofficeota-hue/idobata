import express from "express";
import { getSolutionsByTheme } from "../controllers/adminController.js";
const router = express.Router({ mergeParams: true });
router.get("/", getSolutionsByTheme);
export default router;
//# sourceMappingURL=themeSolutionRoutes.js.map