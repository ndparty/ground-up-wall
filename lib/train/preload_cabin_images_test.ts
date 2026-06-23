import { assertEquals } from "@std/assert";
import type { TrainCabinNode } from "./chain.ts";
import {
  cabinsAroundTargetWithBuffer,
  cabinsForJumpPreload,
  cabinsForShortJumpPreload,
  imageUrlsForCanonicalPath,
  imageUrlsForJumpPath,
  imageUrlsForJumpPreload,
} from "./preload_cabin_images.ts";
import type { Submission } from "../types.ts";

function makeNode(cabin: number): TrainCabinNode {
  const submission: Submission = {
    id: `sub-${cabin}`,
    image_url: `/img/cabin-${cabin}.jpg`,
    message: "",
    submitter_name: "",
    social_handle: "",
    status: "approved",
    source: "test",
    is_flagged: false,
    edit_count: 0,
    created_at: new Date().toISOString(),
  };
  return {
    submission,
    index: cabin - 1,
    next: null,
    prev: null,
  };
}

Deno.test("imageUrlsForJumpPath maps cabins in path order without duplicates", () => {
  const nodes = Array.from({ length: 5 }, (_, i) => makeNode(i + 1));
  nodes[3]!.submission.image_url = "/img/shared.jpg";

  const urls = imageUrlsForJumpPath([1, 2, 3, 4, 5], nodes);
  assertEquals(urls, [
    "/img/cabin-1.jpg",
    "/img/cabin-2.jpg",
    "/img/cabin-3.jpg",
    "/img/shared.jpg",
    "/img/cabin-5.jpg",
  ]);
});

Deno.test("imageUrlsForJumpPath skips missing cabins", () => {
  const nodes = [makeNode(1), makeNode(2)];
  assertEquals(imageUrlsForJumpPath([1, 99, 2], nodes), [
    "/img/cabin-1.jpg",
    "/img/cabin-2.jpg",
  ]);
});

Deno.test("imageUrlsForCanonicalPath maps cabins in path order without duplicates", () => {
  const canonical = Array.from({ length: 5 }, (_, i) => makeNode(i + 1).submission);
  canonical[3]!.image_url = "/img/shared.jpg";

  const urls = imageUrlsForCanonicalPath([1, 2, 3, 4, 5], canonical);
  assertEquals(urls, [
    "/img/cabin-1.jpg",
    "/img/cabin-2.jpg",
    "/img/cabin-3.jpg",
    "/img/shared.jpg",
    "/img/cabin-5.jpg",
  ]);
});

Deno.test("cabinsForJumpPreload appends K ring slots after target", () => {
  const path = [8, 9, 10, 11, 12, 16, 17, 18, 19, 20];
  assertEquals(cabinsForJumpPreload(path, 20, 40, 4), [
    8,
    9,
    10,
    11,
    12,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
  ]);
});

Deno.test("cabinsAroundTargetWithBuffer covers target window with preload tail", () => {
  assertEquals(cabinsAroundTargetWithBuffer(9, 10, 2, 2), [7, 8, 9, 10, 1, 2, 3]);
});

Deno.test("cabinsForShortJumpPreload is sequential center to target plus RIGHT_RENDER after", () => {
  assertEquals(cabinsForShortJumpPreload(1, 4, 10), [1, 2, 3, 4, 5, 6, 7, 8]);
});

Deno.test("imageUrlsForJumpPreload includes ephemeral overlay submission", () => {
  const canonical = Array.from({ length: 5 }, (_, i) => makeNode(i + 1).submission);
  canonical.push({
    ...makeNode(99).submission,
    id: "preview-1",
    image_url: "/img/preview.jpg",
  });
  const overlay = [
    { seq: 1, kind: "post" as const, submissionId: "sub-1" },
    { seq: 99, kind: "post" as const, submissionId: "preview-1" },
  ];
  const urls = imageUrlsForJumpPreload([2, 3], overlay, canonical);
  assertEquals(urls.includes("/img/preview.jpg"), true);
  assertEquals(urls.includes("/img/cabin-2.jpg"), true);
});
