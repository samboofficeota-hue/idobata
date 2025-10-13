import express from "express";
import { createAdminUser, deleteAdminUser, getCurrentUser, initializeAdminUser, login, } from "../controllers/authController.js";
import { admin, protect } from "../middleware/authMiddleware.js";
const router = express.Router();
router.post("/login", login);
router.get("/me", protect, getCurrentUser);
router.post("/users", protect, admin, createAdminUser);
router.delete("/admin-users", deleteAdminUser);
router.post("/initialize", initializeAdminUser);
export default router;
//# sourceMappingURL=authRoutes.js.map