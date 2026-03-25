declare namespace Express {
  interface Request {
    file?: Multer.File;
    user?: {
      id: number;
      role: string;
      employeeId?: number;
      email: string;
    };
  }
}
