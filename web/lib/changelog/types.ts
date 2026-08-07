/** Append-only changelog row — manually maintained in docs/{locale}/changelog.json */
export type ChangelogEntry = {
  date: string
  version: string
  /** GFM markdown strings (wiki Preview subset: headings, lists, tables, code, links) */
  mods: string[]
}

export type ChangelogDocument = ChangelogEntry[]
