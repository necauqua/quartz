import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/backlinks.scss"
import { FullSlug, resolveRelative, SimpleSlug, simplifySlug } from "../util/path"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"

interface BacklinksOptions {
  hideWhenEmpty: boolean
}

const defaultOptions: BacklinksOptions = {
  hideWhenEmpty: true,
}

export default ((opts?: Partial<BacklinksOptions>) => {
  const options: BacklinksOptions = { ...defaultOptions, ...opts }

  let backlinks: Map<SimpleSlug, Array<{ slug: FullSlug; title: string }>> | undefined

  const Backlinks: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
    cfg,
  }: QuartzComponentProps) => {
    if (!backlinks) {
      backlinks = new Map()

      const aliasMap = new Map<SimpleSlug, SimpleSlug>()
      for (const file of allFiles) {
        for (const alias of file.aliases ?? []) {
          aliasMap.set(simplifySlug(alias), simplifySlug(file.slug!))
        }
      }

      for (const file of allFiles) {
        for (let link of file.links ?? []) {
          link = aliasMap.get(link) ?? link
          let ref = backlinks.get(link)
          if (!ref) {
            backlinks.set(link, (ref = []))
          }
          ref.push({ slug: file.slug!, title: file.frontmatter?.title! })
        }
      }
    }

    const backlinkFiles = backlinks.get(simplifySlug(fileData.slug!)) ?? []

    if (options.hideWhenEmpty && backlinkFiles.length == 0) {
      return null
    }
    return (
      <div class={classNames(displayClass, "backlinks")}>
        <h3>{i18n(cfg.locale).components.backlinks.title}</h3>
        <ul class="overflow">
          {backlinkFiles.length > 0 ? (
            backlinkFiles.map((f) => (
              <li>
                <a href={resolveRelative(fileData.slug!, f.slug)} class="internal">
                  {f.title}
                </a>
              </li>
            ))
          ) : (
            <li>{i18n(cfg.locale).components.backlinks.noBacklinksFound}</li>
          )}
        </ul>
      </div>
    )
  }

  Backlinks.css = style

  return Backlinks
}) satisfies QuartzComponentConstructor
