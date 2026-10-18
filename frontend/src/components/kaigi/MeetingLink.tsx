import { Video } from "lucide-react";
import type { KaigiMeeting } from "../../services/kaigi/types";
import { Button } from "../ui/button";

// ホストが Google カレンダーに登録した会議（Google Meet）への入口
export const formatMeetingTime = (meeting: KaigiMeeting) => {
  if (!meeting.startAt) return "";
  const start = new Date(meeting.startAt);
  const date = start.toLocaleString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!meeting.endAt) return date;
  const end = new Date(meeting.endAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}〜${end}`;
};

const MeetingLink = ({ meeting }: { meeting: KaigiMeeting }) => (
  <div className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-300 bg-neutral-50 px-4 py-3">
    <div className="flex-1 text-sm">
      <p className="font-bold">話し合い（Google Meet）</p>
      {meeting.startAt && (
        <p className="text-neutral-600">{formatMeetingTime(meeting)}</p>
      )}
    </div>
    <Button asChild size="sm" variant="outline" className="gap-1">
      <a href={meeting.meetUrl} target="_blank" rel="noopener noreferrer">
        <Video className="h-4 w-4" />
        Meet に参加する
      </a>
    </Button>
  </div>
);

export default MeetingLink;
