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

describe("decodeSharedConfig with broken values (issue #446)", () => {
  const encodeRaw = (value: unknown) => btoa(encodeURIComponent(JSON.stringify(value)));

  it("sanitizes missing fields, out-of-range numbers and unknown terrain types without throwing", () => {
    const decoded = decodeSharedConfig(
      encodeRaw({
        vehicle: { body: { weightKg: 0 }, suspension: { springConstant: "x" } },
        testConditions: { speed: 9999, terrainType: "x" },
      })
    );
    expect(decoded?.vehicle.body.weightKg).toBe(500);
    expect(decoded?.vehicle.suspension.springConstant).toBe(vehicle.suspension.springConstant);
    expect(decoded?.vehicle.tire).toEqual(vehicle.tire);
    expect(decoded?.testConditions.speed).toBe(30);
    expect(decoded?.testConditions.terrainType).toBe("smallBump");
  });

  it("returns null when vehicle or testConditions is not an object", () => {
    expect(decodeSharedConfig(encodeRaw({ vehicle: 1, testConditions: {} }))).toBeNull();
    expect(decodeSharedConfig(encodeRaw({ vehicle: {}, testConditions: null }))).toBeNull();
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
