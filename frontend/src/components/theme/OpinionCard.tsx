import { Heart } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { useLike } from "../../hooks/useLike";

interface OpinionCardProps {
  id: string;
  text: string;
  type: "issue" | "solution";
}

const OpinionCard = ({ id, text, type }: OpinionCardProps) => {
  const targetType = type === "issue" ? "problem" : "solution";
  const { isLiked, likeCount, toggleLike } = useLike(targetType, id);

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleLike();
  };

  return (
    <Card className="hover:shadow-md transition-all duration-200 hover:border-primary-700">
      <CardContent className="p-4">
        <p className="text-base text-foreground mb-3">{text}</p>
        <div className="flex items-center gap-3">
          <button
            className={`flex items-center transition-colors ${
              isLiked
                ? "text-red-500 hover:text-red-600"
                : "hover:text-primary-600 text-muted-foreground"
            }`}
            onClick={handleLikeClick}
            type="button"
          >
            <Heart
              className={`h-4 w-4 mr-1 ${isLiked ? "fill-current" : ""}`}
            />
            共感する: {likeCount}
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OpinionCard;
