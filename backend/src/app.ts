import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./modules/auth/routes.js";
import attendanceRoutes from "./modules/attendance/routes.js";
import dashboardRoutes from "./modules/dashboard/routes.js";
import calendarRoutes from "./modules/calendar/routes.js";
import departmentsRoutes from "./modules/departments/routes.js";
import employeesRoutes from "./modules/employees/routes.js";
import leaveRoutes from "./modules/leaves/routes.js";
import payrollRoutes from "./modules/payroll/routes.js";
import announcementRoutes from "./modules/announcements/routes.js";

export const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
  }),
);

app.get("/api/health", (_request, response) => {
  response.json({
    success: true,
    message: "HRMS API is healthy",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/announcements", announcementRoutes);

app.use(notFound);
app.use(errorHandler);
