import { forwardRef } from "react";
import { format } from "date-fns";

interface RentReceiptData {
  receipt_number: string;
  owner_name: string;
  tenant_name: string;
  amount: number;
  period_label: string | null;
  payment_date: string;
  issued_at: string;
  notes: string | null;
  unit_label?: string;
  building_name?: string;
}

interface Props {
  receipt: RentReceiptData;
}

const RentReceiptTemplate = forwardRef<HTMLDivElement, Props>(({ receipt }, ref) => {
  const amountInWords = numberToWords(receipt.amount);

  return (
    <div ref={ref} className="bg-white text-black p-8 max-w-2xl mx-auto font-serif" style={{ minHeight: 500 }}>
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold tracking-wide uppercase">Rent Receipt</h1>
        <p className="text-sm text-gray-600 mt-1">Receipt No: <span className="font-semibold">{receipt.receipt_number}</span></p>
      </div>

      {/* Date */}
      <div className="text-right mb-6">
        <p className="text-sm">
          Date: <span className="font-semibold underline">{format(new Date(receipt.issued_at), "dd MMMM yyyy")}</span>
        </p>
      </div>

      {/* Body */}
      <div className="space-y-4 text-base leading-relaxed mb-8">
        <p>
          Received a sum of <span className="font-bold">₹{receipt.amount.toLocaleString("en-IN")}</span>{" "}
          (<span className="italic">{amountInWords} only</span>) from{" "}
          <span className="font-bold underline">{receipt.tenant_name}</span>{" "}
          towards rent for the period of{" "}
          <span className="font-bold underline">{receipt.period_label || "—"}</span>.
        </p>

        {(receipt.unit_label || receipt.building_name) && (
          <p>
            For the premises at{" "}
            <span className="font-semibold">
              {[receipt.building_name, receipt.unit_label].filter(Boolean).join(" – ")}
            </span>.
          </p>
        )}

        <p>
          Payment received on{" "}
          <span className="font-semibold underline">
            {format(new Date(receipt.payment_date), "dd MMMM yyyy")}
          </span>.
        </p>

        {receipt.notes && (
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Note:</span> {receipt.notes}
          </p>
        )}
      </div>

      {/* Signature */}
      <div className="mt-16 flex justify-between items-end">
        <div>
          <p className="text-sm text-gray-500">Tenant</p>
          <p className="font-semibold border-t border-black pt-1 mt-8 min-w-[180px]">{receipt.tenant_name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Landlord / Owner</p>
          <p className="font-semibold border-t border-black pt-1 mt-8 min-w-[180px]">{receipt.owner_name}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 pt-4 border-t text-center text-xs text-gray-400">
        This is a computer-generated receipt issued via SocietyConnect.
      </div>
    </div>
  );
});

RentReceiptTemplate.displayName = "RentReceiptTemplate";

export default RentReceiptTemplate;

// Simple number to words for Indian currency
function numberToWords(num: number): string {
  if (num === 0) return "zero";
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function convertChunk(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + convertChunk(n % 100) : "");
  }

  const intPart = Math.floor(num);
  if (intPart >= 10000000) {
    const crores = Math.floor(intPart / 10000000);
    const rem = intPart % 10000000;
    return convertChunk(crores) + " crore" + (rem ? " " + numberToWords(rem) : "") + " rupees";
  }
  if (intPart >= 100000) {
    const lakhs = Math.floor(intPart / 100000);
    const rem = intPart % 100000;
    return convertChunk(lakhs) + " lakh" + (rem ? " " + numberToWords(rem) : "") + " rupees";
  }
  if (intPart >= 1000) {
    const thousands = Math.floor(intPart / 1000);
    const rem = intPart % 1000;
    return convertChunk(thousands) + " thousand" + (rem ? " " + convertChunk(rem) : "") + " rupees";
  }
  return convertChunk(intPart) + " rupees";
}
