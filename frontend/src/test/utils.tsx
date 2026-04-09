import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";

export function renderWithRouter(ui: ReactElement, route = "/") {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

export function renderWithRoute(ui: ReactElement, options: { route: string; path: string }) {
  return render(
    <MemoryRouter initialEntries={[options.route]}>
      <Routes>
        <Route path={options.path} element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}
