import { describe, expect, it } from "vitest";
import { initialState } from "../data/fixtures";
import { selectVenueSetup } from "./selectors";

describe("venue setup completeness", () => {
  it("menghitung kelengkapan dari entity aktual", () => {
    const complete = selectVenueSetup(initialState, "v1");
    expect(complete.canSubmit).toBe(true);

    const incompleteState = {
      ...initialState,
      venueDrafts: {
        ...initialState.venueDrafts,
        v1: { ...initialState.venueDrafts.v1, policies: [] },
      },
    };
    const incomplete = selectVenueSetup(incompleteState, "v1");
    expect(incomplete.canSubmit).toBe(false);
    expect(incomplete.steps.policies).toBe(false);
  });
});
