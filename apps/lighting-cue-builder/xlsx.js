// A small .xlsx writer: just enough of the format for the colour-coded cue
// grid. No DOM, so Node tests import this file directly.
//
// An .xlsx is a zip of XML parts. Entries are stored uncompressed, which
// every spreadsheet app reads and keeps this file short; the grid is a few
// hundred KB at most.

import { cueGrid, backupGrids, ALL_LIGHTS, APPARATUS } from './cues.js';

/* ── zip (stored, no compression) ─────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// files: [{ name, data: string | Uint8Array }] → Uint8Array
export function zip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);        // version needed
    local.setUint16(6, 0x0800, true);    // UTF-8 names
    local.setUint16(8, 0, true);         // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const dirSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}

/* ── workbook ─────────────────────────────────────────────────────────── */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // XML 1.0 can't carry most control characters
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function colName(i) { // 0 → A
  let s = '';
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

const argb = (hex) => `FF${hex.replace('#', '').toUpperCase()}`;

// Styles are deduplicated into the font / fill / cellXfs tables Excel wants.
function styleTable() {
  const fonts = ['<font><sz val="10"/><name val="Arial"/></font>'];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const index = (list, xml) => { let i = list.indexOf(xml); if (i < 0) { list.push(xml); i = list.length - 1; } return i; };
  const ids = new Map();
  return {
    id(st = {}) {
      const key = JSON.stringify(st);
      if (ids.has(key)) return ids.get(key);
      const font = index(fonts, `<font>${st.bold ? '<b/>' : ''}${st.italic ? '<i/>' : ''}<sz val="${st.size || 10}"/>${st.color ? `<color rgb="${argb(st.color)}"/>` : ''}<name val="${st.font || 'Arial'}"/></font>`);
      const fill = st.fill ? index(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(st.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
      const align = st.align || st.wrap ? `<alignment${st.align ? ` horizontal="${st.align}"` : ''} vertical="top"${st.wrap ? ' wrapText="1"' : ''}/>` : '';
      const border = st.border ? 1 : 0;
      const i = xfs.push(`<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1"${fill ? ' applyFill="1"' : ''}${border ? ' applyBorder="1"' : ''}${align ? ' applyAlignment="1"' : ''}>${align}</xf>`) - 1;
      ids.set(key, i);
      return i;
    },
    xml() {
      const side = '<left style="thin"><color rgb="FFBBBBBB"/></left><right style="thin"><color rgb="FFBBBBBB"/></right><top style="thin"><color rgb="FFBBBBBB"/></top><bottom style="thin"><color rgb="FFBBBBBB"/></bottom><diagonal/>';
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + `<fonts count="${fonts.length}">${fonts.join('')}</fonts>`
        + `<fills count="${fills.length}">${fills.join('')}</fills>`
        + `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${side}</border></borders>`
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`
        + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        + '</styleSheet>';
    },
  };
}

// sheets: [{ name, widths: [n], freeze: { cols, rows }, rows: [[cell]] }]
// cell: string | { v, style } with style { bold, italic, size, color, fill, font, wrap, align, border }
export function buildXlsx(sheets) {
  const styles = styleTable();
  const sheetXml = sheets.map((sh) => {
    const rows = sh.rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
      if (cell === null || cell === undefined || cell === '') return '';
      const { v, style } = typeof cell === 'object' ? cell : { v: cell };
      const s = style ? ` s="${styles.id(style)}"` : '';
      return `<c r="${colName(c)}${r + 1}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const f = sh.freeze;
    const pane = f ? `<pane xSplit="${f.cols}" ySplit="${f.rows}" topLeftCell="${colName(f.cols)}${f.rows + 1}" activePane="bottomRight" state="frozen"/>` : '';
    const cols = sh.widths?.length ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
  });
  // Sheet names: 31 chars, none of : \ / ? * [ ]
  const names = sheets.map((sh, i) => (String(sh.name).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || `Sheet${i + 1}`));
  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '</Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + `<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      + '</Relationships>' },
    ...sheetXml.map((data, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data })),
    { name: 'xl/styles.xml', data: styles.xml() }, // last: sheets above register their styles
  ];
  return zip(files);
}

/* ── the cue grid as a workbook ───────────────────────────────────────── */

const LIGHT_LABEL = { ...Object.fromEntries(Object.entries(APPARATUS).map(([l, kind]) => [l, `${l} ${kind}`])), 11: '11 backdrop' };

// Dimmer lights are drawn darker, mixed toward the "off" grey.
function tint(hex, level) {
  const k = Math.max(0.25, level / 100);
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return '#' + rgb.map((c) => Math.round(c * k + 40 * (1 - k)).toString(16).padStart(2, '0')).join('');
}

function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#000000' : '#ffffff';
}

function gridSheet(name, title, rows) {
  const body = { wrap: true, border: true };
  const head = ['Time', 'Section', ...ALL_LIGHTS.map((l) => LIGHT_LABEL[l] || String(l)), 'How it changes', 'Effect (runs)', 'Notes']
    .map((v) => ({ v, style: { bold: true, color: '#ffffff', fill: '#3a2a2e', align: 'center', wrap: true, border: true } }));
  return {
    name,
    widths: [9, 16, ...ALL_LIGHTS.map(() => 9.5), 16, 40, 60],
    freeze: { cols: 2, rows: 3 },
    rows: [
      [{ v: title, style: { bold: true, size: 14 } }],
      [{ v: 'Each row is a moment in the song. A light’s cell shows how it looks once that row’s cue has landed: its colour, a % if dimmed, “off” if dark.', style: { italic: true, color: '#555555' } }],
      head,
      ...rows.map((r) => [
        { v: r.time, style: { bold: true, font: 'Courier New', align: 'left', border: true } },
        { v: r.section, style: body },
        ...r.lights.map((l) => {
          if (!l) return { v: 'off', style: { size: 9, color: '#777777', fill: '#1e1e1e', align: 'center', border: true } };
          const fill = tint(l.hex, l.level);
          return { v: l.level >= 100 ? l.name : `${l.name} ${l.level}%`, style: { size: 9, color: inkOn(fill), fill, align: 'center', wrap: true, border: true } };
        }),
        { v: r.how, style: body }, { v: r.effect, style: body }, { v: r.notes, style: body },
      ]),
    ],
  };
}

export function cueWorkbook(plan) {
  const title = plan.title || 'Lighting cues';
  const sheets = [gridSheet('Cue grid', `${title} — lighting cues`, cueGrid(plan))];
  for (const b of backupGrids(plan)) sheets.push(gridSheet(`Backup ${b.rows[0]?.time.replace(':', '.') || ''}`, `Backup option — ${b.label}: ${b.choice}`, b.rows));
  return buildXlsx(sheets);
}
