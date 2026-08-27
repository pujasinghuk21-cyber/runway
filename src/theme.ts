import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

/**
 * Material 3, seeded from #6750a4, with two deliberate departures.
 *
 * Surfaces are neutral grey rather than the baseline's purple-tinted ones.
 * M3 tints every surface with the primary hue, which on a page that is mostly
 * surface reads as an overwhelmingly purple product. Purple is now reserved
 * for things that are actually accented: buttons, active states, the figures
 * that matter.
 *
 * Corners are roughly half the baseline radius, and buttons are not pills.
 */

const primary = '#6750a4';

declare module '@mui/material/styles' {
  interface TypeText {
    tertiary: string;
  }
  interface Palette {
    surfaceContainer: string;
    surfaceContainerHigh: string;
    outlineVariant: string;
  }
  interface PaletteOptions {
    surfaceContainer?: string;
    surfaceContainerHigh?: string;
    outlineVariant?: string;
  }
}

/**
 * The Material 3 elevation ramp, levels 1 to 5.
 *
 * Each level is a tight key shadow plus a wider ambient one, which is what
 * makes M3 depth read as height rather than as a drop shadow.
 *
 * Elevation is used to express containment, not emphasis, and the planes are
 * deliberately few:
 *
 *   0  the page, and everything nested inside a card
 *   1  every top-level section card, all of them equally
 *   2  the app bar, which floats over content as it scrolls
 *   5  the dialog
 *
 * Siblings always share a plane. A row inside a card is separated by a line,
 * never by its own shadow, because a child cannot float above its parent.
 */
// Tinted with the ink colour rather than pure black, and at roughly a fifth
// of the spec opacity. The M3 values (0.30 key, 0.15 ambient) are built for
// the spec's own surfaces and read as weight rather than height on a light
// neutral page. Wider blur, less opacity: the shadow should suggest air under
// the card, not draw a line around it.
const INK = '28, 27, 31';
const M3 = [
  'none',
  `0px 1px 2px rgba(${INK}, 0.05), 0px 1px 4px rgba(${INK}, 0.04)`,
  `0px 1px 2px rgba(${INK}, 0.05), 0px 2px 8px rgba(${INK}, 0.05)`,
  `0px 2px 4px rgba(${INK}, 0.04), 0px 6px 16px rgba(${INK}, 0.06)`,
  `0px 4px 8px rgba(${INK}, 0.04), 0px 10px 24px rgba(${INK}, 0.07)`,
  `0px 8px 16px rgba(${INK}, 0.05), 0px 16px 40px rgba(${INK}, 0.09)`,
];
const shadows = [
  ...M3,
  ...Array.from({ length: 19 }, () => M3[5]),
] as unknown as import('@mui/material/styles').Theme['shadows'];

export const theme = createTheme({
  shadows,
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: {
      main: primary,
      light: '#ece8f4',   // container, pulled well back from the M3 #eaddff
      dark: '#3d2e6b',    // on container
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#5f5c66',
      light: '#eeedf0',
      dark: '#1d1b20',
      contrastText: '#ffffff',
    },
    error: {
      main: '#b3261e',
      light: '#fbeceb',
      dark: '#5f1512',
      contrastText: '#ffffff',
    },
    success: { main: '#386a20', light: '#eaf1e4', dark: '#102000' },
    background: {
      default: '#fbfbfc',  // neutral, not the tinted #fef7ff
      paper: '#ffffff',
    },
    text: {
      /*
       * Two tones, not three.
       *
       * There were three: #1c1b1f, #63606b and #6f6c75. The last two differ
       * by 1.19:1, and anything under about 1.2 is not read as a hierarchy,
       * it is read as inconsistency. In practice they were: tertiary was used
       * 43 times and secondary 11, for the same job, on the same kinds of
       * text, a few rows apart.
       *
       * A genuine third step is not available here. Anything light enough to
       * read as one, from #7d7a83 downwards, falls under 4.5:1 on white and
       * fails AA. So the hierarchy is carried by size and weight, which it
       * was doing anyway, and colour says one thing: is this the figure or is
       * this the words around it.
       */
      primary: '#1c1b1f',   // 17.1:1, headlines and figures
      secondary: '#63606b', // 6.2:1, everything supporting
      tertiary: '#63606b',  // kept as a name so call sites still read sensibly
    },
    divider: '#eae8ed',
    surfaceContainer: '#f5f4f6',
    surfaceContainerHigh: '#eceaef',
    outlineVariant: '#eae8ed',
  },

  shape: { borderRadius: 4 },

  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    // M3 type scale, trimmed to the roles this app actually uses.
    h1: { fontSize: '2.25rem', fontWeight: 400, lineHeight: 1.22, letterSpacing: 0 },
    h2: { fontSize: '1.75rem', fontWeight: 400, lineHeight: 1.29, letterSpacing: 0 },
    h3: { fontSize: '1.375rem', fontWeight: 400, lineHeight: 1.27, letterSpacing: 0 },
    h4: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5, letterSpacing: '0.009em' },
    subtitle1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5, letterSpacing: '0.009em' },
    body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5, letterSpacing: '0.031em' },
    body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.43, letterSpacing: '0.016em' },
    caption: { fontSize: '0.75rem', fontWeight: 400, lineHeight: 1.33, letterSpacing: '0.033em' },
    button: { fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.006em', textTransform: 'none' },
    // lineHeight matters here: MUI's default overline is 2.66, which puts an
    // enormous line box around every kicker on the page.
    overline: { fontSize: '0.6875rem', fontWeight: 500, lineHeight: 1.6, letterSpacing: '0.09em', textTransform: 'uppercase' },
  },

  components: {
    /* Buttons.
     *
     * Three variants, and only three. A rounder corner than anything else on
     * the page (20 against the text field's 4) so a button never reads as an
     * input, and neutral outlines rather than colour sprayed around: colour
     * is reserved for the one primary action in a group. */
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 20, paddingInline: 18, minHeight: 38, fontWeight: 500 },
        sizeSmall: { minHeight: 32, paddingInline: 14, borderRadius: 16 },
        outlined: ({ theme: t }) => ({
          borderColor: t.palette.divider,
          color: t.palette.text.primary,
          '&:hover': {
            borderColor: t.palette.text.secondary,
            backgroundColor: t.palette.action.hover,
          },
        }),
        // Text buttons carry the accent. They have no fill and no border, so
        // colour is the only thing marking them as something you can press.
        // They were ink, which made them read as labels.
      },
    },
    MuiCard: {
      defaultProps: { elevation: 1 },
      styleOverrides: {
        root: {
          borderRadius: 6,
          transition: 'box-shadow 160ms cubic-bezier(0.2, 0, 0, 1)',
        },
      },
    },
    /* Chips are labels, not actions.
     *
     * A filled primary chip was solid purple, which is exactly what the
     * primary button looks like, so a read-only fact read as the main call to
     * action. They are tonal now: quiet fill, dark text, square-ish corner. */
    MuiChip: {
      defaultProps: { size: 'small' as const },
      styleOverrides: {
        root: ({ theme: t, ownerState }: { theme: Theme; ownerState: { color?: string; variant?: string } }) => {
          const tonal: Record<string, [string, string]> = {
            primary: [t.palette.primary.light, t.palette.primary.dark],
            error: [t.palette.error.light, t.palette.error.dark],
            success: [t.palette.success.light, t.palette.success.dark],
          };
          const pair = ownerState.variant === 'filled' && ownerState.color
            ? tonal[ownerState.color]
            : undefined;
          return {
            borderRadius: 6,
            fontWeight: 500,
            height: 24,
            ...(pair ? { backgroundColor: pair[0], color: pair[1] } : {}),
            ...(ownerState.variant === 'outlined'
              ? { borderColor: t.palette.divider, color: t.palette.text.secondary }
              : {}),
          };
        },
      },
    },
    MuiPaper: {
      styleOverrides: { rounded: { borderRadius: 6 } },
    },
    MuiDialog: {
      styleOverrides: {
        // Top of the stack, but M3 level 5 rather than MUI's much heavier 24.
        paper: { borderRadius: 8, boxShadow: M3[5] },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: 4 } },
    },
    /* Sliders are ink, not accent.
     *
     * Purple marks the things you press: buttons, links, the pinned state.
     * A slider you are dragging is already obvious without it. */
    MuiSlider: {
      defaultProps: { color: 'secondary' },
      styleOverrides: {
        root: ({ theme: t }) => ({
          height: 3,
          padding: '6px 0',
          color: t.palette.text.secondary,
        }),
        thumb: ({ theme: t }) => ({
          width: 12,
          height: 12,
          backgroundColor: t.palette.text.secondary,
          '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 6px rgba(28, 27, 31, 0.08)' },
          '&.Mui-active': { boxShadow: '0 0 0 9px rgba(28, 27, 31, 0.10)' },
        }),
        track: ({ theme: t }) => ({ border: 'none', backgroundColor: t.palette.text.secondary }),
        rail: ({ theme: t }) => ({ opacity: 1, backgroundColor: t.palette.divider }),
        valueLabel: { borderRadius: 4 },
      },
    },
    MuiSwitch: {
      defaultProps: { color: 'default' },
      styleOverrides: {
        switchBase: ({ theme: t }) => ({
          '&.Mui-checked': {
            color: t.palette.text.primary,
            '& + .MuiSwitch-track': { backgroundColor: t.palette.text.primary, opacity: 0.5 },
          },
        }),
      },
    },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0, square: true },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: 'none',
          '&:before': { display: 'none' },
          '&.Mui-expanded': { boxShadow: 'none' },
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 2 },
    },
    /* MUI puts 12px above and below the summary content and a 48px floor on
       the row. With a two-line title-and-note pair that reads as a gap rather
       than as a pair. */
    MuiAccordionSummary: {
      styleOverrides: {
        root: { minHeight: 40, paddingInline: 16 },
        content: { marginBlock: 6 },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: { root: { paddingTop: 6, paddingBottom: 16 } },
    },
    /* Segmented buttons. Mutually exclusive options belong in one connected
       control, not three floating pills: rounded ends on the group, square
       joins inside it, and no pill radius on the individual segments. */
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { borderRadius: 6 },
        grouped: {
          borderRadius: 6,
          '&:not(:first-of-type)': { borderRadius: 0, marginLeft: 0, borderLeft: '1px solid transparent' },
          '&:not(:last-of-type)': { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
          '&:first-of-type': { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
          '&:last-of-type': { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          textTransform: 'none',
          alignItems: 'flex-start',
          padding: '6px 14px',
          lineHeight: 1.3,
          color: t.palette.text.primary,
          borderColor: t.palette.divider,
          // Selection is neutral, not accented. The accent would say "this is
          // the recommended one", which is nonsense on "Poor markets": all it
          // means is that this is the view you are currently looking at.
          '&.Mui-selected': {
            backgroundColor: 'rgba(28, 27, 31, 0.08)',
            color: t.palette.text.primary,
            fontWeight: 600,
            '&:hover': { backgroundColor: 'rgba(28, 27, 31, 0.12)' },
          },
        }),
      },
    },
    /* MUI pads a card 16px, then 24px on the bottom of the last child, which
       adds an uneven 8px to the foot of every card on the page. */
    /* Scrollbars.
     *
     * The thumb is drawn inside a transparent 3px border with background-clip,
     * so the visible bar is 4px in a 10px track: it never crowds the content
     * it sits beside, and it darkens only when you reach for it. */
    MuiCssBaseline: {
      styleOverrides: {
        /*
         * The header is sticky, but a sticky element still travels with the
         * document when the browser rubber bands past the top. Pulling the
         * page down slid the white bar off and showed the grey page colour
         * above it.
         *
         * Two fixes, because either alone leaves a gap. Stopping the bounce
         * handles it where the browser allows; painting the top half of the
         * page the header's colour means that anywhere the bounce still
         * happens, what shows behind is white rather than grey.
         */
        'html, body': {
          overscrollBehaviorY: 'none',
          backgroundColor: '#ffffff',
        },
        '#root': {
          backgroundColor: '#fbfbfc',
          minHeight: '100vh',
        },
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(28, 27, 31, 0.20) transparent',
        },
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(28, 27, 31, 0.20)',
          borderRadius: 8,
          border: '3px solid transparent',
          backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-thumb:hover': {
          backgroundColor: 'rgba(28, 27, 31, 0.38)',
        },
        '*::-webkit-scrollbar-corner': { background: 'transparent' },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 16, '&:last-child': { paddingBottom: 16 } },
      },
    },
    MuiTypography: {
      styleOverrides: {
        caption: { display: 'block' },
        overline: { display: 'block' },
      },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { borderRadius: 4, fontSize: '0.75rem' } },
    },
  },
});
