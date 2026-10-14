import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BreadcrumbView from "../components/common/BreadcrumbView";
import SectionHeading from "../components/common/SectionHeading";
import KaigiPasswordDialog from "../components/kaigi/KaigiPasswordDialog";
import { Button } from "../components/ui/button";
import { storedHostPassword } from "../services/kaigi/kaigiApi";

const STEPS = [
  {
    title: "ひとりで、20分で考えを練り上げる",
    body: "お題に対して、AIのファシリテーターと3人のAIメンバーを相手に、自分の考えを掘り下げます。人の目を気にせず、最後まで考え切れます。",
  },
  {
    title: "対象領域・課題・解決策を、一つのストーリーに",
    body: "ダブルダイヤモンドの考え方で、問題を見つけてから解決策を考え、行ったり来たりしながら、自分の提案を1枚のスライドにまとめます。",
  },
  {
    title: "壁に貼り出して、人どうしで話し合う",
    body: "みんなの提案が会議室の壁に並びます。それを見ながら、人どうしで話し合います。",
  },
];

const KaigiTop = () => {
  const navigate = useNavigate();
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  const handleCreate = () => {
    if (storedHostPassword.get()) navigate("/kaigi/new");
    else setIsPasswordOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl">
        <BreadcrumbView items={[{ label: "いどばた会議室", href: "/kaigi" }]} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading title="いどばた会議室" className="mb-0" />
          <Button onClick={handleCreate} className="gap-1">
            <Plus className="h-5 w-5" />
            お題をつくる
          </Button>
        </div>
        <KaigiPasswordDialog
          open={isPasswordOpen}
          onOpenChange={setIsPasswordOpen}
          onVerified={() => navigate("/kaigi/new")}
        />
        <p className="mt-3 mb-8 text-base text-neutral-600">
          意見がまとまらないうちに話し合うと、声の大きい人の意見が通りがちです。
          いどばた会議室では、まず一人ひとりが自分の提案を練り上げてから、それを並べて話し合います。
        </p>

        <ol className="mb-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-[16px] border-2 border-[#2D80FF] bg-white p-5"
            >
              <p className="text-sm font-bold text-primary-700">STEP {i + 1}</p>
              <h3 className="mt-1 text-lg font-bold leading-snug">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="rounded-md bg-neutral-50 p-4 text-sm text-neutral-700">
          <p className="font-bold">参加する方へ</p>
          <p className="mt-1">
            お題をつくった人（ホスト）から共有されたURLを開いてください。会議の冒頭でやるか、事前にやっておくかは、ホストの案内に従ってください。
          </p>
        </div>
      </div>
    </div>
  );
};

export default KaigiTop;
