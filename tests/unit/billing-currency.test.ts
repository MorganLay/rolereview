import { describe, expect, it } from "vitest";

import { resolvePlanCurrency } from "@/features/billing/currency";

describe("resolvePlanCurrency", () => {
  it("keeps a saved choice ahead of the country", () => {
    expect(resolvePlanCurrency({ cookie: "usd", country: "CA" })).toBe("USD");
    expect(resolvePlanCurrency({ cookie: "CAD", country: "US" })).toBe("CAD");
  });

  it("defaults Canada to CAD and every other country to USD", () => {
    expect(resolvePlanCurrency({ cookie: null, country: "CA" })).toBe("CAD");
    expect(resolvePlanCurrency({ cookie: null, country: "ca" })).toBe("CAD");
    expect(resolvePlanCurrency({ cookie: null, country: "US" })).toBe("USD");
    expect(resolvePlanCurrency({ cookie: null, country: "GB" })).toBe("USD");
    expect(resolvePlanCurrency({ cookie: null, country: null })).toBe("USD");
    expect(resolvePlanCurrency({ cookie: "EUR", country: "CA" })).toBe("CAD");
  });
});
