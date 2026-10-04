import * as Dialog from "@radix-ui/react-dialog";
import { LockKeyhole, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  kouchouCreateApi,
  storedPassword,
} from "../../services/kouchou/createApiClient";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface KouchouPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // パスワードが確認できたら呼ばれる
  onVerified: (password: string) => void;
}

// 広聴AIの新規分析ページを開く前に、パスワードを確認するモーダル
const KouchouPasswordDialog = ({
  open,
  onOpenChange,
  onVerified,
}: KouchouPasswordDialogProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("パスワードを入力してください");
      return;
    }
    setIsChecking(true);
    setError(null);
    try {
      await kouchouCreateApi.verifyPassword(password);
      storedPassword.set(password);
      setPassword("");
      onVerified(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "確認に失敗しました");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPassword("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[16px] border-2 border-primary-700 bg-white p-6 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-6 w-6 text-primary-700" />
              <Dialog.Title className="text-xl-bold leading-heading">
                新規分析
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-primary-700 hover:text-primary-900"
                aria-label="閉じる"
              >
                <X className="h-6 w-6" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-base text-muted-foreground">
            新しい分析を始めるには、パスワードを入力してください。
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              label="パスワード"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!error}
              errorText={error ?? undefined}
            />
            <div className="flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  キャンセル
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={isChecking}>
                {isChecking ? "確認中..." : "確認して進む"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default KouchouPasswordDialog;
