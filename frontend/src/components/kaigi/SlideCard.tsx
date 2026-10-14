import type { KaigiSlideContent } from "../../services/kaigi/types";
import { OUTPUT_KEYS, OUTPUT_LABELS } from "./labels";

interface SlideCardProps {
  slide: KaigiSlideContent;
  nickname: string;
}

// 壁に貼る1枚の提案スライド
const SlideCard = ({ slide, nickname }: SlideCardProps) => (
  <article className="flex h-full flex-col rounded-[16px] border-2 border-[#2D80FF] bg-white p-5">
    <p className="text-sm text-neutral-500">{nickname} さんの提案</p>
    <h3 className="mt-1 text-xl font-bold leading-snug">{slide.title}</h3>
    <dl className="mt-4 space-y-3 text-sm">
      {OUTPUT_KEYS.map((key) => (
        <div key={key}>
          <dt className="text-xs font-bold text-primary-700">
            {OUTPUT_LABELS[key]}
          </dt>
          <dd className="mt-0.5 leading-relaxed">{slide[key]}</dd>
        </div>
      ))}
    </dl>
    {slide.summary && (
      <p className="mt-4 border-t pt-3 text-sm leading-relaxed text-neutral-700">
        {slide.summary}
      </p>
    )}
    {slide.tags.length > 0 && (
      <ul className="mt-auto flex flex-wrap gap-2 pt-4">
        {slide.tags.map((tag) => (
          <li
            key={tag}
            className="rounded-full bg-primary-50 px-3 py-1 text-xs text-primary-700"
          >
            #{tag}
          </li>
        ))}
      </ul>
    )}
  </article>
);

export default SlideCard;
