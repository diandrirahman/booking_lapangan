import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    id: string;
    auth?: {
      sessionId: string;
      userId: string;
    };
    sessionStoreUnavailable?: boolean;
  }
}
