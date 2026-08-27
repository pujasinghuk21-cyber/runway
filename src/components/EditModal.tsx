import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, Stack, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Settings } from '../engine/types';
import { GROUPS } from '../engine/config';
import { LeverControl } from './Levers';

/**
 * The plan, reachable from under the chart.
 *
 * Same controls as the rail, in the same groups, in the same order, off the
 * same state. It used to keep its own grouping, so the two drifted apart every
 * time a lever moved, and the panel had a different name from the rail while
 * showing identical settings.
 */
export function EditModal({
  settings, onChange, onClose,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}
      >
        Your plan
        <IconButton onClick={onClose} aria-label="Close" size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3} divider={<Divider flexItem />}>
          {GROUPS.map((g) => (
            <Stack spacing={1} key={g.id}>
              <Typography variant="overline" sx={{ color: 'text.tertiary' }}>
                {g.title}
              </Typography>
              {/* 4px between fields, but not between the heading and the
                  first of them. A group title pulled in as tight as the rows
                  it labels stops reading as a title. */}
              <Stack spacing={1}>
                {g.items.map((lever) => (
                  <LeverControl
                    key={lever.k}
                    lever={lever}
                    settings={settings}
                    onChange={onChange}
                    hintOnHover
                  />
                ))}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Applies as you go.
        </Typography>
        <Button variant="contained" onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
