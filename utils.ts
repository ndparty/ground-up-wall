import { createDefine } from "fresh";
import type { AppState } from "./lib/di.ts";
import type { AuthUser } from "./lib/services/auth_service.ts";

export interface State {
  services: AppState;
  user: AuthUser | null;
  cspNonce?: string;
}

export const define = createDefine<State>();
