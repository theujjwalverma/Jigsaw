import { beforeEach, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { useImageAspectRatio } from "../../src/hooks/useImageAspectRatio";

const state = vi.hoisted(() => ({ value: {}, images: [] }));
vi.mock("react", () => ({
  useState: () => [state.value, (value) => { state.value = value; }],
  useEffect: vi.fn(),
}));

beforeEach(() => {
  state.value = {};
  state.images = [];
  vi.clearAllMocks();
  vi.stubGlobal("Image", class {
    constructor() { state.images.push(this); }
  });
});

it.each([[1200, 600, 2], [600, 1200, 0.5], [600, 600, 1]])(
  "reads intrinsic image dimensions %s x %s",
  (naturalWidth, naturalHeight, expected) => {
    expect(useImageAspectRatio("/image.png").imageAspectRatio).toBeNull();
    useEffect.mock.calls[0][0]();
    const image = state.images[0];
    expect(image.src).toBe("/image.png");
    Object.assign(image, { naturalWidth, naturalHeight });
    image.onload();
    expect(useImageAspectRatio("/image.png")).toEqual({ imageAspectRatio: expected, imageError: "" });
    expect(useImageAspectRatio("/new-image.png").imageAspectRatio).toBeNull();
  },
);

it("reports image load errors and ignores cancelled image loads", () => {
  useImageAspectRatio("/broken.png");
  const cleanup = useEffect.mock.calls[0][0]();
  const image = state.images[0];
  image.onerror();
  expect(useImageAspectRatio("/broken.png").imageError).toContain("Unable to load");
  const loaded = image.onload;
  const failed = image.onerror;
  cleanup();
  Object.assign(image, { naturalWidth: 1200, naturalHeight: 600 });
  loaded();
  failed();
  expect(state.value.error).toContain("Unable to load");
});

it("does not try to load an absent URL and reports invalid dimensions", () => {
  useImageAspectRatio(undefined);
  expect(useEffect.mock.calls[0][0]()).toBeUndefined();
  expect(state.images).toHaveLength(0);
  useImageAspectRatio("/empty.png");
  useEffect.mock.calls[1][0]();
  Object.assign(state.images[0], { naturalWidth: 0, naturalHeight: 0 });
  state.images[0].onload();
  expect(useImageAspectRatio("/empty.png").imageError).toContain("dimensions");
});
