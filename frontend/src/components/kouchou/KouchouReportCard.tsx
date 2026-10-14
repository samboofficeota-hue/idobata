import { ArrowRight, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import type { KouchouReport } from "../../services/kouchou/types";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardTitle } from "../ui/card";

interface KouchouReportCardProps {
  report: KouchouReport;
}

const formatDate = (iso?: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const KouchouReportCard = ({ report }: KouchouReportCardProps) => {
  const createdAt = formatDate(report.createdAt);

  return (
    <Link
      to={`/kouchou/${encodeURIComponent(report.slug)}`}
      className="block min-w-0"
    >
      <Card className="hover:shadow-md transition-all duration-200 hover:border-primary-700/50 min-w-0 overflow-hidden">
        <CardContent className="pt-4 min-w-0">
          <CardTitle className="text-lg mb-2 break-words">
            {report.title}
          </CardTitle>
          <div className="h-[2px] bg-gray-300 w-full my-2" />
          <p className="text-base text-muted-foreground mb-4 break-words line-clamp-3">
            {report.description}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between items-center pt-0">
          <div className="flex text-sm sm:text-base text-muted-foreground">
            {createdAt && (
              <span className="flex items-center">
                <CalendarDays className="h-4 w-4 mr-1 text-primary" />
                {createdAt}
              </span>
            )}
          </div>
          <Button className="px-3" aria-label={`${report.title}を見る`}>
            <ArrowRight className="h-5 w-5" />
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default KouchouReportCard;
