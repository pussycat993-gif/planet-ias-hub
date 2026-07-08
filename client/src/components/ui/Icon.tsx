import { forwardRef } from 'react';
import * as L from 'lucide-react';
import type { LucideProps } from 'lucide-react';

// ── Central icon registry ──────────────────────────────────────
// Every icon in IAS Hub comes from Lucide through this one component.
// Components render <Icon name="close" /> and never import from
// 'lucide-react' directly, so the whole app shares one icon set and one
// set of defaults.
//
// Defaults: size 18, strokeWidth 2, color 'currentColor' — icons inherit
// the surrounding text color and follow the light/dark theme tokens
// automatically. Any prop can be overridden at the call site.
//
// To add an icon: add a semantic name → Lucide component entry to
// REGISTRY below. Never hardcode a hex color in a component.

const REGISTRY = {
  // navigation / chrome
  close: L.X,
  search: L.Search,
  settings: L.Settings,
  add: L.Plus,
  'chevron-down': L.ChevronDown,
  'chevron-right': L.ChevronRight,
  'chevron-left': L.ChevronLeft,
  'chevron-up': L.ChevronUp,
  'arrow-right': L.ArrowRight,
  'arrow-left': L.ArrowLeft,
  'arrow-up': L.ArrowUp,
  'arrow-down': L.ArrowDown,
  'external-link': L.ExternalLink,
  'open-external': L.SquareArrowOutUpRight,
  more: L.MoreVertical,
  'panel-right': L.PanelRight,
  'panel-left': L.PanelLeft,
  menu: L.Menu,
  home: L.Home,
  hash: L.Hash,

  // communication
  message: L.MessageSquare,
  'message-circle': L.MessageCircle,
  send: L.Send,
  bell: L.Bell,
  'bell-off': L.BellOff,
  mail: L.Mail,
  reply: L.Reply,
  at: L.AtSign,
  'corner-up-right': L.CornerUpRight,

  // people / entities
  user: L.User,
  users: L.Users,
  'user-add': L.UserPlus,
  building: L.Building2,
  tag: L.Tag,
  ticket: L.Ticket,
  landmark: L.Landmark,
  laptop: L.Laptop,
  trophy: L.Trophy,
  folder: L.Folder,
  'folder-open': L.FolderOpen,

  // call
  phone: L.Phone,
  'phone-off': L.PhoneOff,
  'phone-missed': L.PhoneMissed,
  video: L.Video,
  'video-off': L.VideoOff,
  mic: L.Mic,
  'mic-off': L.MicOff,
  'screen-share': L.ScreenShare,
  'screen-share-off': L.ScreenShareOff,
  hand: L.Hand,

  // media / files
  attach: L.Paperclip,
  download: L.Download,
  save: L.Save,
  image: L.Image,
  'image-up': L.ImageUp,
  film: L.Film,
  music: L.Music,
  'file-text': L.FileText,
  'file-spreadsheet': L.FileSpreadsheet,
  'file-archive': L.FileArchive,
  database: L.Database,
  palette: L.Palette,
  camera: L.Camera,
  volume: L.Volume2,
  play: L.Play,
  pause: L.Pause,
  stop: L.Square,

  // editing
  edit: L.SquarePen,
  pencil: L.Pencil,
  copy: L.Copy,
  trash: L.Trash2,
  check: L.Check,
  'check-circle': L.CircleCheck,
  pin: L.Pin,
  star: L.Star,
  clipboard: L.Clipboard,
  'sticky-note': L.StickyNote,

  // status / misc
  circle: L.Circle,
  'circle-dot': L.CircleDot,
  clock: L.Clock,
  timer: L.Timer,
  alarm: L.AlarmClock,
  hourglass: L.Hourglass,
  loader: L.LoaderCircle,
  refresh: L.RefreshCw,
  rotate: L.RotateCw,
  zap: L.Zap,
  sparkles: L.Sparkles,
  bot: L.Bot,
  alert: L.AlertTriangle,
  help: L.HelpCircle,
  keyboard: L.Keyboard,
  moon: L.Moon,
  logout: L.LogOut,
  lock: L.Lock,
  globe: L.Globe,
  link: L.Link,
  'shield-check': L.ShieldCheck,
  plug: L.Plug,
  unplug: L.Unplug,
  hexagon: L.Hexagon,
  rocket: L.Rocket,
  map: L.Map,
  megaphone: L.Megaphone,
  lightbulb: L.Lightbulb,
  coffee: L.Coffee,
  smile: L.Smile,
  'smile-plus': L.SmilePlus,
  calendar: L.Calendar,
  clapperboard: L.Clapperboard,
  target: L.Target,
} as const;

export type IconName = keyof typeof REGISTRY;

export interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName;
}

const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size = 18, strokeWidth = 2, color = 'currentColor', ...rest },
  ref,
) {
  const LucideIcon = REGISTRY[name];
  return <LucideIcon ref={ref} size={size} strokeWidth={strokeWidth} color={color} {...rest} />;
});

export default Icon;

// ── File-type helper ───────────────────────────────────────────
// Maps a filename (and optional MIME type) to a semantic icon name, so
// file listings render Lucide icons instead of per-extension emoji.
// Replaces the duplicated fileIcon() emoji maps that lived in Sidebar,
// MessageInput and MessageList.
const FILE_EXT_ICON: Record<string, IconName> = {
  pdf: 'file-text', doc: 'file-text', docx: 'file-text', md: 'file-text', txt: 'file-text',
  xls: 'file-spreadsheet', xlsx: 'file-spreadsheet', csv: 'file-spreadsheet',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
  mp4: 'film', mov: 'film', webm: 'film',
  mp3: 'music', wav: 'music', ogg: 'music', m4a: 'music',
  sql: 'database',
  fig: 'palette',
  zip: 'file-archive', rar: 'file-archive', '7z': 'file-archive', gz: 'file-archive',
};

export function fileTypeIcon(name: string, mime?: string): IconName {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'film';
  if (mime?.startsWith('audio/')) return 'music';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FILE_EXT_ICON[ext] || 'attach';
}

// ── DEPRECATED: legacy per-name exports ────────────────────────
// TEMPORARY back-compat for call sites not yet migrated to <Icon name>.
// Remove this whole block in the final cleanup commit once every
// consumer uses the <Icon name="..." /> API. Do not add new usages.
const legacy = (LucideIcon: (typeof REGISTRY)[IconName]) =>
  forwardRef<SVGSVGElement, Omit<LucideProps, 'ref'>>(function LegacyIcon(props, ref) {
    return <LucideIcon ref={ref} size={18} strokeWidth={2} color="currentColor" {...props} />;
  });

/** @deprecated use <Icon name="pin" /> */          export const Pin = legacy(REGISTRY.pin);
/** @deprecated use <Icon name="building" /> */     export const Building2 = legacy(REGISTRY.building);
/** @deprecated use <Icon name="user" /> */         export const User = legacy(REGISTRY.user);
/** @deprecated use <Icon name="users" /> */        export const Users = legacy(REGISTRY.users);
/** @deprecated use <Icon name="tag" /> */          export const Tag = legacy(REGISTRY.tag);
/** @deprecated use <Icon name="zap" /> */          export const Zap = legacy(REGISTRY.zap);
/** @deprecated use <Icon name="sparkles" /> */     export const Sparkles = legacy(REGISTRY.sparkles);
/** @deprecated use <Icon name="mic" /> */          export const Mic = legacy(REGISTRY.mic);
/** @deprecated use <Icon name="video" /> */        export const Video = legacy(REGISTRY.video);
/** @deprecated use <Icon name="phone" /> */        export const Phone = legacy(REGISTRY.phone);
/** @deprecated use <Icon name="search" /> */       export const Search = legacy(REGISTRY.search);
/** @deprecated use <Icon name="bell" /> */         export const Bell = legacy(REGISTRY.bell);
/** @deprecated use <Icon name="settings" /> */     export const Settings = legacy(REGISTRY.settings);
/** @deprecated use <Icon name="check" /> */        export const Check = legacy(REGISTRY.check);
/** @deprecated use <Icon name="close" /> */        export const X = legacy(REGISTRY.close);
/** @deprecated use <Icon name="calendar" /> */     export const Calendar = legacy(REGISTRY.calendar);
/** @deprecated use <Icon name="clipboard" /> */    export const Clipboard = legacy(REGISTRY.clipboard);
/** @deprecated use <Icon name="chevron-down" /> */ export const ChevronDown = legacy(REGISTRY['chevron-down']);
