import { Check } from 'lucide-react';

type ShipmentProgressStep = {
  label: string;
  done: boolean;
};

export function ShipmentProgress({ steps }: { steps: ShipmentProgressStep[] }) {
  const completed = steps.filter((step) => step.done).length;
  const allDone = completed === steps.length;
  const currentIndex = allDone ? steps.length - 1 : Math.max(0, steps.findIndex((step) => !step.done));
  const progress = steps.length ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <section className="border-t pt-4" aria-labelledby="shipment-progress-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="shipment-progress-title" className="text-sm font-semibold">處理進度</h2>
          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
            {allDone ? '這批商品已完成收貨' : `下一步：${steps[currentIndex]?.label}`}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tabular-nums text-primary">
          {completed}/{steps.length}
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className="shipment-progress-bar block h-full origin-left rounded-full bg-primary motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="mt-5 grid gap-4 sm:grid-cols-4">
        {steps.map((step, index) => {
          const active = !allDone && index === currentIndex;
          return (
            <li key={step.label} className="relative flex items-center gap-3 sm:block">
              {index < steps.length - 1 ? (
                <span className="absolute left-3 top-7 h-[calc(100%+8px)] w-px bg-border sm:left-7 sm:right-[-1rem] sm:top-3 sm:h-px sm:w-auto" aria-hidden>
                  {step.done ? <span className="shipment-progress-line block h-full w-full origin-top bg-primary sm:origin-left" /> : null}
                </span>
              ) : null}
              <span
                className={`relative z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                  step.done
                    ? 'shipment-progress-check border-primary bg-primary text-primary-foreground'
                    : active
                      ? 'shipment-progress-active border-primary bg-card text-primary'
                      : 'border-border bg-card text-muted-foreground'
                }`}
                style={{ animationDelay: `${index * 90}ms` }}
                aria-current={active ? 'step' : undefined}
              >
                {step.done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : <span className="h-2 w-2 rounded-full bg-current" />}
              </span>
              <span className={`text-sm font-medium sm:mt-2 sm:block ${step.done || active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
