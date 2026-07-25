import { Eye, EyeOff } from "lucide-react";

type PasswordInputType = "password" | "text";

/**
 * Icon for password visibility toggle: Eye when masked, EyeOff when revealed.
 */
export function PasswordVisibilityIcon({
  inputType,
  className = "h-4 w-4",
}: {
  inputType: PasswordInputType;
  className?: string;
}) {
  return inputType === "password" ? (
    <Eye className={className} aria-hidden />
  ) : (
    <EyeOff className={className} aria-hidden />
  );
}

export function passwordInputTypeFromVisible(visible: boolean): PasswordInputType {
  return visible ? "text" : "password";
}
