"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { posLoginAction, type PosLoginState } from "./actions";

const initialState: PosLoginState = {};

export function PosLoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState(posLoginAction, initialState);

  return (
    <Card className="shadow-card">
      <CardContent className="p-5 sm:p-7">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium">
              帳號
            </label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              defaultValue={state.values?.username ?? ""}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              密碼
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11"
            />
          </div>
          {state.error ? (
            <p className="border-l-4 border-foreground bg-muted px-3 py-3 text-sm text-foreground">
              {state.error}
            </p>
          ) : null}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="min-h-[48px] w-full rounded-xl"
      disabled={pending}
    >
      {pending ? "登入中…" : "登入"}
    </Button>
  );
}
