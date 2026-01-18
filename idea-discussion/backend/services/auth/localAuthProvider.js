import AdminUser from "../../models/AdminUser.js";
import AuthProviderInterface from "./authProviderInterface.js";

export default class LocalAuthProvider extends AuthProviderInterface {
  async authenticate({ email, password }) {
    console.log("[LocalAuthProvider] Authenticating user:", email);

    if (!email || !password) {
      throw new Error("メールアドレスとパスワードを入力してください");
    }

    const user = await AdminUser.findOne({ email }).select("+password");

    if (!user) {
      console.error(`[LocalAuthProvider] User not found: ${email}`);
      throw new Error("ユーザーが見つかりません");
    }

    console.log(`[LocalAuthProvider] User found: ${email}`, {
      userId: user._id,
      role: user.role,
      hasPassword: !!user.password,
    });

    // PASSWORD_PEPPERのチェック
    if (!process.env.PASSWORD_PEPPER) {
      console.error("[LocalAuthProvider] PASSWORD_PEPPER is not set");
      throw new Error(
        "PASSWORD_PEPPER環境変数が設定されていません。管理者に連絡してください。"
      );
    }

    console.log("[LocalAuthProvider] PASSWORD_PEPPER is set, comparing password");

    try {
      const isMatch = await user.comparePassword(password);
      console.log(`[LocalAuthProvider] Password comparison result: ${isMatch}`);
      
      if (!isMatch) {
        console.error(`[LocalAuthProvider] Password mismatch for user: ${email}`);
        throw new Error("パスワードが正しくありません");
      }
    } catch (error) {
      // PASSWORD_PEPPER関連のエラーを再スロー
      if (error.message.includes("PASSWORD_PEPPER")) {
        console.error("[LocalAuthProvider] PASSWORD_PEPPER error:", error.message);
        throw error;
      }
      // その他のエラーも再スロー
      console.error("[LocalAuthProvider] Password comparison error:", error.message);
      throw error;
    }

    console.log(`[LocalAuthProvider] Authentication successful for: ${email}`);
    return user;
  }
}
