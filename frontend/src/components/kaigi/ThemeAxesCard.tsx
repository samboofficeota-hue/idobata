import type { KaigiHostTheme } from "../../services/kaigi/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface ThemeAxesCardProps {
  theme: KaigiHostTheme;
  isBusy: boolean;
  onRemove: () => void;
  onRelink: () => void;
}

// お題に紐づいた、いどばたのテーマと、AIメンバー3体が立つ論点（ホストだけが見る）
const ThemeAxesCard = ({
  theme,
  isBusy,
  onRemove,
  onRelink,
}: ThemeAxesCardProps) => (
  <Card className="space-y-4">
    <h2 className="text-xl font-bold">AIメンバーが立つ論点</h2>
    {theme.themeTitle ? (
      <>
        <p className="text-sm text-neutral-700">
          いどばたのテーマ
          <span className="font-bold">「{theme.themeTitle}」</span>
          に集まった声の、合意と対立の軸をもとにしています。肯定派・否定派・未定派の3体は、この論点に立って問いかけます。参加者には表示されません。
        </p>
        {theme.axes.length > 0 ? (
          <ol className="space-y-3">
            {theme.axes.map((axis) => (
              <li
                key={axis.proposition}
                className="rounded-md border bg-neutral-50 p-3 text-sm leading-relaxed"
              >
                <p className="font-bold">{axis.proposition}</p>
                {axis.agreement.length > 0 && (
                  <p className="mt-1 text-neutral-700">
                    合意：{axis.agreement.join("／")}
                  </p>
                )}
                <p className="mt-1">
                  <span className="font-bold text-amber-700">肯定側</span>：
                  {axis.affirmative}
                </p>
                <p>
                  <span className="font-bold text-rose-700">否定側</span>：
                  {axis.negative}
                </p>
                {axis.undecidedReason && (
                  <p>
                    <span className="font-bold text-emerald-700">
                      決めきれない理由
                    </span>
                    ：{axis.undecidedReason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-neutral-600">
            このお題に関係する軸は、まだありません（準備中か、テーマの軸がお題と合いませんでした）。
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => {
            if (
              window.confirm(
                "このテーマを外しますか？外すと、AIメンバーは参加者の声の整理から論点を作ります。すでに始めている参加者は、そのままの論点で続けます。"
              )
            ) {
              onRemove();
            }
          }}
        >
          このテーマを外す
        </Button>
      </>
    ) : (
      <>
        <p className="text-sm text-neutral-700">
          {theme.removedByHost
            ? "いどばたのテーマを外しています。"
            : "このお題に近い、いどばたのテーマは見つかっていません。"}
          AIメンバーは、参加者の声の整理（工程3）から論点を作ります。
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={onRelink}
        >
          テーマを探し直す
        </Button>
      </>
    )}
  </Card>
);

export default ThemeAxesCard;
