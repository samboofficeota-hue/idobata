import { User } from "lucide-react";

interface OtherOpinionCardProps {
  text: string;
  userName: string;
  userIconColor: "red" | "blue" | "yellow" | "green";
  debatePoint?: string; // 論点タイトルを追加
}

const OtherOpinionCard = ({
  text,
  userName,
  userIconColor,
  debatePoint,
}: OtherOpinionCardProps) => {
  const getUserIconStyles = () => {
    switch (userIconColor) {
      case "red":
        return "bg-red-50 text-red-300";
      case "blue":
        return "bg-blue-50 text-blue-300";
      case "yellow":
        return "bg-yellow-50 text-yellow-400";
      case "green":
        return "bg-green-50 text-green-300";
      default:
        return "bg-gray-50 text-gray-300";
    }
  };

  return (
    <div className="bg-white border border-black/16 rounded-2xl p-5 flex flex-col gap-2.5 relative w-full md:w-[calc(50%-8px)]">
      <div className="absolute -top-3 left-0">
        <div className="bg-blue-100 border border-blue-200 text-blue-700 rounded-full px-3 py-0 flex items-center justify-center gap-1">
          <span className="text-xs font-normal leading-8 tracking-wide">
            {debatePoint || "論点"}
          </span>
        </div>
      </div>
      <p className="text-base font-normal text-gray-800 leading-8 tracking-wide">
        {text}
      </p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 border border-black/36 rounded-full flex items-center justify-center">
          <div
            className={`w-8 h-8 ${getUserIconStyles()} rounded-full flex items-center justify-center`}
          >
            <User className="w-6 h-6 stroke-2" />
          </div>
        </div>
        <span className="text-base font-bold text-gray-800 leading-8 tracking-wide">
          {userName}
        </span>
      </div>
    </div>
  );
};

export default OtherOpinionCard;
