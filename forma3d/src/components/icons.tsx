import type { SVGProps } from "react";
import {
  AlertTriangle,
  Bell,
  Box,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code,
  Coins,
  Copy,
  Download,
  ExternalLink,
  Focus,
  Folder,
  Grid3x3,
  Heart,
  History,
  Image,
  Layers,
  Lightbulb,
  ListOrdered,
  LogOut,
  MapPin,
  Microscope,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  Ruler,
  Search,
  Settings,
  Shapes,
  Shield,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
  Camera,
  Circle,
  Cone,
  Cylinder,
  Disc,
  Eye,
  EyeOff,
  Keyboard,
  Lock,
  LockOpen,
  Moon,
  MousePointer2,
  Move,
  PenTool,
  Redo2,
  Scaling,
  Square,
  Columns2,
  Grid2x2,
  Sun,
  Type,
  Undo2,
  Video,
  Axis3d,
  Menu,
  type LucideIcon,
} from "lucide-react";

/**
 * Jeu d'icônes unique de Forma3D : Lucide, trait fin (1,5), en 16 ou 20 px seulement.
 * Les noms historiques (IconCube, IconAlert…) restent exportés pour ne rien casser.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number };

/** 16 px dans les barres et listes, 20 px pour les icônes mises en avant. */
export const iconSize = (size = 16) => (size >= 18 ? 20 : 16);

export function icon(Glyph: LucideIcon) {
  function Icon({ size = 16, ...props }: IconProps) {
    return <Glyph aria-hidden="true" focusable="false" {...props} size={iconSize(size)} strokeWidth={1.5} />;
  }
  Icon.displayName = Glyph.displayName;
  return Icon;
}

export const IconSearch = icon(Search);
export const IconBell = icon(Bell);
export const IconChevronDown = icon(ChevronDown);
export const IconChevronLeft = icon(ChevronLeft);
export const IconChevronRight = icon(ChevronRight);
export const IconPlus = icon(Plus);
export const IconMinus = icon(Minus);
export const IconX = icon(X);
export const IconCheck = icon(Check);
export const IconRefocus = icon(Focus);
export const IconCamera = icon(Camera);
export const IconDownload = icon(Download);
export const IconCube = icon(Box);
export const IconExplode = icon(Boxes);
export const IconWire = icon(Shapes);
export const IconSparkles = icon(Sparkles);
export const IconImage = icon(Image);
export const IconAlert = icon(AlertTriangle);
export const IconTrash = icon(Trash2);
export const IconLogout = icon(LogOut);
export const IconRotate = icon(RotateCw);
export const IconGrid = icon(Grid3x3);
export const IconClock = icon(Clock);
export const IconPin = icon(MapPin);
export const IconRuler = icon(Ruler);
export const IconLayers = icon(Layers);
export const IconSteps = icon(ListOrdered);
export const IconCoin = icon(Coins);
export const IconBulb = icon(Lightbulb);
export const IconMicroscope = icon(Microscope);
export const IconCode = icon(Code);
export const IconHistory = icon(History);
export const IconSettings = icon(Settings);
export const IconShield = icon(Shield);
export const IconUser = icon(User);
export const IconStar = icon(Star);
export const IconHeart = icon(Heart);
export const IconFolder = icon(Folder);
export const IconCopy = icon(Copy);
export const IconPencil = icon(Pencil);
export const IconExternal = icon(ExternalLink);
export const IconRefresh = icon(RefreshCw);
export const IconLock = icon(Lock);
export const IconUnlock = icon(LockOpen);
export const IconEye = icon(Eye);
export const IconEyeOff = icon(EyeOff);
export const IconSun = icon(Sun);
export const IconMoon = icon(Moon);
export const IconVideo = icon(Video);
export const IconKeyboard = icon(Keyboard);
export const IconUndo = icon(Undo2);
export const IconRedo = icon(Redo2);
export const IconPointer = icon(MousePointer2);
export const IconMove = icon(Move);
export const IconScale = icon(Scaling);
export const IconAxes = icon(Axis3d);
export const IconView1 = icon(Square);
export const IconView2 = icon(Columns2);
export const IconView4 = icon(Grid2x2);
export const IconSphere = icon(Circle);
export const IconCylinder = icon(Cylinder);
export const IconCone = icon(Cone);
export const IconTorus = icon(Disc);
export const IconText = icon(Type);
export const IconDraw = icon(PenTool);
export const IconMenu = icon(Menu);

/** Indicateur d'activité : anneau fin qui tourne (figé si l'on demande de réduire les animations). */
export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  const s = iconSize(size);
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Logo par défaut : cube isométrique monochrome, face supérieure à la couleur d'accent. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 27.5 9.5v13L16 29 4.5 22.5v-13Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M16 3 27.5 9.5 16 16 4.5 9.5Z" fill="rgb(var(--accent))" />
      <path d="M16 16v13" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
