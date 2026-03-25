import "./Button.css";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "icon";
  children: ReactNode;
};

export default function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const classes = [
    variant === "secondary" ? "secondary" : "",
    variant === "icon" ? "icon-button" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...props} className={classes}>
      {children}
    </button>
  );
}
