export const LABEL_FORMATS: Record<
  string,
  {
    label: string;
    cols: number;
    rows: number;
    width: number;
    height: number;
    leftMargin: number;
    topMargin: number;
    hGap: number;
    vGap: number;
  }
> = {
  avery5167: {
    label: 'Avery 5167 (0.5" x 1.75")',
    cols: 4,
    rows: 20,
    width: 1.75 * 72,
    height: 0.5 * 72,
    leftMargin: 0.28125 * 72,
    topMargin: 0.5 * 72,
    hGap: 0.3125 * 72,
    vGap: 0,
  },
  avery94102: {
    label: 'Avery Presta 94102 (0.75" square)',
    cols: 8,
    rows: 10,
    width: 0.75 * 72,
    height: 0.75 * 72,
    leftMargin: 0.375 * 72,
    topMargin: 0.625 * 72,
    hGap: 0.25 * 72,
    vGap: 0.25 * 72,
  },
};
