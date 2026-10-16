import type { UserDTO } from "../domain/contracts";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user: UserDTO | null;
      sessionToken: string | null;
    }
  }
}

export {};
