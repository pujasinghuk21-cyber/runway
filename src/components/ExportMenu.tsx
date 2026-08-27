import { useState } from 'react';
import {
  Button, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import PdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import SheetIcon from '@mui/icons-material/GridOnOutlined';
import type { Settings } from '../engine/types';
import { compute } from '../engine/compute';
import { planToCsv, csvBlob } from '../engine/exportCsv';
import { planToPdf } from '../engine/exportPdf';
import { download, safeName } from '../engine/planData';

/**
 * Take the plan away with you.
 *
 * Two formats, because they are two different jobs. The PDF is the plan as a
 * document: the answer, the settings it rests on, and every year of it, laid
 * out to be read or handed to somebody. The spreadsheet is the plan as
 * numbers, so you can check the arithmetic, chart it your own way, or put it
 * beside another tool's answer.
 *
 * Both are built in the browser from what is already on screen. Nothing is
 * uploaded, and there is no server to upload it to.
 *
 * A menu rather than two buttons: they are alternatives, and a row of two
 * download buttons makes the reader compare file formats before they have
 * decided they want the file at all.
 */
export function ExportMenu({
  settings,
  name,
  compact = false,
  title,
}: {
  settings: Settings;
  /** Names the file, so a download found later says what it was. */
  name: string;
  /** An icon button for a list row, a labelled button for a header. */
  compact?: boolean;
  /** Overrides the tooltip, for saying which version of a plan comes out. */
  title?: string;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const close = () => setAnchor(null);

  const run = (kind: 'pdf' | 'csv') => {
    close();
    // Computed here rather than passed in, so a saved plan exports itself and
    // not whatever happens to be on screen.
    const res = compute(settings);
    const file = `runway-${safeName(name)}`;
    if (kind === 'pdf') {
      download(planToPdf(settings, res, name), `${file}.pdf`, 'application/pdf');
    } else {
      download(csvBlob(planToCsv(settings, res, name)), `${file}.csv`, 'text/csv;charset=utf-8');
    }
  };

  const items = [
    {
      k: 'pdf' as const,
      icon: PdfIcon,
      label: 'PDF',
      note: 'To read, print or send on',
    },
    {
      k: 'csv' as const,
      icon: SheetIcon,
      label: 'Spreadsheet',
      note: 'Opens in Excel, Numbers or Sheets',
    },
  ];

  return (
    <>
      {compact ? (
        <Tooltip title={title ?? `Download ${name}`}>
          <IconButton
            size="small"
            aria-label={title ?? `Download ${name}`}
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ flex: 'none' }}
          >
            <DownloadIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ flex: 'none' }}
        >
          Download
        </Button>
      )}

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 244 } } }}
      >
        {items.map((it) => (
          <MenuItem key={it.k} onClick={() => run(it.k)} sx={{ py: 1 }}>
            <ListItemIcon sx={{ minWidth: 34 }}>
              <it.icon sx={{ fontSize: 20, color: 'text.tertiary' }} />
            </ListItemIcon>
            <ListItemText
              primary={it.label}
              secondary={it.note}
              slotProps={{
                primary: { variant: 'body2', sx: { fontWeight: 500 } },
                secondary: { variant: 'caption', color: 'text.tertiary' },
              }}
            />
          </MenuItem>
        ))}
        <Typography
          variant="caption"
          sx={{ display: 'block', px: 2, pt: 1, pb: 0.5, color: 'text.tertiary' }}
        >
          Built here in your browser. Nothing is uploaded.
        </Typography>
      </Menu>
    </>
  );
}
