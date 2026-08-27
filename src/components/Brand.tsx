import { Box } from '@mui/material';

/**
 * The mark, and the answer card's background.
 *
 * Drawn rather than drawn *up*: SVG, so it is sharp at any size, weighs
 * almost nothing, takes its colour from the theme, and can respond to whether
 * the plan holds. A generated image could do none of that.
 *
 * A very faint version of the mark used to sit in the banner too. It went in
 * the right corner, where it fought the sticker, then the left, where it was
 * simply noise. A gradient was all the depth that card needed; the second
 * drawing was decoration looking for a job.
 *
 * The shape is a runway in perspective: a strip narrowing to a horizon with
 * centre line dashes down it. It earns its place three ways. It is the name.
 * It is the metaphor, the distance you have before you run out. And it is the
 * chart, a line heading away from you into the distance, which is the one
 * picture this whole product is about.
 */

export function RunwayMark({ size = 34 }: { size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        flex: 'none',
        // Square, and made to stay square. In a flex row a box with only a
        // width and height can still be pulled about by its neighbours, which
        // is what made it look squashed.
        width: size,
        height: size,
        aspectRatio: '1 / 1',
        alignSelf: 'center',
        borderRadius: '7px',
        // Clips the strip where it runs off the top and bottom, so the corners
        // cut it rather than it stopping short of them.
        overflow: 'hidden',
        display: 'block',
        background: 'linear-gradient(145deg, #7a5fc4 0%, #4f378b 55%, #3b2769 100%)',
        boxShadow: '0 1px 2px rgba(28, 27, 31, 0.24)',
      }}
    >
      {/*
        * The strip runs the full height of the tile.
        *
        * It used to sit inside a 62% box with clear space above and below,
        * which made a 34px mark look like a 20px one adrift in a square. Edge
        * to edge, it reads as a road passing through rather than a picture of
        * one placed in the middle.
        */}
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" preserveAspectRatio="none">
        <path d="M1.6 24 L9.8 0 L14.2 0 L22.4 24 Z" fill="#fff" fillOpacity="0.94" />
        {/* Centre line, in the gaps a real one has, shortening with distance. */}
        <g fill="#452f7a">
          <rect x="11.05" y="19.6" width="1.9" height="3.5" rx="0.95" />
          <rect x="11.22" y="13.9" width="1.56" height="2.9" rx="0.78" />
          <rect x="11.38" y="9.1" width="1.24" height="2.3" rx="0.62" />
          <rect x="11.5" y="5.1" width="1" height="1.8" rx="0.5" />
          <rect x="11.6" y="1.8" width="0.8" height="1.4" rx="0.4" />
        </g>
      </svg>
    </Box>
  );
}

/** The answer card's background. Two stops in one hue, never a wash. */
export const bannerGradient = (ok: boolean) =>
  ok
    ? 'linear-gradient(135deg, #5b3fa0 0%, #4a3384 45%, #3b2769 100%)'
    : 'linear-gradient(135deg, #8a2a20 0%, #74211a 45%, #5c1a13 100%)';

/*
 * The quiet text on the banner, tinted rather than faded.
 *
 * Every supporting line in the card was white at 0.78 opacity. Fading white
 * does not tint it, it greys it: over the purple that renders as #dbd5ea,
 * which is 9% colourful and reads as dishwater rather than as anything
 * belonging to the brand. An explicit lavender at full strength is twice as
 * colourful and, because nothing is see-through, holds the same contrast
 * wherever it lands on the gradient instead of drifting with it.
 *
 * Both hold AA at the lightest end of their gradient, which is the hardest
 * place: 4.86:1 for the lavender, 5.71:1 for the warm one. There is a deeper
 * lavender that still passes on paper, and it passes by 0.02, which is not a
 * margin worth spending on a shade nobody would notice.
 */
export const bannerTint = (ok: boolean) => (ok ? '#d3c4f2' : '#f2c9c1');

/*
 * The chip fill, going darker instead of lighter.
 *
 * A white wash at 0.14 lifted the chips off the card by draining the colour
 * out of a patch of it, so they sat there as grey lozenges on a purple field.
 * A plum wash pushes the same patch further into the hue, which separates the
 * chip just as clearly and takes white text from 5.55:1 to 9.66:1 on the way.
 */
export const bannerChipFill = 'rgba(26, 11, 61, 0.26)';
