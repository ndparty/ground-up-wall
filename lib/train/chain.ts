import type { Submission } from "../types.ts";

export interface TrainCabinNode {
  submission: Submission;
  index: number;
  next: TrainCabinNode | null;
  prev: TrainCabinNode | null;
}

export interface TrainChain {
  nodes: TrainCabinNode[];
  head: TrainCabinNode | null;
  current: TrainCabinNode | null;
}

function linkCircular(nodes: TrainCabinNode[]): void {
  if (nodes.length === 0) return;
  if (nodes.length === 1) {
    nodes[0].next = nodes[0];
    nodes[0].prev = nodes[0];
    return;
  }
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].index = i;
    nodes[i].next = nodes[(i + 1) % nodes.length];
    nodes[i].prev = nodes[(i - 1 + nodes.length) % nodes.length];
  }
}

export function initTrain(submissions: Submission[]): TrainChain {
  const nodes: TrainCabinNode[] = submissions.map((submission, index) => ({
    submission,
    index,
    next: null,
    prev: null,
  }));
  linkCircular(nodes);
  return {
    nodes,
    head: nodes[0] ?? null,
    current: nodes[0] ?? null,
  };
}

export function cloneChain(chain: TrainChain): TrainChain {
  const rebuilt = initTrain(chain.nodes.map((n) => n.submission));
  if (chain.current) {
    const preserved = rebuilt.nodes.find((n) => n.submission.id === chain.current!.submission.id);
    rebuilt.current = preserved ?? rebuilt.head;
  }
  return rebuilt;
}

export function getNodeByCabinNumber(
  chain: TrainChain,
  cabinNumber: number,
): TrainCabinNode | null {
  if (chain.nodes.length === 0) return null;
  const zeroBased = Math.max(0, Math.min(chain.nodes.length - 1, cabinNumber - 1));
  return chain.nodes[zeroBased] ?? null;
}

export function rebuildChain(chain: TrainChain, submissions: Submission[]): void {
  const currentId = chain.current?.submission.id;
  const fresh = initTrain(submissions);
  chain.nodes = fresh.nodes;
  chain.head = fresh.head;
  if (currentId && fresh.nodes.length > 0) {
    chain.current = fresh.nodes.find((n) => n.submission.id === currentId) ?? fresh.head;
  } else {
    chain.current = fresh.head;
  }
}

export function transitionToNext(chain: TrainChain): TrainCabinNode | null {
  if (!chain.current || chain.nodes.length === 0) return null;
  chain.current = chain.current.next;
  return chain.current;
}

export function addSubmission(chain: TrainChain, submission: Submission): void {
  if (chain.nodes.some((n) => n.submission.id === submission.id)) return;

  const node: TrainCabinNode = {
    submission,
    index: chain.nodes.length,
    next: null,
    prev: null,
  };

  if (chain.nodes.length === 0) {
    chain.nodes.push(node);
    linkCircular(chain.nodes);
    chain.head = node;
    chain.current = node;
    return;
  }

  const tail = chain.head!.prev!;
  node.prev = tail;
  node.next = chain.head;
  tail.next = node;
  chain.head!.prev = node;
  chain.nodes.push(node);
}

export function updateSubmission(chain: TrainChain, submission: Submission): void {
  const node = chain.nodes.find((n) => n.submission.id === submission.id);
  if (node) node.submission = submission;
}

export function removeSubmission(chain: TrainChain, submissionId: string): void {
  const idx = chain.nodes.findIndex((n) => n.submission.id === submissionId);
  if (idx === -1) return;

  const node = chain.nodes[idx];
  const wasCurrent = chain.current === node;
  const nextNode = node.next;

  if (chain.nodes.length === 1) {
    chain.nodes = [];
    chain.head = null;
    chain.current = null;
    return;
  }

  node.prev!.next = node.next;
  node.next!.prev = node.prev;
  chain.nodes.splice(idx, 1);
  chain.nodes.forEach((n, i) => {
    n.index = i;
  });
  chain.head = chain.nodes[0] ?? null;

  if (wasCurrent) {
    chain.current = nextNode === node
      ? chain.head
      : (chain.nodes.includes(nextNode!) ? nextNode : chain.head);
  }
}
