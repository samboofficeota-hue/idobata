import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface FullScreenReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

/** レポートカード（討論分析・イラストまとめ等）をクリックしたときに、画面全幅で表示するモーダル */
const FullScreenReportModal = ({
  open,
  onOpenChange,
  title,
  children,
}: FullScreenReportModalProps) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-white data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3 md:px-8 md:py-4">
            <Dialog.Title className="text-base font-bold text-gray-800 md:text-lg">
              {title}
            </Dialog.Title>
            <Dialog.Close className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4 md:p-8">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default FullScreenReportModal;
