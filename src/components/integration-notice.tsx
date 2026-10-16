import { CircleAlert } from "lucide-react";
import type { Locale } from "@/lib/i18n";
export function IntegrationNotice({locale}:{locale:Locale}) {
  const text={fr:"Les données de la base sont temporairement indisponibles. Seules les observations locales déjà validées sont affichées ; leur date de référence reste indiquée.",en:"Database data is temporarily unavailable. Only previously validated local observations are shown, with their reference dates.",ar:"بيانات القاعدة غير متاحة مؤقتاً. تظهر فقط البيانات المحلية المعتمدة سابقاً مع تواريخها المرجعية."}[locale];
  return <div className="notice" role="status"><CircleAlert size={19}/><p>{text}</p></div>;
}
