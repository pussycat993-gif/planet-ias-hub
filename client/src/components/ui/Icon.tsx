import { forwardRef } from 'react';
import * as Lucide from 'lucide-react';
import type { LucideProps } from 'lucide-react';

// ── Central icon wrapper ───────────────────────────────────────
// Every icon in IAS Hub comes from Lucide via this module — components
// import from '@/components/ui/Icon', never from 'lucide-react' directly,
// so the whole app shares one icon set and one set of defaults.
//
// Defaults: size 18, strokeWidth 2, and color 'currentColor' so icons
// inherit the surrounding text color and follow the light/dark theme
// tokens automatically. Any prop can be overridden at the call site.

type LucideComponent = React.ForwardRefExoticComponent<
  Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
>;

const withDefaults = (LucideIcon: LucideComponent) =>
  forwardRef<SVGSVGElement, LucideProps>(function Icon(props, ref) {
    return <LucideIcon ref={ref} size={18} strokeWidth={2} color="currentColor" {...props} />;
  });

export type IconProps = LucideProps;

// ── Named icons used across the app ────────────────────────────
export const Pin         = withDefaults(Lucide.Pin);
export const Building2   = withDefaults(Lucide.Building2);
export const User        = withDefaults(Lucide.User);
export const Users       = withDefaults(Lucide.Users);
export const Tag         = withDefaults(Lucide.Tag);
export const Zap         = withDefaults(Lucide.Zap);
export const Sparkles    = withDefaults(Lucide.Sparkles);
export const Mic         = withDefaults(Lucide.Mic);
export const Video       = withDefaults(Lucide.Video);
export const Phone       = withDefaults(Lucide.Phone);
export const Search      = withDefaults(Lucide.Search);
export const Bell        = withDefaults(Lucide.Bell);
export const Settings    = withDefaults(Lucide.Settings);
export const Check       = withDefaults(Lucide.Check);
export const X           = withDefaults(Lucide.X);
export const Calendar    = withDefaults(Lucide.Calendar);
export const Clipboard   = withDefaults(Lucide.Clipboard);
export const ChevronDown = withDefaults(Lucide.ChevronDown);
