import crypto from "node:crypto";
import path from "node:path";
import User from "../models/User.js";
import UserTokenClaim from "../models/UserTokenClaim.js";
import { createStorageService } from "../services/storage/storageServiceFactory.js";
import { isValidUserId, signUserToken } from "../services/userToken.js";
import { generateRandomDisplayName } from "../utils/displayNameGenerator.js";

const storageService = createStorageService("local", {
  baseUrl: process.env.API_BASE_URL || "http://localhost:3000",
});

const inMemoryUsers = new Map();

/**
 * Get user from database or in-memory store
 * @param {string} userId - User ID
 * @returns {Object} User object
 */
export const getUser = async (userId) => {
  try {
    let user = await User.findOne({ userId });
    if (user) return user;

    const defaultDisplayName = generateRandomDisplayName();
    user = new User({
      userId,
      displayName: defaultDisplayName,
      profileImagePath: null,
    });
    await user.save();
    return user;
  } catch (error) {
    console.warn("MongoDB not available, using in-memory store");
  }

  if (!inMemoryUsers.has(userId)) {
    const defaultDisplayName = generateRandomDisplayName();
    inMemoryUsers.set(userId, {
      userId,
      displayName: defaultDisplayName,
      profileImagePath: null,
    });
  }

  return inMemoryUsers.get(userId);
};

/**
 * Save user to database or in-memory store
 * @param {Object} user - User object
 */
const saveUser = async (user) => {
  try {
    if (user.save) {
      await user.save();
      return;
    }
  } catch (error) {
    console.warn("MongoDB not available, using in-memory store");
  }

  inMemoryUsers.set(user.userId, user);
};

/**
 * Get user information by userId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getUser(userId);

    return res.status(200).json({
      displayName: user.displayName,
      profileImagePath: user.profileImagePath
        ? storageService.getFileUrl(user.profileImagePath)
        : null,
    });
  } catch (error) {
    console.error("Error getting user info:", error);
    return res.status(500).json({
      error: "Failed to get user information",
    });
  }
};

// 新しい userId に利用者トークンを出す。すでに誰かが受け取っていれば null
const claimUserId = async (userId) => {
  try {
    await UserTokenClaim.create({ userId });
    return true;
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
};

/**
 * 利用者トークンを受け取る（ページを開いたときに毎回呼ぶ）
 *  - 正しいトークンを持っていれば、そのまま返す
 *  - トークンを持っていない端末が、以前から使っている userId を送ってきたら、
 *    まだ誰もその userId のトークンを受け取っていない場合に限り出す（移行のため）
 *  - それ以外は、新しい userId を作って出す
 */
export const createUserSession = async (req, res) => {
  try {
    if (req.verifiedUserId) {
      return res.status(200).json({
        userId: req.verifiedUserId,
        token: signUserToken(req.verifiedUserId),
      });
    }

    const requested = req.body?.userId;
    if (isValidUserId(requested) && (await claimUserId(requested))) {
      return res
        .status(200)
        .json({ userId: requested, token: signUserToken(requested) });
    }

    const userId = crypto.randomUUID();
    await claimUserId(userId);
    return res.status(201).json({ userId, token: signUserToken(userId) });
  } catch (error) {
    console.error("Error creating user session:", error);
    return res.status(500).json({ error: "Failed to create user session" });
  }
};

/**
 * Update user display name
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateUserDisplayName = async (req, res) => {
  try {
    const { userId } = req.params;
    const { displayName } = req.body;

    if (typeof displayName !== "string" || !displayName.trim()) {
      return res.status(400).json({
        error: "Display name is required",
      });
    }

    const user = await getUser(userId);
    user.displayName = displayName.trim().slice(0, 50);
    await saveUser(user);

    return res.status(200).json({
      success: true,
      message: "Display name updated successfully",
    });
  } catch (error) {
    console.error("Error updating display name:", error);
    return res.status(500).json({
      error: "Failed to update display name",
    });
  }
};

/**
 * Upload profile image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const uploadProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: "No file uploaded",
      });
    }

    const user = await getUser(userId);

    if (user.profileImagePath) {
      await storageService.deleteFile(user.profileImagePath);
    }

    const uploadDir = path.join(process.cwd(), "uploads/profile-images");
    const filePath = await storageService.saveFile(file, uploadDir);

    user.profileImagePath = filePath;
    await saveUser(user);

    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      profileImageUrl: storageService.getFileUrl(filePath),
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    return res.status(500).json({
      error: "Failed to upload profile image",
    });
  }
};
