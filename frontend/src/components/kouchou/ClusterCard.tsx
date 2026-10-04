import { ChevronDown, ChevronUp, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import type {
  KouchouArgument,
  KouchouCluster,
} from "../../services/kouchou/types";
import { Card, CardContent, CardTitle } from "../ui/card";

interface ClusterCardProps {
  cluster: KouchouCluster;
  color: string;
  totalArguments: number;
  subClusters: KouchouCluster[];
  sampleArguments: KouchouArgument[];
  isSelected: boolean;
  onSelect: () => void;
}

const ClusterCard = ({
  cluster,
  color,
  totalArguments,
  subClusters,
  sampleArguments,
  isSelected,
  onSelect,
}: ClusterCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const ratio =
    totalArguments > 0 ? Math.round((cluster.value / totalArguments) * 100) : 0;

  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden",
        isSelected && "shadow-md bg-primary-weak/30"
      )}
    >
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onSelect}
          className="w-full text-left"
          aria-pressed={isSelected}
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-2 h-4 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg leading-relaxed break-words">
                {cluster.label}
              </CardTitle>
              <p className="flex items-center text-sm text-muted-foreground mt-1">
                <MessageSquareText className="h-4 w-4 mr-1 text-primary" />
                {cluster.value.toLocaleString()}件（{ratio}%）
              </p>
            </div>
          </div>
        </button>
        <div className="h-[2px] bg-gray-300 w-full my-3" />
        <p className="text-base text-foreground break-words">
          {cluster.takeaway}
        </p>

        {(subClusters.length > 0 || sampleArguments.length > 0) && (
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="mt-4 flex items-center text-md-bold text-primary-700 hover:text-primary-900"
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <ChevronUp className="h-5 w-5 mr-1" />
            ) : (
              <ChevronDown className="h-5 w-5 mr-1" />
            )}
            {isOpen ? "閉じる" : "詳しく見る"}
          </button>
        )}

        {isOpen && (
          <div className="mt-4 space-y-6">
            {subClusters.length > 0 && (
              <section>
                <h4 className="text-md-bold text-foreground mb-2">
                  小さな意見グループ
                </h4>
                <ul className="space-y-3">
                  {subClusters.map((sub) => (
                    <li
                      key={sub.id}
                      className="rounded-lg bg-secondary-weak p-3"
                    >
                      <p className="text-md-bold break-words">
                        {sub.label}
                        <span className="ml-2 text-sm text-muted-foreground">
                          {sub.value.toLocaleString()}件
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground break-words">
                        {sub.takeaway}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {sampleArguments.length > 0 && (
              <section>
                <h4 className="text-md-bold text-foreground mb-2">
                  寄せられた意見（抜粋）
                </h4>
                <ul className="space-y-2">
                  {sampleArguments.map((arg) => (
                    <li
                      key={arg.arg_id}
                      className="border-l-4 pl-3 text-sm break-words"
                      style={{ borderColor: color }}
                    >
                      {arg.argument}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClusterCard;
