import { PosLoginForm } from "./login-form";

export const metadata = {
  title: "店家登入 · Furmosa",
};

export default function PosLoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-8 text-left">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
            Furmosa POS
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            店家登入
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            使用總部提供的店家帳號進入工作台
          </p>
        </div>
      </div>
      <PosLoginForm next={searchParams.next} />
      <p className="mt-6 text-left text-xs text-muted-foreground">
        問題請聯繫 Furmosa 總部
      </p>
    </div>
  );
}
