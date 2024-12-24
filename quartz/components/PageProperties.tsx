import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { ComponentChildren } from "preact"
import { externalLinkRegex, wikilinkRegex } from "../plugins/transformers/ofm"
import style from "./styles/pageProperties.scss"
import { pathToRoot, simplifySlug, slugTag, splitAnchor, transformLink } from "../util/path"
import { getFullInternalLink } from "../plugins/transformers/links"

interface PagePropertiesOptions {
  fieldRenderers: {
    [name: string]: (value: any, props: QuartzComponentProps) => ComponentChildren | null
  }
  defaultRenderer: (name: string, value: any, props: QuartzComponentProps) => ComponentChildren
}

function renderExternalLink(value: string): ComponentChildren {
  return (
    <a class="external" href={value} target="_blank">
      {value}
    </a>
  )
}

function renderInternalLink(
  value: string,
  rawFp: string,
  rawHeader: string | undefined,
  rawAlias: string | undefined,
  props: QuartzComponentProps,
): ComponentChildren {
  const fp = rawFp?.trim() ?? ""
  const anchor = rawHeader?.trim() ?? ""
  const alias = rawAlias?.slice(1).trim()

  const url = fp + anchor
  const text = alias ?? fp

  const href = transformLink(props.fileData.slug!, url, {
    strategy: "shortest",
    allSlugs: props.ctx.allSlugs,
  })
  const full = getFullInternalLink(href, simplifySlug(props.fileData.slug!))

  return (
    <a class="internal" href={href} data-slug={full}>
      {text}
    </a>
  )
}

function defaultRenderer(name: string, value: any, props: QuartzComponentProps): ComponentChildren {
  if (value === null) {
    return "null"
  }
  if (value === undefined) {
    return null
  }
  if (typeof value === "string") {
    if (value.match(externalLinkRegex)) {
      return renderExternalLink(value)
    }
    const [match] = [...value.matchAll(wikilinkRegex)]
    if (match && match[0] === value && !value.startsWith("!")) {
      return renderInternalLink(value, match[1], match[2], match[3], props)
    }
    return value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return ""
    }
    return (
      <ul class="property-list">
        {value.map((v) => (
          <li>{defaultRenderer(name, v, props)}</li>
        ))}
      </ul>
    )
  }
  if (typeof value === "object") {
    return <code>{JSON.stringify(value, null, 2)}</code>
  }
  return value.toString?.() ?? null
}

function tagRenderer(value: any, props: QuartzComponentProps): ComponentChildren {
  const tags = Array.isArray(value) ? value : [value]
  const baseDir = pathToRoot(props.fileData.slug!)
  return (
    <ul class="property-list">
      {tags.map((tag) => {
        return (
          <li>
            <a href={`${baseDir}/tags/${slugTag(`${tag}`)}`} class="internal tag-link">
              {tag}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

const hide = () => null
const defaultOptions: PagePropertiesOptions = {
  fieldRenderers: {
    title: hide,
    date: hide,
    cssclasses: hide,
    tags: tagRenderer,
    ["hide-props"]: hide,
  },
  defaultRenderer,
}

export default ((opts?: Partial<PagePropertiesOptions>) => {
  const options: PagePropertiesOptions = {
    fieldRenderers: { ...defaultOptions.fieldRenderers, ...opts?.fieldRenderers },
    defaultRenderer: opts?.defaultRenderer ?? defaultOptions.defaultRenderer,
  }

  const PageProperties: QuartzComponent = (props: QuartzComponentProps) => {
    if (!props.fileData.frontmatterRaw) {
      return null
    }

    const hideRaw = props.fileData.frontmatter?.["hide-props"]
    const hide =
      typeof hideRaw === "string"
        ? [hideRaw]
        : Array.isArray(hideRaw) && typeof hideRaw[0] === "string"
          ? (hideRaw as string[])
          : []

    return (
      <dl class={classNames(props.displayClass, "page-props")}>
        {Object.entries(props.fileData.frontmatterRaw ?? {}).map(([name, value]) => {
          if (hide.includes(name)) {
            return null
          }
          const renderer = options.fieldRenderers[name]
          const rendered = renderer
            ? renderer(value, props)
            : options.defaultRenderer(name, value, props)
          if (rendered === null) {
            return null
          }
          return (
            <>
              <dt>{name}</dt>
              <dd>{rendered}</dd>
            </>
          )
        })}
      </dl>
    )
  }

  PageProperties.css = style

  return PageProperties
}) satisfies QuartzComponentConstructor
