import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import path from "path"

import style from "../styles/listPage.scss"
import { byDateAndAlphabetical, PageList, SortFn } from "../PageList"
import { stripSlashes, simplifySlug, joinSegments, FullSlug } from "../../util/path"
import { Root } from "hast"
import { htmlToJsx } from "../../util/jsx"
import { i18n } from "../../i18n"
import { QuartzPluginData } from "../../plugins/vfile"

interface FolderContentOptions {
  /**
   * Whether to display number of folders
   */
  showFolderCount: boolean
  showSubfolders: boolean
  sort?: SortFn
}

const defaultOptions: FolderContentOptions = {
  showFolderCount: true,
  showSubfolders: true,
}

type Subfolder = {
  name: string
  contents: QuartzPluginData[]
}

export default ((opts?: Partial<FolderContentOptions>) => {
  const options: FolderContentOptions = { ...defaultOptions, ...opts }

  const FolderContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { tree, fileData, allFiles, cfg } = props
    const folderSlug = stripSlashes(simplifySlug(fileData.slug!))
    const folderParts = folderSlug.split(path.posix.sep)

    const shownPages: QuartzPluginData[] = []
    const subfolders: Map<FullSlug, Subfolder> = new Map()

    for (const file of allFiles) {
      const fileSlug = stripSlashes(simplifySlug(file.slug!))
      // check only files in our folder or nested folders
      if (!fileSlug.startsWith(folderSlug) || fileSlug === folderSlug) {
        continue
      }

      const fileParts = fileSlug.split(path.posix.sep)

      // If the file is directly in the folder we just show it
      if (fileParts.length === folderParts.length + 1) {
        shownPages.push(file)
        continue
      }

      if (options.showSubfolders) {
        const subfolderSlug = joinSegments(
          ...fileParts.slice(0, folderParts.length + 1),
        ) as FullSlug

        let subfolder = subfolders.get(subfolderSlug)
        if (!subfolder) {
          const subfolderName = file.relativePath!.split(path.posix.sep).at(folderParts.length)!
          subfolders.set(subfolderSlug, (subfolder = { name: subfolderName, contents: [] }))
        }
        subfolder.contents.push(file)
      }
    }

    for (const [slug, subfolder] of subfolders.entries()) {
      const hasIndex = shownPages.some((file) => slug === stripSlashes(simplifySlug(file.slug!)))
      if (!hasIndex) {
        const subfolderDates = subfolder.contents.sort(byDateAndAlphabetical(cfg))[0].dates
        shownPages.push({
          slug: slug,
          dates: subfolderDates,
          frontmatter: { title: subfolder.name, tags: ["folder"] },
        })
      }
    }

    const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
    const classes = cssClasses.join(" ")
    const listProps = {
      ...props,
      sort: options.sort,
      allFiles: shownPages,
    }

    const content =
      (tree as Root).children.length === 0
        ? fileData.description
        : htmlToJsx(fileData.filePath!, tree)

    return (
      <div class="popover-hint">
        <article class={classes}>{content}</article>
        <div class="page-listing">
          {options.showFolderCount && (
            <p>
              {i18n(cfg.locale).pages.folderContent.itemsUnderFolder({
                count: shownPages.length,
              })}
            </p>
          )}
          <div>
            <PageList {...listProps} />
          </div>
        </div>
      </div>
    )
  }

  FolderContent.css = style + PageList.css
  return FolderContent
}) satisfies QuartzComponentConstructor
