import { useState } from 'react';
import {
  Box, Button, Card, Collapse,
  IconButton, InputBase, Stack, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/DeleteOutlineOutlined';
import RenameIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAddOutlined';
import type { Scenario } from '../engine/types';
import { ExportMenu } from './ExportMenu';

/**
 * Saving a plan and finding it again, in one place.
 *
 * Built to the same shape as the cards in the rail: an overline heading with
 * one action on the right, a rule, then the content. It was a loose row of a
 * label, a dropdown button and another button floating under the banner,
 * which belonged to nothing and matched nothing.
 */
export function PlansBar({
  scenarios,
  activeId,
  dirty,
  expanded,
  onToggle,
  onLoad,
  onDelete,
  onRename,
  onSave,
}: {
  scenarios: Scenario[];
  activeId: string | null;
  /** True when the plan on screen no longer matches the one that was loaded. */
  dirty: boolean;
  expanded: boolean;
  onToggle: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onSave: () => void;
}) {
  /*
   * Renaming happens in place, in the row.
   *
   * The name was fixed at the moment of saving, when you knew least about what
   * the plan was going to turn out to be. Plan 1, Plan 2, Plan 3 is what you
   * end up with, and then you cannot tell them apart.
   *
   * A dialog would have been more code and further from the thing being
   * renamed, so the row becomes a field and Enter puts it back.
   */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (sc: Scenario) => {
    setEditingId(sc.id);
    setDraft(sc.name);
  };

  const commit = () => {
    if (!editingId) return;
    const name = draft.trim();
    // An empty name would leave a row you cannot identify or click, so the
    // old one stands.
    if (name) onRename(editingId, name);
    setEditingId(null);
  };

  const empty = scenarios.length === 0;

  return (
    <Card sx={{ mb: 2 }}>
      {/*
        * One header row: the section, the action, then the chevron.
        *
        * There were two rows. A heading with the Save button, and a second
        * row below it holding the name of the loaded plan and the chevron, so
        * the control that opened the whole list looked like it belonged to
        * one plan. Then Save moved into the list to get the chevron up here,
        * and Save disappeared behind the very thing it needed to be outside
        * of.
        *
        * A plain row with its own toggle button solves both. Nothing is
        * nested inside anything, and the two actions sit where they can be
        * seen and told apart.
        */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ px: 2, py: 1, alignItems: 'center' }}
      >
        <Typography variant="overline" sx={{ color: 'text.tertiary', flex: 1, minWidth: 0 }}>
          Your plans
        </Typography>

        <Button
          size="small"
          startIcon={<BookmarkAddIcon />}
          onClick={onSave}
          sx={{ flex: 'none' }}
        >
          Save this plan
        </Button>

        {!empty && (
          <Tooltip title={expanded ? 'Hide saved plans' : `Show ${scenarios.length} saved plans`}>
            <IconButton
              size="small"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls="saved-plans"
              aria-label={expanded ? 'Hide saved plans' : 'Show saved plans'}
              sx={{ flex: 'none', mr: -0.5 }}
            >
              <ExpandMoreIcon
                sx={{
                  fontSize: 20,
                  color: 'text.tertiary',
                  transform: expanded ? 'rotate(180deg)' : 'none',
                  transition: 'transform 160ms',
                }}
              />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {empty ? (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography variant="body2" sx={{ color: 'text.tertiary' }}>
            Nothing saved yet. Save this one to come back to it.
          </Typography>
        </Box>
      ) : (
        <Collapse in={expanded} unmountOnExit>
          <Box id="saved-plans" sx={{ px: 1, pb: 1, borderTop: 1, borderColor: 'divider', pt: 0.5 }}>
            <Stack>
              {scenarios.map((sc) => {
                const isActive = sc.id === activeId;
                return (
                  <Stack
                    key={sc.id}
                    direction="row"
                    spacing={1}
                    /*
                     * Which plan is loaded is said in words, not in colour.
                     *
                     * The loaded row was filled purple and carried a tick on
                     * the right. Purple is what this product uses for things
                     * you can press, and a tick in a list row is a checkbox
                     * everywhere else on the internet, so the row looked like
                     * a control with a state and there was no way to work out
                     * what checking or unchecking it would do. Neither mark
                     * meant anything you could act on: it was reporting.
                     *
                     * So it reports, in the line already there for reporting.
                     * Hover is the only fill left, and hover means "you can
                     * click this", which here is true.
                     */
                    sx={{
                      alignItems: 'center',
                      px: 1,
                      py: 0.75,
                      borderRadius: '4px',
                      '&:hover': { bgcolor: 'surfaceContainer' },
                    }}
                  >
                    {editingId === sc.id ? (
                      <InputBase
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        inputProps={{ 'aria-label': 'Plan name', maxLength: 60 }}
                        sx={{
                          flex: 1, minWidth: 0,
                          px: 1, py: 0.25,
                          borderRadius: '4px',
                          border: 1, borderColor: 'text.tertiary',
                          bgcolor: 'background.paper',
                          '& input': { p: 0, fontSize: '0.875rem', fontWeight: 500 },
                        }}
                      />
                    ) : (
                      <Box
                        component="button"
                        onClick={() => onLoad(sc.id)}
                        sx={{
                          flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer',
                          border: 0, background: 'none', p: 0, font: 'inherit',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: isActive ? 600 : 400 }}>
                          {sc.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
                          {isActive
                            ? `Open now${dirty ? ', edited' : ''}. Saved ${sc.saved}`
                            : `Saved ${sc.saved}`}
                        </Typography>
                      </Box>
                    )}

                    {editingId === sc.id ? (
                      <Button size="small" onClick={commit} sx={{ flex: 'none' }}>
                        Done
                      </Button>
                    ) : (
                      <>
                        <ExportMenu
                          settings={sc.settings}
                          name={sc.name}
                          compact
                          title={
                            isActive && dirty
                              ? `Download ${sc.name} as it was saved. Your edits are not in it.`
                              : `Download ${sc.name}`
                          }
                        />
                        <Tooltip title="Rename">
                          <IconButton
                            size="small"
                            aria-label={`Rename ${sc.name}`}
                            onClick={() => startEdit(sc)}
                            sx={{ flex: 'none' }}
                          >
                            <RenameIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            aria-label={`Delete ${sc.name}`}
                            onClick={() => onDelete(sc.id)}
                            sx={{ flex: 'none' }}
                          >
                            <DeleteIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        </Collapse>
      )}
    </Card>
  );
}
