import { buildIlikeOrFilter } from "@/lib/supabase-search";

describe("buildIlikeOrFilter", () => {
  it("keeps a plain alphanumeric term readable", () => {
    expect(buildIlikeOrFilter(["name"], "jago")).toBe("name.ilike.%jago%");
  });

  it("joins multiple columns with commas", () => {
    expect(buildIlikeOrFilter(["a", "b", "c"], "x")).toBe(
      "a.ilike.%x%,b.ilike.%x%,c.ilike.%x%"
    );
  });

  it("encodes commas inside the term so they can never start a new or() condition", () => {
    // A raw comma would split the expression into a second condition
    // (e.g. `...%,status.eq.PAID`). It must survive only as %2C inside the
    // value; the only raw commas allowed are the intended column separators.
    const filter = buildIlikeOrFilter(["order_number", "customer_name"], "x,status.eq.PAID");
    expect(filter).toBe(
      "order_number.ilike.%x%2Cstatus.eq.PAID%,customer_name.ilike.%x%2Cstatus.eq.PAID%"
    );
  });

  it("neutralizes logical-operator prefixes even when combined with commas", () => {
    // `not.foo,bar` would parse as `not.` + a second condition if the comma
    // survived; the comma is encoded so `not.foo` stays a literal substring.
    expect(buildIlikeOrFilter(["name"], "not.foo,bar")).toBe("name.ilike.%not.foo%2Cbar%");
  });

  it("encodes double quotes and percent signs in the term", () => {
    // Double quotes would start a quoted-value token; percent would widen the
    // LIKE pattern. Apostrophes stay raw (harmless in value position).
    expect(buildIlikeOrFilter(["name"], `a"b'c%d`)).toBe("name.ilike.%a%22b'c%25d%");
  });

  it("encodes in-list style syntax so it can never start a nested expression", () => {
    // `in.(x,y)` would be parsed as a logical group by PostgREST if the parens
    // and comma survived; all three are encoded into the value.
    expect(buildIlikeOrFilter(["name"], "in.(x,y)")).toBe("name.ilike.%in.%28x%2Cy%29%");
  });

  it("encodes parens anywhere in the term", () => {
    expect(buildIlikeOrFilter(["name"], "(a)b")).toBe("name.ilike.%%28a%29b%");
  });
});
