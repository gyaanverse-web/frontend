import type { CSSProperties, ReactNode } from "react";

/**
 * A label/value detail grid that keeps its shape when it becomes editable.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Every "details card with an Edit button" in this app used to be written as a
 * mode swap:
 *
 *     {!editing ? <table>…6 rows…</table> : <form>…2 fields…</form>}
 *
 * Two independently authored subtrees behind one button. That reads to a user
 * as "Edit opened a different screen", because it effectively did:
 *
 *   - the field set changed — the read table showed Name, Email, Phone, Role,
 *     Member since, User ID; the form showed Name and Email, and the other four
 *     simply vanished with no explanation that they still exist;
 *   - the layout changed — labels moved from a fixed left column to stacked
 *     above their control, row separators disappeared, padding changed, so the
 *     card visibly reflowed and often changed height;
 *   - the styling changed — read cells are table cells on `--bg-section-alt`,
 *     the forms were flex stacks of `.gv-label` + `.gv-input`.
 *
 * The card was never "the same thing, now editable" — it was a second UI.
 *
 * ── What this does instead ──────────────────────────────────────────────────
 *
 * One table, one row order, one set of paddings and separators, in both modes.
 * Editability is a property of a ROW (`edit`), not a mode of the whole card, so
 * a row with no editor keeps showing its value while its neighbours turn into
 * inputs. Nothing disappears when you click Edit; some cells just gain a
 * control. The only thing that moves is the row height, by the few pixels
 * between a line of text and a 40px input.
 */

export type DetailRow = {
  label: ReactNode;
  /** Read-mode rendering, and what a non-editable row keeps showing while editing. */
  value: ReactNode;
  /**
   * Edit-mode control for this row. Omit for fields that are display-only
   * (IDs, timestamps, server-derived state) — they stay visible and readable
   * rather than being dropped from the edit view.
   */
  edit?: ReactNode;
  /**
   * Help/constraint text under the value. Edit mode only, and shown whether or
   * not the row has a control — "this field cannot be changed, and here is why"
   * is exactly the note a row with no `edit` needs to carry.
   */
  help?: ReactNode;
  /**
   * "There is no value to show." Hides the row in read mode, but keeps it in
   * edit mode when the row has an `edit` control — that is exactly the row you
   * need in order to fill the empty field in.
   */
  hidden?: boolean;
};

export interface DetailRowsProps {
  rows: DetailRow[];
  /** When true, rows carrying an `edit` node render that node instead of `value`. */
  editing?: boolean;
  /** Width of the label column, px. Defaults to 150. */
  labelWidth?: number;
}

const labelCell: CSSProperties = {
  padding: "12px 18px",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: "nowrap",
  background: "var(--bg-section-alt)",
  color: "var(--text-body)",
  borderBottom: "1px solid var(--border-default)",
  verticalAlign: "middle",
};

const valueCell: CSSProperties = {
  padding: "12px 18px",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--text-heading)",
  borderBottom: "1px solid var(--border-default)",
  verticalAlign: "middle",
};

// Inputs carry their own 40px height, so the cell gives back some of the
// vertical padding to keep the row rhythm close to the read-mode one.
const controlCell: CSSProperties = { ...valueCell, padding: "8px 18px" };

export function DetailRows({ rows, editing = false, labelWidth = 150 }: DetailRowsProps) {
  const visible = rows.filter((r) => !r.hidden || (editing && r.edit));
  const last = visible.length - 1;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <tbody>
        {visible.map((row, i) => {
          const showControl = editing && !!row.edit;
          const noBorder = i === last ? { borderBottom: "none" } : null;
          return (
            <tr key={i}>
              <td style={{ ...labelCell, width: labelWidth, ...noBorder }}>{row.label}</td>
              <td style={{ ...(showControl ? controlCell : valueCell), ...noBorder }}>
                {showControl ? (
                  row.edit
                ) : (
                  // While editing, a row with no control is information the user
                  // can still read but not change — muted so the difference is
                  // legible without the row leaving the layout.
                  <span style={editing ? { color: "var(--text-muted)" } : undefined}>{row.value}</span>
                )}
                {editing && row.help && <div className="gv-help">{row.help}</div>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
