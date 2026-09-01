import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilePdf,
  faFileWord,
  faFilePowerpoint,
  faFileLines,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

const ICON_BY_TYPE: Record<string, { icon: IconDefinition; classes: string }> = {
  pdf: { icon: faFilePdf, classes: "text-status-error bg-status-error/10" },
  docx: { icon: faFileWord, classes: "text-blue-400 bg-blue-400/10" },
  pptx: { icon: faFilePowerpoint, classes: "text-status-warn bg-status-warn/10" },
  txt: { icon: faFileLines, classes: "text-muted-strong bg-muted/10" },
};

export default function FileTypeIcon({ type }: { type: string }) {
  const entry = ICON_BY_TYPE[type] ?? ICON_BY_TYPE.txt;
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${entry.classes}`}
    >
      <FontAwesomeIcon icon={entry.icon} className="h-4 w-4" />
    </span>
  );
}
