declare namespace Express {
  interface Request {
    user?: {
      id: number;
      role: string;
      employeeId?: number;
      email: string;
    };
  }
}
