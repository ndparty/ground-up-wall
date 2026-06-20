import { assertEquals } from "@std/assert";
import type { TrainCabinNode } from "./chain.ts";
import { cabinsForJumpPreload, imageUrlsForJumpPath } from "./preload_cabin_images.ts";
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

Deno.test("cabinsForJumpPreload appends K ring slots after target", () => {
  const path = [8, 9, 10, 11, 12, 16, 17, 18, 19, 20];
  assertEquals(cabinsForJumpPreload(path, 20, 40), [
    8, 9, 10, 11, 12, 16, 17, 18, 19, 20, 21, 22, 23, 24,
  ]);
});
