import * as Dialog from "@radix-ui/react-dialog";
import { LockKeyhole, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { kaigiApi, storedHostPassword } from "../../services/kaigi/kaigiApi";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface KaigiPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (password: string) => void;
}

// お題をつくる前に、パスワードを確認するモーダル（ログインと課金ができるまでの暫定）
const KaigiPasswordDialog = ({
  open,
  onOpenChange,
  onVerified,
}: KaigiPasswordDialogProps) => {
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
      await kaigiApi.verifyPassword(password);
      storedHostPassword.set(password);
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[16px] border-2 border-primary-700 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-6 w-6 text-primary-700" />
              <Dialog.Title className="text-xl font-bold">
                お題をつくる
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-primary-700"
                aria-label="閉じる"
              >
                <X className="h-6 w-6" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-base text-muted-foreground">
            お題をつくるには、パスワードを入力してください。
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

export default KaigiPasswordDialog;
