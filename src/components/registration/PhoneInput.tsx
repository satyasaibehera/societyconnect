import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const COUNTRY_CODES = [
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+65", label: "🇸🇬 +65" },
  { code: "+966", label: "🇸🇦 +966" },
  { code: "+86", label: "🇨🇳 +86" },
  { code: "+81", label: "🇯🇵 +81" },
  { code: "+49", label: "🇩🇪 +49" },
  { code: "+33", label: "🇫🇷 +33" },
  { code: "+27", label: "🇿🇦 +27" },
  { code: "+234", label: "🇳🇬 +234" },
  { code: "+92", label: "🇵🇰 +92" },
  { code: "+880", label: "🇧🇩 +880" },
];

interface PhoneInputProps {
  countryCode: string;
  number: string;
  onCountryChange: (code: string) => void;
  onNumberChange: (number: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PhoneInput({ countryCode, number, onCountryChange, onNumberChange, disabled, placeholder }: PhoneInputProps) {
  return (
    <div className="flex gap-2">
      <Select value={countryCode} onValueChange={onCountryChange} disabled={disabled}>
        <SelectTrigger className="w-[120px] shrink-0"><SelectValue /></SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        inputMode="numeric"
        value={number}
        disabled={disabled}
        onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder ?? "9876543210"}
        className="flex-1"
      />
    </div>
  );
}

export function fullPhone(countryCode: string, number: string): string {
  return `${countryCode}${number}`;
}