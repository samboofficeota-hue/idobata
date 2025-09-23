import express from "express";
import {
  getOpinions,
  getTopPageData,
} from "../controllers/topPageController.js";

const router = express.Router();

router.get("/", getTopPageData);
router.get("/opinions", getOpinions);

export default router;
