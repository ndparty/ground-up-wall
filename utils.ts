import { createDefine } from "fresh";

export interface State {
  [key: string]: unknown;
}

export const define = createDefine<State>();
