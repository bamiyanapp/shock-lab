import { describe, expect, it } from "vitest";
import { encodeSharedConfig, decodeSharedConfig, buildShareUrl } from "./urlConfig";
import { VEHICLE_PRESETS } from "./vehiclePresets";

const vehicle = VEHICLE_PRESETS[0].config;
const testConditions = { speed: 12, bumpHeight: 0.2, slopeAngle: 5, terrainType: "largeBump" as const };

describe("encodeSharedConfig / decodeSharedConfig", () => {
  it("round-trips vehicle and testConditions through encode/decode", () => {
    const encoded = encodeSharedConfig(vehicle, testConditions);
    const decoded = decodeSharedConfig(encoded);

    expect(decoded).toEqual({ vehicle, testConditions });
  });

  it("returns null for a value that is not valid base64/JSON", () => {
    expect(decodeSharedConfig("not-valid-base64!!!")).toBeNull();
  });

  it("returns null for valid JSON that is missing the expected shape", () => {
    const encoded = btoa(encodeURIComponent(JSON.stringify({ foo: "bar" })));
    expect(decodeSharedConfig(encoded)).toBeNull();
  });
});

describe("buildShareUrl", () => {
  it("builds a URL whose config query param decodes back to the given config", () => {
    const url = new URL(buildShareUrl(vehicle, testConditions));
    const encoded = url.searchParams.get("config");
    expect(encoded).not.toBeNull();
    expect(decodeSharedConfig(encoded as string)).toEqual({ vehicle, testConditions });
  });
});
