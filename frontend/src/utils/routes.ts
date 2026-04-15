export function getPageTitle(pathname: string) {
  if (pathname === "/analytics") return "Analytics";
  if (pathname === "/departments") return "Departments";
  if (pathname === "/employees") return "Employees";
  if (pathname.startsWith("/employees/")) return "Employee Profile";
  if (pathname === "/calendar") return "Calendar";
  if (pathname === "/attendance") return "Attendance";
  if (pathname === "/leaves") return "Leaves";
  if (pathname === "/team") return "Team";
  if (pathname === "/payroll") return "Payroll";
  return "Home";
}
