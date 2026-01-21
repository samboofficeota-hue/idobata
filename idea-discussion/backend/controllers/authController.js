import AdminUser from "../models/AdminUser.js";
import authService from "../services/auth/authService.js";

const initializeAdminUser = async (req, res) => {
  try {
    // PASSWORD_PEPPERの事前チェック
    if (!process.env.PASSWORD_PEPPER) {
      console.error("[AuthController] PASSWORD_PEPPER is not set during initialization");
      return res.status(500).json({
        message:
          "サーバー設定エラー: PASSWORD_PEPPER環境変数が設定されていません。管理者に連絡してください。",
      });
    }

    const adminCount = await AdminUser.countDocuments();

    if (adminCount > 0) {
      return res.status(403).json({
        message: "管理者ユーザーは既に初期化されています",
      });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "名前、メールアドレス、パスワードは必須です",
      });
    }

    const newUser = new AdminUser({
      name,
      email,
      password,
      role: "admin", // 初期ユーザーは常に管理者権限
    });

    await newUser.save();

    console.log(`[AuthController] Initial admin user created: ${email}`);
    res.status(201).json({
      message: "初期管理者ユーザーが正常に作成されました",
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Initialize admin user error:", error);
    
    // PASSWORD_PEPPER関連のエラーの場合、より詳細なメッセージを返す
    if (error.message && error.message.includes("PASSWORD_PEPPER")) {
      return res.status(500).json({
        message: error.message,
      });
    }

    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  // リクエスト情報をログに記録（パスワードは除く）
  console.log("[AuthController] Login attempt:", {
    email,
    hasPassword: !!password,
    passwordLength: password ? password.length : 0,
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    userAgent: req.headers["user-agent"],
  });

  try {
    if (!email || !password) {
      console.warn("[AuthController] Missing email or password");
      return res.status(400).json({
        message: "メールアドレスとパスワードを入力してください",
      });
    }

    // PASSWORD_PEPPERの事前チェック
    if (!process.env.PASSWORD_PEPPER) {
      console.error("[AuthController] PASSWORD_PEPPER is not set");
      return res.status(500).json({
        message:
          "サーバー設定エラー: PASSWORD_PEPPER環境変数が設定されていません。管理者に連絡してください。",
      });
    }

    console.log("[AuthController] PASSWORD_PEPPER is set:", !!process.env.PASSWORD_PEPPER);

    try {
      const { user, token } = await authService.authenticate("local", {
        email,
        password,
      });

      console.log(`[AuthController] Login successful for user: ${email}`, {
        userId: user._id,
        role: user.role,
      });
      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("[AuthController] Authentication error:", {
        error: error.message,
        stack: error.stack,
        email,
      });
      const errorMessage = error.message || "認証に失敗しました";

      // PASSWORD_PEPPER関連のエラーは500を返す
      if (errorMessage.includes("PASSWORD_PEPPER")) {
        return res.status(500).json({
          message: errorMessage,
        });
      }

      // その他の認証エラーは401を返す
      return res.status(401).json({
        message: errorMessage,
      });
    }
  } catch (error) {
    console.error("[AuthController] Login error:", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await AdminUser.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "ユーザーが見つかりません" });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Get current user error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const createAdminUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "名前、メールアドレス、パスワードは必須です",
      });
    }

    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "このメールアドレスは既に使用されています",
      });
    }

    const newUser = new AdminUser({
      name,
      email,
      password,
      role: role || "editor",
    });

    await newUser.save();

    res.status(201).json({
      message: "管理者ユーザーが正常に作成されました",
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Create admin user error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const deleteAdminUser = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "メールアドレスは必須です",
      });
    }

    const user = await AdminUser.findOneAndDelete({ email });

    if (!user) {
      return res.status(404).json({
        message: "ユーザーが見つかりません",
      });
    }

    console.log(`[AuthController] Admin user deleted: ${email}`);
    res.json({
      message: "管理者ユーザーが正常に削除されました",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Delete admin user error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const resetAdminUser = async (req, res) => {
  try {
    // PASSWORD_PEPPERの事前チェック
    if (!process.env.PASSWORD_PEPPER) {
      console.error("[AuthController] PASSWORD_PEPPER is not set during reset");
      return res.status(500).json({
        message:
          "サーバー設定エラー: PASSWORD_PEPPER環境変数が設定されていません。管理者に連絡してください。",
      });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "名前、メールアドレス、パスワードは必須です",
      });
    }

    // 既存のユーザーを削除（存在する場合）
    const existingUser = await AdminUser.findOneAndDelete({ email });
    if (existingUser) {
      console.log(`[AuthController] Deleted existing user: ${email}`);
    }

    // 新しいユーザーを作成
    const newUser = new AdminUser({
      name,
      email,
      password,
      role: "admin",
    });

    await newUser.save();

    console.log(`[AuthController] Admin user reset/created: ${email}`);
    res.status(201).json({
      message: "管理者ユーザーが正常に作成されました",
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("[AuthController] Reset admin user error:", error);
    
    // PASSWORD_PEPPER関連のエラーの場合、より詳細なメッセージを返す
    if (error.message && error.message.includes("PASSWORD_PEPPER")) {
      return res.status(500).json({
        message: error.message,
      });
    }

    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

const deleteAllAdminUsers = async (req, res) => {
  try {
    const result = await AdminUser.deleteMany({});
    console.log(`[AuthController] Deleted ${result.deletedCount} admin user(s)`);
    res.json({
      message: `${result.deletedCount}人の管理者ユーザーを削除しました`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("[AuthController] Delete all admin users error:", error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
};

export {
  login,
  getCurrentUser,
  createAdminUser,
  deleteAdminUser,
  initializeAdminUser,
  resetAdminUser,
  deleteAllAdminUsers,
};
