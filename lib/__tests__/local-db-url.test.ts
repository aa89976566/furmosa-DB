import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkLocalDbUrl } from "@/lib/local-db-url";

describe("checkLocalDbUrl", () => {
  it("accepts local docker postgres on 55432", () => {
    assert.equal(
      checkLocalDbUrl("postgresql://postgres:postgres@127.0.0.1:55432/furmosa").ok,
      true,
    );
    assert.equal(
      checkLocalDbUrl("postgresql://postgres:postgres@localhost:55432/furmosa").ok,
      true,
    );
  });

  it("rejects missing, invalid, cloud, and wrong port urls", () => {
    assert.equal(checkLocalDbUrl(undefined).ok, false);
    assert.equal(checkLocalDbUrl("not-a-url").ok, false);
    assert.equal(
      checkLocalDbUrl(
        "postgresql://postgres:x@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres",
      ).ok,
      false,
    );
    assert.equal(
      checkLocalDbUrl("postgresql://postgres:postgres@127.0.0.1:5432/furmosa").ok,
      false,
    );
  });
});
